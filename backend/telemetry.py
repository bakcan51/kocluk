"""
Production Observability & Telemetry Module (P9.5)
===================================================
Lightweight, thread-safe in-app telemetry engine that collects:
1. Request ID tracking (X-Request-ID)
2. Latency percentiles (p50, p95, p99) across endpoints & system
3. DB pool acquire duration & connection status
4. Container CPU & RAM utilization
5. Capacity warning & critical alert state evaluation
"""

import sys
import time
import uuid
import os
import resource
import statistics
from collections import deque
from threading import Lock

# SLO Targets from P9.1
SLO_TARGETS = {
    "/api/students": {"p95_target": 100.0, "p99_target": 180.0, "max_5xx_pct": 0.1},
    "/api/mesajlar/contacts": {"p95_target": 150.0, "p99_target": 250.0, "max_5xx_pct": 0.1},
    "/api/kaynak-havuzu": {"p95_target": 160.0, "p99_target": 250.0, "max_5xx_pct": 0.1},
    "/api/odevler": {"p95_target": 160.0, "p99_target": 250.0, "max_5xx_pct": 0.1},
    "/api/weekly-program": {"p95_target": 220.0, "p99_target": 350.0, "max_5xx_pct": 0.1},
    "/api/mufredat": {"p95_target": 230.0, "p99_target": 360.0, "max_5xx_pct": 0.1},
    "/api/deneme": {"p95_target": 290.0, "p99_target": 450.0, "max_5xx_pct": 0.1},
    "/api/raporlar": {"p95_target": 190.0, "p99_target": 320.0, "max_5xx_pct": 0.1}
}

class TelemetryManager:
    def __init__(self, max_history=1000, max_slow_logs=100):
        self._lock = Lock()
        self._history = deque(maxlen=max_history)
        self._slow_logs = deque(maxlen=max_slow_logs)
        self._start_time = time.time()
        self._total_requests_count = 0
        self._fallback_connect_count = 0
        self._active_pool_checkouts = 0

    def generate_request_id(self):
        return f"req_{uuid.uuid4().hex[:12]}"

    def increment_fallback_connect(self):
        with self._lock:
            self._fallback_connect_count += 1

    def increment_active_checkouts(self):
        with self._lock:
            self._active_pool_checkouts += 1

    def decrement_active_checkouts(self):
        with self._lock:
            if self._active_pool_checkouts > 0:
                self._active_pool_checkouts -= 1

    def record_request(self, request_id, endpoint, method, status_code, duration_ms, pool_acquire_ms=0.0, sql_time_ms=0.0, sql_count=0):
        entry = {
            "request_id": request_id,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
            "pool_acquire_ms": round(pool_acquire_ms, 2),
            "sql_time_ms": round(sql_time_ms, 2),
            "sql_count": sql_count,
            "timestamp": time.time()
        }

        with self._lock:
            self._total_requests_count += 1
            self._history.append(entry)
            if duration_ms > 500.0 or status_code >= 500:
                self._slow_logs.append(entry)

    def get_container_metrics(self):
        usage = resource.getrusage(resource.RUSAGE_SELF)
        if sys.platform == 'darwin':
            rss_mb = round(usage.ru_maxrss / (1024 * 1024), 1)
        else:
            rss_mb = round(usage.ru_maxrss / 1024, 1)

        uptime_sec = round(time.time() - self._start_time, 1)
        return {
            "process_pid": os.getpid(),
            "ram_rss_mb": rss_mb,
            "uptime_seconds": uptime_sec,
            "uptime_human": f"{int(uptime_sec // 3600)}h {int((uptime_sec % 3600) // 60)}m {int(uptime_sec % 60)}s"
        }

    def get_metrics_summary(self):
        with self._lock:
            records = list(self._history)
            slow_records = list(self._slow_logs)
            fallback_cnt = self._fallback_connect_count
            active_chk = self._active_pool_checkouts
            total_reqs = self._total_requests_count

        container = self.get_container_metrics()

        if not records:
            return {
                "total_requests_recorded": 0,
                "overall": {
                    "p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0, "avg_ms": 0.0,
                    "pool_acquire_p95_ms": 0.0, "sql_time_p95_ms": 0.0,
                    "error_rate_pct": 0.0, "2xx_count": 0, "4xx_count": 0, "5xx_count": 0
                },
                "endpoints": {},
                "pool": {
                    "active_checkouts": active_chk,
                    "fallback_connect_count": fallback_cnt
                },
                "container": container,
                "alerts": {
                    "status": "HEALTHY",
                    "active_alerts": []
                },
                "recent_slow_requests": []
            }

        durations = [r["duration_ms"] for r in records]
        pool_waits = [r["pool_acquire_ms"] for r in records]
        sql_times = [r["sql_time_ms"] for r in records]

        durations.sort()
        pool_waits.sort()
        sql_times.sort()

        n = len(durations)
        p50 = statistics.median(durations)
        p95 = durations[int(n * 0.95)] if n > 0 else 0.0
        p99 = durations[int(n * 0.99)] if n > 0 else 0.0
        avg_lat = statistics.mean(durations)

        pool_p95 = pool_waits[int(len(pool_waits) * 0.95)] if pool_waits else 0.0
        sql_p95 = sql_times[int(len(sql_times) * 0.95)] if sql_times else 0.0

        c_2xx = sum(1 for r in records if 200 <= r["status_code"] < 300)
        c_4xx = sum(1 for r in records if 400 <= r["status_code"] < 500)
        c_5xx = sum(1 for r in records if r["status_code"] >= 500)
        err_rate = round((c_5xx / n * 100), 2) if n > 0 else 0.0

        endpoints_data = {}
        ep_groups = {}
        for r in records:
            ep = r["endpoint"]
            if ep not in ep_groups:
                ep_groups[ep] = []
            ep_groups[ep].append(r)

        for ep, ep_records in ep_groups.items():
            ep_durs = [r["duration_ms"] for r in ep_records]
            ep_durs.sort()
            ep_n = len(ep_durs)
            ep_p50 = statistics.median(ep_durs)
            ep_p95 = ep_durs[int(ep_n * 0.95)] if ep_n > 0 else 0.0
            ep_p99 = ep_durs[int(ep_n * 0.99)] if ep_n > 0 else 0.0
            ep_5xx = sum(1 for r in ep_records if r["status_code"] >= 500)
            ep_err_rate = round((ep_5xx / ep_n * 100), 2) if ep_n > 0 else 0.0

            matching_slo = None
            for slo_path, target_spec in SLO_TARGETS.items():
                if ep.startswith(slo_path):
                    matching_slo = target_spec
                    break

            slo_status = "OK"
            if matching_slo:
                if ep_p95 > matching_slo["p95_target"] * 1.5:
                    slo_status = "BREACH"
                elif ep_p95 > matching_slo["p95_target"]:
                    slo_status = "WARNING"

            endpoints_data[ep] = {
                "request_count": ep_n,
                "p50_ms": round(ep_p50, 2),
                "p95_ms": round(ep_p95, 2),
                "p99_ms": round(ep_p99, 2),
                "avg_ms": round(statistics.mean(ep_durs), 2),
                "5xx_count": ep_5xx,
                "error_rate_pct": ep_err_rate,
                "slo_target_p95": matching_slo["p95_target"] if matching_slo else None,
                "slo_status": slo_status
            }

        active_alerts = []
        alert_status = "HEALTHY"

        if p95 > 1000.0:
            active_alerts.append({"level": "CRITICAL", "metric": "API p95", "value": f"{round(p95, 1)}ms", "threshold": ">1000ms"})
            alert_status = "CRITICAL"
        elif p95 > 500.0:
            active_alerts.append({"level": "WARNING", "metric": "API p95", "value": f"{round(p95, 1)}ms", "threshold": ">500ms"})
            if alert_status != "CRITICAL": alert_status = "WARNING"

        if err_rate > 3.0:
            active_alerts.append({"level": "CRITICAL", "metric": "Error Rate 5xx", "value": f"{err_rate}%", "threshold": ">3%"})
            alert_status = "CRITICAL"
        elif err_rate > 1.0:
            active_alerts.append({"level": "WARNING", "metric": "Error Rate 5xx", "value": f"{err_rate}%", "threshold": ">1%"})
            if alert_status != "CRITICAL": alert_status = "WARNING"

        if pool_p95 > 200.0:
            active_alerts.append({"level": "CRITICAL", "metric": "Pool Wait p95", "value": f"{round(pool_p95, 1)}ms", "threshold": ">200ms"})
            alert_status = "CRITICAL"
        elif pool_p95 > 50.0:
            active_alerts.append({"level": "WARNING", "metric": "Pool Wait p95", "value": f"{round(pool_p95, 1)}ms", "threshold": ">50ms"})
            if alert_status != "CRITICAL": alert_status = "WARNING"

        if container["ram_rss_mb"] > 435.0:
            active_alerts.append({"level": "CRITICAL", "metric": "Container RAM", "value": f"{container['ram_rss_mb']}MB", "threshold": ">435MB (85%)"})
            alert_status = "CRITICAL"
        elif container["ram_rss_mb"] > 360.0:
            active_alerts.append({"level": "WARNING", "metric": "Container RAM", "value": f"{container['ram_rss_mb']}MB", "threshold": ">360MB (70%)"})
            if alert_status != "CRITICAL": alert_status = "WARNING"

        return {
            "total_lifetime_requests": total_reqs,
            "window_requests_recorded": n,
            "overall": {
                "p50_ms": round(p50, 2),
                "p95_ms": round(p95, 2),
                "p99_ms": round(p99, 2),
                "avg_ms": round(avg_lat, 2),
                "pool_acquire_p95_ms": round(pool_p95, 2),
                "sql_time_p95_ms": round(sql_p95, 2),
                "error_rate_pct": err_rate,
                "2xx_count": c_2xx,
                "4xx_count": c_4xx,
                "5xx_count": c_5xx
            },
            "endpoints": endpoints_data,
            "pool": {
                "active_checkouts": active_chk,
                "fallback_connect_count": fallback_cnt
            },
            "container": container,
            "alerts": {
                "status": alert_status,
                "active_alerts": active_alerts
            },
            "recent_slow_requests": list(reversed(slow_records[-15:]))
        }

telemetry = TelemetryManager()
