import sqlite3
import os
import shutil
import json
import re
from datetime import datetime, date, timedelta
import werkzeug.security
import threading

try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

try:
    from flask import has_app_context, g
except ImportError:
    has_app_context = lambda: False
    g = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "yks_platform.db")

# Load .env if present and not already set
_env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(_env_path):
    try:
        with open(_env_path, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    _k = _k.strip()
                    _v = _v.strip().strip("'\"")
                    if _k and _k not in os.environ:
                        os.environ[_k] = _v
    except Exception:
        pass

def get_database_url():
    url = os.environ.get("DATABASE_URL")
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

def is_postgres():
    return bool(get_database_url() and PSYCOPG2_AVAILABLE)

# On serverless platforms (e.g. Vercel, AWS Lambda), the deployment folder is read-only.
# We copy the pre-seeded SQLite database to /tmp so writes succeed.
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    TMP_DB_PATH = "/tmp/yks_platform.db"
    if not os.path.exists(TMP_DB_PATH):
        if os.path.exists(DEFAULT_DB_PATH):
            try:
                shutil.copy2(DEFAULT_DB_PATH, TMP_DB_PATH)
            except Exception:
                pass
        else:
            backend_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yks_platform.db")
            if os.path.exists(backend_db):
                try:
                    shutil.copy2(backend_db, TMP_DB_PATH)
                except Exception:
                    pass
    DB_PATH = TMP_DB_PATH
else:
    custom_db_path = os.environ.get("DATABASE_PATH")
    if custom_db_path:
        db_dir = os.path.dirname(os.path.abspath(custom_db_path))
        if db_dir:
            try:
                os.makedirs(db_dir, exist_ok=True)
            except Exception:
                pass
        if not os.path.exists(custom_db_path) and os.path.exists(DEFAULT_DB_PATH):
            try:
                shutil.copy2(DEFAULT_DB_PATH, custom_db_path)
            except Exception:
                pass
        DB_PATH = custom_db_path
    else:
        DB_PATH = DEFAULT_DB_PATH

# ----------------------------------------------------
# POSTGRESQL QUERY & CONNECTION WRAPPER
# ----------------------------------------------------
def translate_query_for_postgres(sql):
    if not sql:
        return ""
    cleaned = sql.strip()
    # Ignore PRAGMA commands in PostgreSQL
    if cleaned.upper().startswith("PRAGMA"):
        return "SELECT 1;"

    # Translate AUTOINCREMENT to SERIAL PRIMARY KEY in DDL
    sql = re.sub(r'INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT', 'SERIAL PRIMARY KEY', sql, flags=re.IGNORECASE)

    # Translate BOOLEAN to INTEGER for PostgreSQL DDL
    sql = re.sub(r'\bBOOLEAN\b', 'INTEGER', sql, flags=re.IGNORECASE)

    # Translate date/time helper functions
    sql = re.sub(r'\bDATE\(\'now\'\)', 'CURRENT_DATE', sql, flags=re.IGNORECASE)
    sql = re.sub(r'\bDATETIME\(\'now\'\)', 'CURRENT_TIMESTAMP', sql, flags=re.IGNORECASE)

    # Translate parameter placeholders '?' to '%s' outside quotes
    parts = []
    in_quote = False
    quote_char = None
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch in ("'", '"') and (i == 0 or sql[i-1] != '\\'):
            if not in_quote:
                in_quote = True
                quote_char = ch
            elif quote_char == ch:
                in_quote = False
                quote_char = None
            parts.append(ch)
        elif ch == '?' and not in_quote:
            parts.append('%s')
        else:
            parts.append(ch)
        i += 1
    return "".join(parts)

class PostgresCursorWrapper:
    def __init__(self, raw_cursor, conn):
        self._cursor = raw_cursor
        self._conn = conn
        self._lastrowid = None

    def execute(self, sql, params=None):
        translated = translate_query_for_postgres(sql)
        is_insert = translated.strip().upper().startswith("INSERT INTO") and "RETURNING" not in translated.upper()

        if is_insert:
            sql_with_returning = f"{translated.rstrip().rstrip(';')} RETURNING id;"
            try:
                if params is None:
                    res = self._cursor.execute(sql_with_returning)
                else:
                    res = self._cursor.execute(sql_with_returning, params)
                row = self._cursor.fetchone()
                if row:
                    self._lastrowid = row[0]
                return res
            except Exception:
                self._conn.rollback()
                self._lastrowid = None
                if params is None:
                    return self._cursor.execute(translated)
                else:
                    return self._cursor.execute(translated, params)
        else:
            self._lastrowid = None
            if params is None:
                return self._cursor.execute(translated)
            else:
                return self._cursor.execute(translated, params)

    def executemany(self, sql, seq_of_params):
        translated = translate_query_for_postgres(sql)
        return self._cursor.executemany(translated, seq_of_params)

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        if size is None:
            return self._cursor.fetchmany()
        return self._cursor.fetchmany(size)

    @property
    def lastrowid(self):
        return self._lastrowid

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description

    def close(self):
        return self._cursor.close()

    def __iter__(self):
        return iter(self._cursor)

_pg_pool = None
_pg_pool_lock = threading.Lock()

def get_pg_pool():
    global _pg_pool
    if _pg_pool is None and is_postgres():
        with _pg_pool_lock:
            if _pg_pool is None:
                db_url = get_database_url()
                if db_url and PSYCOPG2_AVAILABLE:
                    try:
                        _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                            minconn=1,
                            maxconn=10,
                            dsn=db_url
                        )
                        print("✓ PostgreSQL ThreadedConnectionPool initialized successfully (min=1, max=10).")
                    except Exception as e:
                        print(f"⚠️ PostgreSQL ThreadedConnectionPool initialization warning: {e}")
                        _pg_pool = None
    return _pg_pool

class PostgresConnectionWrapper:
    def __init__(self, raw_conn, pool=None):
        self._conn = raw_conn
        self._pool = pool
        self._is_closed = False
        self.row_factory = None

    def cursor(self):
        if self._is_closed or self._conn.closed:
            raise psycopg2.InterfaceError("Connection is closed")
        raw_cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        return PostgresCursorWrapper(raw_cur, self._conn)

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        if not self._is_closed and not self._conn.closed:
            return self._conn.commit()

    def rollback(self):
        if not self._is_closed and not self._conn.closed:
            return self._conn.rollback()

    def close(self, force=False):
        # In Flask request context, keep connection open for reuse until teardown unless force=True
        if has_app_context() and not force:
            return

        if self._is_closed:
            return
        self._is_closed = True
        if has_app_context() and g is not None:
            if getattr(g, 'db', None) is self:
                g.db = None
        
        if self._pool is not None:
            try:
                if self._conn and not self._conn.closed:
                    self._conn.rollback()
                    self._pool.putconn(self._conn)
                else:
                    self._pool.putconn(self._conn, close=True)
            except Exception:
                try:
                    self._pool.putconn(self._conn, close=True)
                except Exception:
                    pass
        else:
            try:
                if self._conn and not self._conn.closed:
                    self._conn.close()
            except Exception:
                pass

    @property
    def total_changes(self):
        return 1

# ----------------------------------------------------
# UNIFIED DATABASE ACCESSOR
# ----------------------------------------------------
def get_db():
    if is_postgres():
        if has_app_context() and g is not None:
            db = getattr(g, 'db', None)
            if db is not None and not getattr(db, '_is_closed', False):
                try:
                    if getattr(db, '_conn', None) is not None and not db._conn.closed:
                        return db
                except Exception:
                    pass
                db = None
                g.db = None
            
            pool = get_pg_pool()
            if pool is not None:
                try:
                    raw_conn = pool.getconn()
                    if raw_conn.closed:
                        pool.putconn(raw_conn, close=True)
                        raw_conn = pool.getconn()
                    wrapper = PostgresConnectionWrapper(raw_conn, pool=pool)
                    g.db = wrapper
                    return g.db
                except Exception as e:
                    print(f"⚠️ Error getting connection from pool: {e}")
            
            db_url = get_database_url()
            raw_conn = psycopg2.connect(db_url)
            g.db = PostgresConnectionWrapper(raw_conn)
            return g.db
        else:
            pool = get_pg_pool()
            if pool is not None:
                try:
                    raw_conn = pool.getconn()
                    if raw_conn.closed:
                        pool.putconn(raw_conn, close=True)
                        raw_conn = pool.getconn()
                    return PostgresConnectionWrapper(raw_conn, pool=pool)
                except Exception:
                    pass
            db_url = get_database_url()
            raw_conn = psycopg2.connect(db_url)
            return PostgresConnectionWrapper(raw_conn)
    else:
        if has_app_context() and g is not None:
            db = getattr(g, 'db', None)
            if db is not None:
                try:
                    # Verify database connection is still open
                    db.total_changes
                except Exception:
                    db = None
                    g.db = None

            if db is None:
                conn = sqlite3.connect(DB_PATH, timeout=30.0)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA foreign_keys = ON;")
                conn.execute("PRAGMA busy_timeout = 30000;")
                conn.execute("PRAGMA journal_mode = WAL;")
                g.db = conn
            return g.db
        else:
            conn = sqlite3.connect(DB_PATH, timeout=30.0)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA busy_timeout = 30000;")
            conn.execute("PRAGMA journal_mode = WAL;")
            return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode=WAL;")

    # 1. Users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        plain_password TEXT,
        role TEXT NOT NULL CHECK(role IN ('ADMIN', 'COACH', 'STUDENT')),
        name TEXT NOT NULL,
        surname TEXT,
        phone TEXT,
        status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
        must_change_password INTEGER DEFAULT 0,
        last_login_at TIMESTAMP,
        password_changed_at TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        lockout_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
    );
    """)

    # 2. Coaches
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        title TEXT DEFAULT 'YKS Öğrenci Koçu',
        bio TEXT,
        specialty TEXT,
        coach_code TEXT UNIQUE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 3. Students
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        coach_id INTEGER,
        grade TEXT DEFAULT '12. Sınıf',
        track TEXT NOT NULL CHECK(track IN ('SAYISAL', 'EA', 'SOZEL', 'YDT')),
        school TEXT,
        target_university TEXT,
        target_department TEXT,
        target_score REAL,
        target_rank INTEGER,
        start_date DATE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
    );
    """)

    # 4. Many-to-Many Coach-Student Relationships
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coach_students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(coach_id, student_id),
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coach_student_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL DEFAULT 'MAIN_COACH',
        status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ENDED')),
        assigned_by INTEGER,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP,
        ended_at TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_student_rel_unique ON coach_student_relationships (student_id, coach_id);
    """)

    # 5. Coach Invitations (Secure tokens: /invite/TOKEN)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coach_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        invitation_token TEXT UNIQUE NOT NULL,
        relationship_type TEXT DEFAULT 'MAIN_COACH',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_used INTEGER DEFAULT 0,
        used_by_student_id INTEGER,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (used_by_student_id) REFERENCES students(id)
    );
    """)

    # 6. Student Connection Requests
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coach_connection_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        coach_id INTEGER NOT NULL,
        requested_relationship_type TEXT DEFAULT 'MAIN_COACH',
        request_note TEXT,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    );
    """)

    # 7. Coach Notes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coach_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        note TEXT NOT NULL,
        visibility TEXT DEFAULT 'PRIVATE_TO_COACH' CHECK(visibility IN ('PRIVATE_TO_COACH', 'VISIBLE_TO_STUDENT')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    # 8. Student Profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL UNIQUE,
        initial_nets_json TEXT,
        current_nets_json TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    # 9. Curriculum Versions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS curriculum_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        exam_year INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 10. Subjects
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        exam_type TEXT NOT NULL CHECK(exam_type IN ('TYT', 'AYT', 'YDT')),
        question_count INTEGER DEFAULT 40,
        sort_order INTEGER DEFAULT 0
    );
    """)

    # 11. Units & Topics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        unit_name TEXT NOT NULL,
        name TEXT NOT NULL,
        curriculum_version_id INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (curriculum_version_id) REFERENCES curriculum_versions(id)
    );
    """)

    # 12. Publishers
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS publishers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        website TEXT,
        is_verified INTEGER DEFAULT 1
    );
    """)

    # 13. Legacy Resource References (Primary definition in Table #27)
    pass

    # 14. Resource Sections
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id INTEGER NOT NULL,
        topic_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        page_start INTEGER,
        page_end INTEGER,
        question_count INTEGER DEFAULT 0,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    """)

    # 15. Resource Discovery Queue
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_discovery_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        publisher_name TEXT,
        subject_name TEXT,
        exam_type TEXT,
        resource_type TEXT,
        level TEXT,
        source_url TEXT,
        confidence_score REAL DEFAULT 0.8,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Study Sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        subject_id INTEGER DEFAULT 1,
        duration_seconds INTEGER DEFAULT 0,
        session_date DATE DEFAULT (DATE('now')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN track TEXT CHECK(track IN ('ALL', 'SAYISAL', 'EA', 'SOZEL', 'YDT')) DEFAULT 'ALL';")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN total_questions INTEGER DEFAULT 0;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN cover_url TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE question_logs ADD COLUMN notes TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN owner_type TEXT DEFAULT 'SYSTEM';")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE students ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
    except Exception:
        pass





    # 16. Student Assigned Resources
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        resource_id INTEGER NOT NULL,
        assigned_by_coach_id INTEGER,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        start_date DATE,
        target_end_date DATE,
        status TEXT DEFAULT 'IN_PROGRESS' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ARCHIVED')),
        priority TEXT DEFAULT 'ORTA' CHECK(priority IN ('DUSUK', 'ORTA', 'YUKSEK')),
        coach_note TEXT,
        completion_percentage REAL DEFAULT 0.0,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by_coach_id) REFERENCES coaches(id)
    );
    """)

    # 17. Student Resource Section Progress
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_resource_section_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_resource_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEW_REQUIRED')),
        completed_questions INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_resource_id) REFERENCES student_resources(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES resource_sections(id) ON DELETE CASCADE
    );
    """)

    # 18. Student Topic Progress
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_topic_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        topic_id INTEGER NOT NULL,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEW_REQUIRED')),
        sources_completed_count INTEGER DEFAULT 0,
        sources_total_count INTEGER DEFAULT 10,
        last_studied_at TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    """)

    # 18b. Student Resource Topic Progress (Resource-based Curriculum Topic Tracking)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_resource_topic_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_resource_id INTEGER NOT NULL,
        topic_id INTEGER NOT NULL,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEW_REQUIRED')),
        progress_percentage REAL DEFAULT 0.0,
        marked_by TEXT DEFAULT 'STUDENT',
        marked_by_role TEXT DEFAULT 'STUDENT',
        coach_approved INTEGER DEFAULT 0,
        coach_approved_at TIMESTAMP,
        coach_approved_by INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_resource_id) REFERENCES student_resources(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    """)

    # 18c. Resource Section Curriculum Topics (Many-to-Many Mapping)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_section_curriculum_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL,
        topic_id INTEGER NOT NULL,
        FOREIGN KEY (section_id) REFERENCES resource_sections(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    """)

    # 18d. Topic Progress History Audit Log
    # 18e. Simple Main Curriculum (ALAN -> DERS -> ANA KONU)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS curriculum (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_type TEXT NOT NULL CHECK(exam_type IN ('TYT', 'AYT', 'YDT')),
        field TEXT NOT NULL CHECK(field IN ('ORTAK', 'SAYISAL', 'EA', 'SOZEL', 'YDT')),
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1
    );
    """)

    # 18f. Simple Student Main Topic Resource Assignments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_topic_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        curriculum_id INTEGER NOT NULL,
        resource_id INTEGER,
        assigned_by INTEGER,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
        primary_resource INTEGER DEFAULT 1,
        progress_percentage REAL DEFAULT 0.0,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (curriculum_id) REFERENCES curriculum(id) ON DELETE CASCADE,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
    );
    """)

    # 18g. Simple Student Main Topic Decoupled Completion Status
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_topic_statuses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        curriculum_id INTEGER NOT NULL,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, curriculum_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (curriculum_id) REFERENCES curriculum(id) ON DELETE CASCADE
    );
    """)

    # 19. Study Plans
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        coach_id INTEGER NOT NULL,
        created_by_coach_id INTEGER,
        week_start_date DATE NOT NULL,
        notes TEXT,
        compliance_rate REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_coach_id) REFERENCES coaches(id)
    );
    """)

    # 20. Study Plan Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        day_of_week TEXT NOT NULL,
        time_slot TEXT,
        subject_id INTEGER NOT NULL,
        topic_id INTEGER,
        task_description TEXT NOT NULL,
        target_question_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'COMPLETED', 'PARTIAL', 'SKIPPED')),
        FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id),
        FOREIGN KEY (topic_id) REFERENCES topics(id)
    );
    """)

    # 21. Assignments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        created_by_coach_id INTEGER,
        student_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        subject_id INTEGER,
        topic_id INTEGER,
        resource_id INTEGER,
        section_range TEXT,
        target_question_count INTEGER DEFAULT 0,
        due_date DATE NOT NULL,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'LATE', 'VERIFIED')),
        priority TEXT DEFAULT 'ORTA' CHECK(priority IN ('DUSUK', 'ORTA', 'YUKSEK')),
        submission_note TEXT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (coach_id) REFERENCES coaches(id),
        FOREIGN KEY (created_by_coach_id) REFERENCES coaches(id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (resource_id) REFERENCES resources(id)
    );
    """)

    # 22. Question Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS question_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        log_date DATE NOT NULL,
        subject_id INTEGER NOT NULL,
        topic_id INTEGER,
        correct INTEGER DEFAULT 0,
        incorrect INTEGER DEFAULT 0,
        empty INTEGER DEFAULT 0,
        net REAL DEFAULT 0.0,
        duration_minutes INTEGER DEFAULT 0,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
    """)

    # 23. Mock Exams
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        title TEXT NOT NULL,
        exam_type TEXT NOT NULL CHECK(exam_type IN ('TYT', 'AYT', 'YDT', 'BRANS')),
        field TEXT DEFAULT 'ORTAK',
        publisher TEXT,
        curriculum_version_id INTEGER DEFAULT 1,
        total_correct INTEGER DEFAULT 0,
        total_wrong INTEGER DEFAULT 0,
        total_blank INTEGER DEFAULT 0,
        total_net REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (curriculum_version_id) REFERENCES curriculum_versions(id)
    );
    """)

    # 23b. Exam Subjects Mapping (Dynamic Subject Setup per Exam Type & Field)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_type TEXT NOT NULL,
        field TEXT DEFAULT 'ORTAK',
        subject_id INTEGER NOT NULL,
        display_order INTEGER DEFAULT 0,
        question_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    """)

    # 24. Mock Exam Results
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_exam_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        mock_exam_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        correct INTEGER DEFAULT 0,
        incorrect INTEGER DEFAULT 0,
        empty INTEGER DEFAULT 0,
        net REAL DEFAULT 0.0,
        exam_date DATE NOT NULL,
        analysis_done INTEGER DEFAULT 0,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (mock_exam_id) REFERENCES mock_exams(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
    """)

    # 24.b Mock Exam Topic Errors
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_exam_topic_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_id INTEGER NOT NULL,
        topic_id INTEGER NOT NULL,
        incorrect_count INTEGER DEFAULT 0,
        empty_count INTEGER DEFAULT 0,
        FOREIGN KEY (result_id) REFERENCES mock_exam_results(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id)
    );
    """)

    # 24.c Advanced Exam Engine Tables (YKS + LGS Engine)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        exam_system TEXT NOT NULL DEFAULT 'YKS',
        exam_type TEXT NOT NULL,
        exam_name TEXT NOT NULL,
        publisher TEXT,
        exam_date DATE NOT NULL,
        duration_minutes INTEGER DEFAULT 0,
        total_score REAL DEFAULT 0.0,
        total_net REAL DEFAULT 0.0,
        rank INTEGER,
        percentile REAL,
        participant_count INTEGER,
        source TEXT DEFAULT 'COACH',
        status TEXT DEFAULT 'COMPLETED',
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_attempt_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        question_count INTEGER DEFAULT 0,
        correct INTEGER DEFAULT 0,
        wrong INTEGER DEFAULT 0,
        blank INTEGER DEFAULT 0,
        net REAL DEFAULT 0.0,
        success_rate REAL DEFAULT 0.0,
        duration_minutes INTEGER DEFAULT 0,
        FOREIGN KEY (exam_attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_topic_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_attempt_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        curriculum_topic_id INTEGER NOT NULL,
        question_count INTEGER DEFAULT 0,
        correct INTEGER DEFAULT 0,
        wrong INTEGER DEFAULT 0,
        blank INTEGER DEFAULT 0,
        net REAL DEFAULT 0.0,
        success_rate REAL DEFAULT 0.0,
        priority_score INTEGER DEFAULT 0,
        confidence_level TEXT DEFAULT 'MEDIUM',
        FOREIGN KEY (exam_attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id),
        FOREIGN KEY (curriculum_topic_id) REFERENCES topics(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_question_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_attempt_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        curriculum_topic_id INTEGER,
        question_number INTEGER NOT NULL,
        student_answer TEXT,
        correct_answer TEXT,
        result TEXT NOT NULL,
        error_type TEXT DEFAULT 'OTHER',
        duration_seconds INTEGER DEFAULT 0,
        confidence_level TEXT DEFAULT 'MEDIUM',
        note TEXT,
        FOREIGN KEY (exam_attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id),
        FOREIGN KEY (curriculum_topic_id) REFERENCES topics(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_attempt_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        curriculum_topic_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        priority TEXT DEFAULT 'HIGH',
        description TEXT,
        status TEXT DEFAULT 'PROPOSED',
        created_by INTEGER,
        approved_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam_attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (curriculum_topic_id) REFERENCES topics(id)
    );
    """)

    # 25. Risk Scores
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS risk_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL UNIQUE,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('GREEN', 'YELLOW', 'ORANGE', 'RED')),
        reasons_json TEXT,
        net_trend_direction TEXT DEFAULT 'STABLE',
        inactivity_days INTEGER DEFAULT 0,
        late_assignments_count INTEGER DEFAULT 0,
        last_evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    # 26. Books
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        page_count INTEGER DEFAULT 0,
        current_page INTEGER DEFAULT 0,
        status TEXT DEFAULT 'READING',
        start_date DATE,
        finish_date DATE,
        rating INTEGER DEFAULT 0,
        review TEXT,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    """)

    # 27. Kaynak Havuzu (Resource Pool & Library Management Engine)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_type TEXT DEFAULT 'COACH' CHECK(owner_type IN ('SYSTEM', 'COACH')),
        owner_id INTEGER,
        name TEXT NOT NULL,
        publisher TEXT,
        exam_system TEXT NOT NULL DEFAULT 'YKS' CHECK(exam_system IN ('YKS', 'LGS')),
        exam_type TEXT DEFAULT 'TYT',
        field TEXT DEFAULT 'ALL',
        subject_id INTEGER NOT NULL,
        resource_type TEXT DEFAULT 'Soru Bankası',
        isbn TEXT,
        edition TEXT,
        description TEXT,
        status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(subject_id) REFERENCES subjects(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id INTEGER NOT NULL,
        curriculum_topic_id INTEGER NOT NULL,
        chapter_name TEXT,
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY(curriculum_topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        coach_id INTEGER NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
        progress_percentage REAL DEFAULT 0.0,
        UNIQUE(resource_id, student_id),
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(coach_id) REFERENCES coaches(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_topic_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_assignment_id INTEGER NOT NULL,
        curriculum_topic_id INTEGER NOT NULL,
        status TEXT DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
        completed_at TIMESTAMP,
        note TEXT,
        UNIQUE(resource_assignment_id, curriculum_topic_id),
        FOREIGN KEY(resource_assignment_id) REFERENCES resource_assignments(id) ON DELETE CASCADE,
        FOREIGN KEY(curriculum_topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    """)

    # 27b. Resource Suggestions (Admin Öneri & Genel Havuz Onay Sistemi)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resource_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        coach_user_id INTEGER NOT NULL,
        coach_name TEXT NOT NULL,
        coach_resource_id INTEGER NOT NULL,
        resource_title TEXT NOT NULL,
        publisher TEXT,
        subject_id INTEGER NOT NULL,
        subject_name TEXT,
        exam_system TEXT DEFAULT 'YKS',
        exam_type TEXT DEFAULT 'TYT',
        field TEXT DEFAULT 'ALL',
        resource_type TEXT DEFAULT 'Soru Bankası',
        status TEXT DEFAULT 'BEKLİYOR' CHECK(status IN ('BEKLİYOR', 'ONAYLANDI', 'REDDEDİLDİ')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
        FOREIGN KEY (coach_resource_id) REFERENCES resources(id) ON DELETE CASCADE
    );
    """)

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN origin_resource_id INTEGER;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN suggestion_status TEXT DEFAULT 'YOK';")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN suggested_by_coach_id INTEGER;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN total_pages INTEGER DEFAULT 0;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resources ADD COLUMN publication_year INTEGER;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE resource_suggestions ADD COLUMN rejection_reason TEXT;")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE publishers ADD COLUMN status TEXT DEFAULT 'ACTIVE';")
    except Exception:
        pass

    # 27. Messages (Native Modern Chat Experience - No External WhatsApp Dependencies)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message_type TEXT DEFAULT 'TEXT' CHECK(message_type IN ('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'SYSTEM', 'RESOURCE', 'ASSIGNMENT', 'STUDY_PLAN')),
        content TEXT NOT NULL,
        attachment_url TEXT,
        file_name TEXT,
        file_size TEXT,
        reply_to_id INTEGER,
        is_read INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        edited_at TIMESTAMP,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversation_settings (
        user_id INTEGER NOT NULL,
        with_user_id INTEGER NOT NULL,
        is_muted INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, with_user_id)
    );
    """)

    # 29. Weekly Programs (Real Grid Table: Student, Coach, Date, Time, Subject, Topic, Resource, Status)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weekly_programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        created_by_coach_id INTEGER,
        date DATE NOT NULL,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT NOT NULL,
        subject_id INTEGER,
        curriculum_topic_id INTEGER,
        resource_id INTEGER,
        assignment_id INTEGER,
        study_type TEXT DEFAULT 'Konu Çalışması',
        description TEXT,
        status TEXT DEFAULT 'PLANLANDI' CHECK(status IN ('PLANLANDI', 'DEVAM_EDIYOR', 'TAMAMLANDI', 'ATLANDI')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_coach_id) REFERENCES coaches(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id),
        FOREIGN KEY (curriculum_topic_id) REFERENCES curriculum(id),
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL,
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL
    );
    """)

    # 30. Activity Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        metadata_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Performance Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_students_coach_id ON students(coach_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_weekly_programs_student_date ON weekly_programs(student_id, date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_assignments_student_status ON assignments(student_id, status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mock_exams_student ON mock_exams(student_id);")

    conn.commit()
    conn.close()
    print("Database schema created.")

    ensure_lgs_seeded()

def ensure_lgs_seeded():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Schema Migrations (Add missing columns to existing tables)
    for table, col in [
        ('users', "username TEXT"),
        ('users', "surname TEXT"),
        ('users', "must_change_password INTEGER DEFAULT 0"),
        ('users', "last_login_at TIMESTAMP"),
        ('users', "password_changed_at TIMESTAMP"),
        ('users', "failed_login_attempts INTEGER DEFAULT 0"),
        ('users', "lockout_until TIMESTAMP"),
        ('users', "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ('students', "exam_system TEXT DEFAULT 'YKS'"),
        ('students', "created_by_coach_id INTEGER"),
        ('curriculum', "exam_system TEXT DEFAULT 'YKS'"),
        ('resources', "exam_system TEXT DEFAULT 'YKS'"),
        ('resources', "visibility TEXT DEFAULT 'GLOBAL'"),
        ('resources', "owner_coach_id INTEGER"),
        ('resources', "created_by_user_id INTEGER"),
        ('resources', "description TEXT"),
        ('resources', "author TEXT"),
        ('resources', "url TEXT"),
        ('resources', "notes TEXT"),
        ('resources', "status TEXT DEFAULT 'ACTIVE'"),
        ('mock_exams', "exam_system TEXT DEFAULT 'YKS'"),
        ('mock_exams', "created_by_coach_id INTEGER"),
        ('subjects', "exam_system TEXT DEFAULT 'YKS'"),
        ('assignments', "created_by_coach_id INTEGER"),
        ('assignments', "start_date DATE"),
        ('assignments', "completed_count INTEGER DEFAULT 0"),
        ('assignments', "coach_note TEXT"),
        ('study_plans', "created_by_coach_id INTEGER"),
        ('weekly_programs', "week_start_date TEXT"),
        ('weekly_programs', "publication_status TEXT DEFAULT 'PUBLISHED'"),
        ('weekly_programs', "completion_status TEXT DEFAULT 'PLANNED'"),
        ('weekly_programs', "assignment_id INTEGER"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col};")
        except sqlite3.OperationalError:
            pass

    # Migration for nullable email in existing databases
    try:
        cursor.execute("PRAGMA table_info(users);")
        cols = [dict(c) for c in cursor.fetchall()]
        email_col = next((c for c in cols if c['name'] == 'email'), None)
        if email_col and email_col['notnull'] == 1:
            cursor.execute("PRAGMA foreign_keys=OFF;")
            cursor.execute("DROP TABLE IF EXISTS users_new;")
            cursor.execute("""
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('ADMIN', 'COACH', 'STUDENT')),
                name TEXT NOT NULL,
                surname TEXT,
                phone TEXT,
                status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
                must_change_password INTEGER DEFAULT 0,
                last_login_at TIMESTAMP,
                password_changed_at TIMESTAMP,
                failed_login_attempts INTEGER DEFAULT 0,
                lockout_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );
            """)
            cursor.execute("""
            INSERT INTO users_new (id, username, email, password_hash, role, name, surname, phone, status, must_change_password, last_login_at, created_at, deleted_at)
            SELECT id, username, email, password_hash, role, name, surname, phone, status, must_change_password, last_login_at, created_at, deleted_at FROM users;
            """)
            cursor.execute("DROP TABLE users;")
            cursor.execute("ALTER TABLE users_new RENAME TO users;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            conn.commit()
    except Exception as e:
        print("Nullable email migration notice:", e)

    # Ensure usernames exist for all users
    cursor.execute("UPDATE users SET username = LOWER(SUBSTR(email, 1, INSTR(email, '@') - 1)) WHERE (username IS NULL OR username = '') AND email IS NOT NULL;")
    cursor.execute("UPDATE users SET username = 'admin' WHERE (email LIKE 'admin%' OR username = 'admin') AND (username IS NULL OR username = '');")
    
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);")
    except Exception:
        pass

    # Seed Sample Weekly Programs if empty
    cursor.execute("SELECT COUNT(*) as count FROM weekly_programs;")
    wp_cnt = cursor.fetchone()['count']
    if wp_cnt == 0:
        sample_programs = [
            # Student 1 (Burak Akcan - YKS)
            (1, 1, '2026-08-17', 'Pazartesi', '08:00', '09:00', 'Polinomlar Konu Anlatımı', 1, 1, 1, 'Konu Çalışması', '3D AYT Matematik Test 1-3 çözülecek.', 'DEVAM_EDIYOR'),
            (1, 1, '2026-08-17', 'Pazartesi', '10:00', '11:00', 'Paragraf Soru Çözümü', 2, None, None, 'Soru Çözümü', 'Günlük 40 paragraf sorusu.', 'TAMAMLANDI'),
            (1, 1, '2026-08-18', 'Salı', '09:00', '10:30', 'Fizik Vektörler Etüdü', 3, None, None, 'Etüt', 'Vektörler ve Kuvvet Dengesi tekrarı.', 'PLANLANDI'),
            (1, 1, '2026-08-19', 'Çarşamba', '18:00', '19:30', 'TYT Genel Deneme Çözümü', None, None, None, 'Deneme Çözümü', 'Kurumsal TYT Denemesi #4.', 'PLANLANDI'),
            (1, 1, '2026-08-20', 'Perşembe', '14:00', '15:30', 'Kimya Mol Kavramı', 4, None, None, 'Soru Çözümü', 'Soru Bankası sayfa 45-60.', 'PLANLANDI'),
            
            # Student 11 (Ayşe Demir - LGS)
            (11, 1, '2026-08-17', 'Pazartesi', '09:00', '10:00', 'LGS Çarpanlar ve Katlar', 23, 50, None, 'Konu Çalışması', 'MEB 8. Sınıf Matematik 1. Ünite', 'TAMAMLANDI'),
            (11, 1, '2026-08-18', 'Salı', '11:00', '12:00', 'LGS Fiilimsiler Soru Çözümü', 19, None, None, 'Soru Çözümü', 'Fiilimsiler 50 soru testi', 'DEVAM_EDIYOR'),
            (11, 1, '2026-08-19', 'Çarşamba', '15:00', '16:00', 'LGS Fen Mevsimler ve İklim', 24, None, None, 'Konu Çalışması', 'Dünyanın Dönme Ekseni ve Mevsimler', 'PLANLANDI')
        ]
        for wp in sample_programs:
            cursor.execute("""
            INSERT INTO weekly_programs (student_id, created_by_coach_id, date, day_of_week, start_time, end_time, title, subject_id, curriculum_topic_id, resource_id, study_type, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, wp)

    # 2. Check if LGS curriculum exists
    cursor.execute("SELECT COUNT(*) as count FROM curriculum WHERE exam_system = 'LGS';")
    lgs_curr_cnt = cursor.fetchone()['count']

    if lgs_curr_cnt == 0:
        print("Seeding LGS MEB 2026-2027 Curriculum & Resources...")
        
        # Seed LGS Subjects
        lgs_subjects = [
            ('LGS Türkçe', 'TYT', 20, 101),
            ('LGS T.C. İnkılap Tarihi ve Atatürkçülük', 'TYT', 10, 102),
            ('LGS Din Kültürü ve Ahlak Bilgisi', 'TYT', 10, 103),
            ('LGS Yabancı Dil (İngilizce)', 'TYT', 10, 104),
            ('LGS Matematik', 'TYT', 20, 105),
            ('LGS Fen Bilimleri', 'TYT', 20, 106),
        ]
        sub_map = {}
        for sname, etype, qcnt, sorder in lgs_subjects:
            cursor.execute("SELECT id FROM subjects WHERE name = ?;", (sname,))
            srow = cursor.fetchone()
            if not srow:
                cursor.execute("INSERT INTO subjects (name, exam_type, question_count, sort_order, exam_system) VALUES (?, ?, ?, ?, 'LGS');",
                               (sname, etype, qcnt, sorder))
                sid = cursor.lastrowid
            else:
                sid = srow['id']
            sub_map[sname] = sid

        # Seed LGS Exam Subjects
        for sitem in lgs_subjects:
            sname = sitem[0]
            sid = sub_map[sname]
            cursor.execute("INSERT OR IGNORE INTO exam_subjects (exam_type, field, subject_id, display_order, question_count, is_active) VALUES ('LGS', 'LGS', ?, ?, ?, 1);",
                           (sid, sitem[3], sitem[2]))

        # Seed LGS Curriculum Topics
        lgs_curriculum_seed = [
            # TÜRKÇE (20 Soru)
            ('TYT', 'ORTAK', 'Türkçe', 'Fiilimsiler', 1),
            ('TYT', 'ORTAK', 'Türkçe', 'Sözcükte Anlam', 2),
            ('TYT', 'ORTAK', 'Türkçe', 'Cümlede Anlam', 3),
            ('TYT', 'ORTAK', 'Türkçe', 'Paragrafta Anlam', 4),
            ('TYT', 'ORTAK', 'Türkçe', 'Söz Sanatları & Metin Türleri', 5),
            ('TYT', 'ORTAK', 'Türkçe', 'Yazım Kuralları', 6),
            ('TYT', 'ORTAK', 'Türkçe', 'Noktalama İşaretleri', 7),
            ('TYT', 'ORTAK', 'Türkçe', 'Cümlenin Ögeleri', 8),
            ('TYT', 'ORTAK', 'Türkçe', 'Cümle Türleri', 9),
            ('TYT', 'ORTAK', 'Türkçe', 'Fiilde Çatı', 10),
            ('TYT', 'ORTAK', 'Türkçe', 'Anlatım Bozuklukları', 11),
            ('TYT', 'ORTAK', 'Türkçe', 'Görsel Okuma & Sözel Mantık', 12),

            # İNKILAP TARİHİ (10 Soru)
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Bir Kahraman Doğuyor', 1),
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Milli Uyanış: Bağımsızlık Yolunda Atılan Adımlar', 2),
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Milli Bir Destan: Ya İstiklal Ya Ölüm!', 3),
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Atatürkçülük ve Çağdaşlaşan Türkiye', 4),
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Demokratikleşme Çabaları', 5),
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Atatürk Dönemi Türk Dış Politikası', 6),
            ('TYT', 'ORTAK', 'T.C. İnkılap Tarihi ve Atatürkçülük', "Atatürk'ün Ölümü ve Sonrası", 7),

            # DİN KÜLTÜRÜ (10 Soru)
            ('TYT', 'ORTAK', 'Din Kültürü ve Ahlak Bilgisi', 'Kader İnancı', 1),
            ('TYT', 'ORTAK', 'Din Kültürü ve Ahlak Bilgisi', 'Zekat ve Sadaka', 2),
            ('TYT', 'ORTAK', 'Din Kültürü ve Ahlak Bilgisi', 'Din ve Hayat', 3),
            ('TYT', 'ORTAK', 'Din Kültürü ve Ahlak Bilgisi', "Hz. Muhammed'in Örnekliği", 4),
            ('TYT', 'ORTAK', 'Din Kültürü ve Ahlak Bilgisi', "Kur'an-ı Kerim ve Temel Özellikleri", 5),

            # İNGİLİZCE (10 Soru)
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Friendship', 1),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Teen Life', 2),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'In the Kitchen', 3),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'On the Phone', 4),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'The Internet', 5),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Adventures', 6),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Tourism', 7),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Chores', 8),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Science', 9),
            ('TYT', 'ORTAK', 'Yabancı Dil (İngilizce)', 'Natural Forces', 10),

            # MATEMATİK (20 Soru)
            ('TYT', 'ORTAK', 'Matematik', 'Çarpanlar ve Katlar', 1),
            ('TYT', 'ORTAK', 'Matematik', 'Üslü İfadeler', 2),
            ('TYT', 'ORTAK', 'Matematik', 'Kareköklü İfadeler', 3),
            ('TYT', 'ORTAK', 'Matematik', 'Veri Analizi', 4),
            ('TYT', 'ORTAK', 'Matematik', 'Basit Olayların Olma Olasılığı', 5),
            ('TYT', 'ORTAK', 'Matematik', 'Cebirsel İfadeler ve Özdeşlikler', 6),
            ('TYT', 'ORTAK', 'Matematik', 'Doğrusal Denklemler', 7),
            ('TYT', 'ORTAK', 'Matematik', 'Eşitsizlikler', 8),
            ('TYT', 'ORTAK', 'Matematik', 'Üçgenler', 9),
            ('TYT', 'ORTAK', 'Matematik', 'Eşlik ve Benzerlik', 10),
            ('TYT', 'ORTAK', 'Matematik', 'Dönüşüm Geometrisi', 11),
            ('TYT', 'ORTAK', 'Matematik', 'Geometrik Cisimler', 12),

            # FEN BİLİMLERİ (20 Soru)
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'Mevsimler ve İklim', 1),
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'DNA ve Genetik Kod', 2),
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'Basınç', 3),
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'Madde ve Endüstri', 4),
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'Basit Makineler', 5),
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'Enerji Dönüşümleri ve Çevre Bilimi', 6),
            ('TYT', 'ORTAK', 'Fen Bilimleri', 'Elektrik Yükleri ve Elektrik Enerjisi', 7),
        ]

        for etype, ffield, sub, top, order in lgs_curriculum_seed:
            cursor.execute("""
            INSERT INTO curriculum (exam_type, field, subject, topic, display_order, active, exam_system)
            VALUES (?, ?, ?, ?, ?, 1, 'LGS');
            """, (etype, ffield, sub, top, order))

        # Seed LGS Resources
        lgs_resources = [
            ('3D 8. Sınıf LGS Matematik Soru Bankası', '3D Yayınları', 'LGS Matematik', 'TYT', 'SAYISAL', 'SORU_BANKASI', 'ILERI', 1200),
            ('Bilgi Sarmal 8. Sınıf LGS Fen Bilimleri', 'Bilgi Sarmal', 'LGS Fen Bilimleri', 'TYT', 'SAYISAL', 'SORU_BANKASI', 'ORTA', 1100),
            ('Orijinal 8. Sınıf LGS Türkçe Soru Bankası', 'Orijinal Yayınları', 'LGS Türkçe', 'TYT', 'SAYISAL', 'SORU_BANKASI', 'ORTA', 1000),
            ('MEB 8. Sınıf LGS Çalışma Fasikülleri', 'MEB Yayınları', 'LGS Matematik', 'TYT', 'SAYISAL', 'MEB_KITABI', 'ORTA', 800),
        ]
        for title, pub, sname, etype, track, rtype, level, qcnt in lgs_resources:
            cursor.execute("SELECT id FROM publishers WHERE name LIKE ? LIMIT 1;", (f"%{pub}%",))
            prow = cursor.fetchone()
            pid = prow['id'] if prow else 1

            cursor.execute("SELECT id FROM subjects WHERE name = ? AND exam_system = 'LGS' LIMIT 1;", (sname,))
            srow = cursor.fetchone()
            sid = srow['id'] if srow else 1

            cursor.execute("""
            INSERT INTO resources (publisher_id, title, name, owner_type, subject_id, exam_type, track, resource_type, level, total_questions, exam_system)
            VALUES (?, ?, ?, 'SYSTEM', ?, ?, ?, ?, ?, ?, 'LGS');
            """, (pid, title, title, sid, etype, track, rtype, level, qcnt))

        # Seed Demo LGS Students
        student_pw = werkzeug.security.generate_password_hash("ogrenci123")
        cursor.execute("SELECT id FROM coaches LIMIT 1;")
        coach_row = cursor.fetchone()
        cid = coach_row['id'] if coach_row else 1

        lgs_students_demo = [
            ('Ayşe Demir', 'ayse.demir@lgs.com', '8. Sınıf', 'Özel Bilim Ortaokulu', cid),
            ('Zeynep Ak', 'zeynep.ak@lgs.com', '8. Sınıf', 'Atatürk Ortaokulu', cid)
        ]

        for name, email, grade, school, coach_id in lgs_students_demo:
            cursor.execute("SELECT id FROM users WHERE email = ?;", (email,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'STUDENT', ?);", (email, student_pw, name))
                uid = cursor.lastrowid
                cursor.execute("""
                INSERT INTO students (user_id, coach_id, grade, track, school, exam_system, start_date)
                VALUES (?, ?, ?, 'SAYISAL', ?, 'LGS', DATE('now', '-30 days'));
                """, (uid, coach_id, grade, school))
                sid = cursor.lastrowid
                cursor.execute("""
                INSERT INTO coach_student_relationships (coach_id, student_id, relationship_type, status, assigned_by)
                VALUES (?, ?, 'MAIN_COACH', 'ACTIVE', 1);
                """, (coach_id, sid))

    conn.commit()
    conn.close()
    print("ensure_lgs_seeded() finished successfully.")

def seed_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM users;")
    if cursor.fetchone()['count'] > 0:
        print("Database already seeded.")
        conn.close()
        return

    admin_pw = werkzeug.security.generate_password_hash("admin123")
    coach_pw = werkzeug.security.generate_password_hash("koc123")
    student_pw = werkzeug.security.generate_password_hash("ogrenci123")

    # 1. Admin
    cursor.execute("INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, 'ADMIN', 'Sistem Yöneticisi', '05001112233');", ("admin@ykskocluk.com", admin_pw))
    admin_user_id = cursor.lastrowid

    # 2. Coaches
    cursor.execute("INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, 'COACH', 'Ümmü Akcan', '05321002030');", ("ummu.akcan@ykskocluk.com", coach_pw))
    coach_id_1_user = cursor.lastrowid
    cursor.execute("INSERT INTO coaches (user_id, title, bio, specialty, coach_code) VALUES (?, 'Kıdemli YKS Derece Koçu', '10+ yıl derece öğrencisi koçluğu tecrübesi', 'Sayısal & EA Derece', 'UMMU-2026');", (coach_id_1_user,))
    coach_1_id = cursor.lastrowid

    cursor.execute("INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, 'COACH', 'Ahmet Yılmaz', '05332003040');", ("ahmet.yilmaz@ykskocluk.com", coach_pw))
    coach_id_2_user = cursor.lastrowid
    cursor.execute("INSERT INTO coaches (user_id, title, bio, specialty, coach_code) VALUES (?, 'Akademik Danışman & Matematik Koçu', 'MEB Müfredatı ve Sınav Stratejileri', 'Matematik & Geometri Specialist', 'AHMET-2026');", (coach_id_2_user,))
    coach_2_id = cursor.lastrowid

    # 3. Curriculum Version
    cursor.execute("INSERT INTO curriculum_versions (name, academic_year, exam_year, is_active) VALUES ('2026-2027 MEB / Türkiye Yüzyılı Maarif Modeli', '2026-2027', 2027, 1);")
    curr_ver_id = cursor.lastrowid

    # 4. Subjects
    subjects_data = [
        ('Türkçe', 'TYT', 40, 1),
        ('Matematik', 'TYT', 40, 2),
        ('Geometri', 'TYT', 10, 3),
        ('Fizik', 'TYT', 7, 4),
        ('Kimya', 'TYT', 7, 5),
        ('Biyoloji', 'TYT', 6, 6),
        ('Tarih', 'TYT', 5, 7),
        ('Coğrafya', 'TYT', 5, 8),
        ('Felsefe', 'TYT', 5, 9),
        ('Din Kültürü', 'TYT', 5, 10),
        ('AYT Matematik', 'AYT', 30, 11),
        ('AYT Geometri', 'AYT', 10, 12),
        ('AYT Fizik', 'AYT', 14, 13),
        ('AYT Kimya', 'AYT', 13, 14),
        ('AYT Biyoloji', 'AYT', 13, 15),
        ('Türk Dili ve Edebiyatı', 'AYT', 24, 16),
        ('Tarih-1', 'AYT', 10, 17),
        ('Coğrafya-1', 'AYT', 6, 18),
        ('Tarih-2', 'AYT', 11, 19),
        ('Coğrafya-2', 'AYT', 11, 20),
        ('Felsefe Grubu', 'AYT', 12, 21),
        ('İngilizce', 'YDT', 80, 22),
    ]

    subject_map = {}
    for name, etype, qcnt, sorder in subjects_data:
        cursor.execute("INSERT INTO subjects (name, exam_type, question_count, sort_order) VALUES (?, ?, ?, ?);", (name, etype, qcnt, sorder))
        subject_map[name] = cursor.lastrowid

    # Seed exam_subjects for dynamic exam setup
    exam_subjects_seed = [
        # TYT ORTAK (10 Subjects)
        ('TYT', 'ORTAK', 'Türkçe', 1, 40),
        ('TYT', 'ORTAK', 'Matematik', 2, 30),
        ('TYT', 'ORTAK', 'Geometri', 3, 10),
        ('TYT', 'ORTAK', 'Fizik', 4, 7),
        ('TYT', 'ORTAK', 'Kimya', 5, 7),
        ('TYT', 'ORTAK', 'Biyoloji', 6, 6),
        ('TYT', 'ORTAK', 'Tarih', 7, 5),
        ('TYT', 'ORTAK', 'Coğrafya', 8, 5),
        ('TYT', 'ORTAK', 'Felsefe', 9, 5),
        ('TYT', 'ORTAK', 'Din Kültürü', 10, 5),

        # AYT SAYISAL
        ('AYT', 'SAYISAL', 'AYT Matematik', 1, 30),
        ('AYT', 'SAYISAL', 'AYT Geometri', 2, 10),
        ('AYT', 'SAYISAL', 'AYT Fizik', 3, 14),
        ('AYT', 'SAYISAL', 'AYT Kimya', 4, 13),
        ('AYT', 'SAYISAL', 'AYT Biyoloji', 5, 13),

        # AYT EA
        ('AYT', 'EA', 'AYT Matematik', 1, 30),
        ('AYT', 'EA', 'AYT Geometri', 2, 10),
        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 3, 24),
        ('AYT', 'EA', 'Tarih-1', 4, 10),
        ('AYT', 'EA', 'Coğrafya-1', 5, 6),

        # AYT SOZEL
        ('AYT', 'SOZEL', 'Türk Dili ve Edebiyatı', 1, 24),
        ('AYT', 'SOZEL', 'Tarih-1', 2, 10),
        ('AYT', 'SOZEL', 'Coğrafya-1', 3, 6),
        ('AYT', 'SOZEL', 'Tarih-2', 4, 11),
        ('AYT', 'SOZEL', 'Coğrafya-2', 5, 11),
        ('AYT', 'SOZEL', 'Felsefe Grubu', 6, 12),

        # YDT
        ('YDT', 'DIL', 'İngilizce', 1, 80),
    ]

    for etype, field, sub_name, order, qcnt in exam_subjects_seed:
        if sub_name in subject_map:
            cursor.execute("""
            INSERT INTO exam_subjects (exam_type, field, subject_id, display_order, question_count, is_active)
            VALUES (?, ?, ?, ?, ?, 1);
            """, (etype, field, subject_map[sub_name], order, qcnt))

    # 5. Topics
    topics_seed = [
        ('Türkçe', 'Anlam Bilgisi', 'Sözcükte Anlam'),
        ('Türkçe', 'Anlam Bilgisi', 'Cümlede Anlam'),
        ('Türkçe', 'Anlam Bilgisi', 'Paragrafta Ana Fikir & Yapı'),
        ('Türkçe', 'Dil Bilgisi', 'Ses Bilgisi'),
        ('Türkçe', 'Dil Bilgisi', 'Yazım Kuralları & Noktalama'),
        ('Türkçe', 'Dil Bilgisi', 'Cümlenin Ögeleri'),
        
        ('Matematik', 'Temel Matematik', 'Temel Kavramlar & Sayı Basamakları'),
        ('Matematik', 'Temel Matematik', 'Bölme, Bölünebilme & EBOB-EKOK'),
        ('Matematik', 'Temel Matematik', 'Rasyonel Sayılar & Basit Eşitsizlikler'),
        ('Matematik', 'Temel Matematik', 'Üslü ve Köklü İfadeler'),
        ('Matematik', 'Temel Matematik', 'Oran-Orantı'),
        ('Matematik', 'Problemler', 'Sayı & Kesir Problemleri'),
        ('Matematik', 'Problemler', 'Yaş & İşçi-Havuz Problemleri'),
        ('Matematik', 'Problemler', 'Hız & Yüzde-Kâr-Zarar Problemleri'),
        ('Matematik', 'Problemler', 'Grafik & Rutin Olmayan Problemler'),
        ('Matematik', 'Cebir', 'Fonksiyonlar & Polinomlar'),

        ('Geometri', 'Üçgenler', 'Doğruda ve Üçgende Açılar'),
        ('Geometri', 'Üçgenler', 'Dik ve Özel Üçgenler'),
        ('Geometri', 'Üçgenler', 'Üçgende Alan ve Benzerlik'),
        ('Geometri', 'Dörtgenler', 'Paralelkenar ve Eşkenar Dörtgen'),
        ('Geometri', 'Dörtgenler', 'Kare ve Dikdörtgen'),
        ('Geometri', 'Çember & Analitik', 'Çemberde Açı ve Uzunluk'),
        ('Geometri', 'Çember & Analitik', 'Noktanın ve Doğrunun Analitiği'),

        ('AYT Matematik', 'İleri Cebir', 'Polinomlar & 2. Dereceden Denklemler'),
        ('AYT Matematik', 'İleri Cebir', 'Karmaşık Sayılar & Parabol'),
        ('AYT Matematik', 'İleri Cebir', 'Eşitsizlik Sistemleri'),
        ('AYT Matematik', 'Trigonometri', 'Trigonometrik Fonksiyonlar & Özdeşlikler'),
        ('AYT Matematik', 'Trigonometri', 'Toplam-Fark ve İki Kat Açı Formülleri'),
        ('AYT Matematik', 'Logaritma & Diziler', 'Logaritma Fonksiyonu ve Denklemler'),
        ('AYT Matematik', 'Logaritma & Diziler', 'Aritmetik ve Geometrik Diziler'),
        ('AYT Matematik', 'Analiz', 'Limit ve Süreklilik'),
        ('AYT Matematik', 'Analiz', 'Türev ve Uygulamaları (Teğet, Tepe Noktası)'),
        ('AYT Matematik', 'Analiz', 'İntegral ve Alan Hesabı'),

        ('AYT Fizik', 'Mekanik', 'Vektörler & Tork-Denge'),
        ('AYT Fizik', 'Mekanik', 'Kütle Merkezi & Basit Makineler'),
        ('AYT Fizik', 'Mekanik', 'Bir Boyutta ve İki Boyutta Hareket'),
        ('AYT Fizik', 'Mekanik', 'İtme ve Momentum'),
        ('AYT Fizik', 'Elektrik & Manyetizma', 'Elektriksel Alan ve Potansiyel'),
        ('AYT Fizik', 'Elektrik & Manyetizma', 'Manyetik Alan ve İndüksiyon'),
        ('AYT Fizik', 'Dalgalar & Modern Fizik', 'Çembersel Hareket & Basit Harmonik Hareket'),
        ('AYT Fizik', 'Dalgalar & Modern Fizik', 'Fotoelektrik Olay & Modern Fizik'),

        ('Türk Dili ve Edebiyatı', 'Edebi Sanatlar', 'Şiir Bilgisi & Edebi Sanatlar'),
        ('Türk Dili ve Edebiyatı', 'İslamiyet Öncesi & Halk', 'Divan Edebiyatı Şairleri'),
        ('Türk Dili ve Edebiyatı', 'Tanzimat & Servet-i Fünun', 'Tanzimat ve Servet-i Fünun Romanı'),
        ('Türk Dili ve Edebiyatı', 'Cumhuriyet Dönemi', 'Cumhuriyet Dönemi Şiir ve Romanı'),
    ]

    topic_id_map = {}
    for sname, uname, tname in topics_seed:
        if sname in subject_map:
            cursor.execute("INSERT INTO topics (subject_id, unit_name, name, curriculum_version_id) VALUES (?, ?, ?, ?);", 
                           (subject_map[sname], uname, tname, curr_ver_id))
            topic_id_map[tname] = cursor.lastrowid

    # 6. Publishers
    publishers = [
        '3D Yayınları', 'Bilgi Sarmal', 'Karekök Yayınları', 'Apotemi', 'Orijinal Yayınları', 
        '345 Yayınları', 'Hız ve Renk', 'Benim Hocam', 'Acil Yayınları', 'Barış Yayınları', 
        'Aktif Yayınları', 'Şenol Hoca Yayınları', 'Kafa Dengi', 'Limit Yayınları', 'İlk Adım', 
        'Paraf Yayınları', 'Palme Yayınları', 'Aydın Yayınları', 'Ertem Sinan Şahin', 'Biyotik', 
        'FDD Yayınları', 'Eyüp B.', 'Metin Yayınları', 'YDS Publishing', 'Modadil', 'Pelikan', 
        'Speed-Up', 'MEB Yayınları', 'ÖSYM'
    ]
    pub_map = {}
    for p in publishers:
        cursor.execute("INSERT OR IGNORE INTO publishers (name) VALUES (?);", (p,))
        cursor.execute("SELECT id FROM publishers WHERE name = ?;", (p,))
        pub_map[p] = cursor.fetchone()['id']

    # 7. Resources Seed
    resources_seed = [
        ('3D TYT Matematik Soru Bankası', '3D Yayınları', 'Matematik', 'TYT', 'ALL', 'SORU_BANKASI', 'ILERI', 1500),
        ('Bilgi Sarmal TYT Türkçe Soru Bankası', 'Bilgi Sarmal', 'Türkçe', 'TYT', 'ALL', 'SORU_BANKASI', 'ORTA', 1400),
        ('Apotemi Türev Fasikülü', 'Apotemi', 'AYT Matematik', 'AYT', 'SAYISAL', 'FASIKUL', 'ILERI', 450),
        ('Apotemi İntegral Fasikülü', 'Apotemi', 'AYT Matematik', 'AYT', 'SAYISAL', 'FASIKUL', 'ILERI', 500),
        ('3D AYT Fizik Soru Bankası', '3D Yayınları', 'AYT Fizik', 'AYT', 'SAYISAL', 'SORU_BANKASI', 'ILERI', 1100),
        ('Limit Edebiyat Soru Bankası', 'Limit Yayınları', 'Türk Dili ve Edebiyatı', 'AYT', 'EA', 'SORU_BANKASI', 'ORTA', 1300),
        ('Orijinal AYT Matematik Soru Bankası', 'Orijinal Yayınları', 'AYT Matematik', 'AYT', 'SAYISAL', 'SORU_BANKASI', 'DERECE', 1600),
        ('MEB 12. Sınıf Matematik Ders Kitabı', 'MEB Yayınları', 'AYT Matematik', 'AYT', 'ALL', 'MEB_KITABI', 'BASLANGIC', 600),
    ]

    res_map = {}
    for title, pub, sname, etype, track, rtype, level, qcnt in resources_seed:
        pub_id = pub_map.get(pub, 1)
        sub_id = subject_map.get(sname, 1)
        cursor.execute("""
        INSERT INTO resources (publisher_id, title, name, owner_type, subject_id, exam_type, track, resource_type, level, total_questions)
        VALUES (?, ?, ?, 'SYSTEM', ?, ?, ?, ?, ?, ?);
        """, (pub_id, title, title, sub_id, etype, track, rtype, level, qcnt))
        res_map[title] = cursor.lastrowid

    # 7.B Seed Resource Sections (Mapping Resource Sections to Curriculum Topics)
    mat_3d_id = res_map['3D TYT Matematik Soru Bankası']
    turkce_bs_id = res_map['Bilgi Sarmal TYT Türkçe Soru Bankası']
    turev_apo_id = res_map['Apotemi Türev Fasikülü']
    integral_apo_id = res_map['Apotemi İntegral Fasikülü']

    sections_seed = [
        (mat_3d_id, topic_id_map.get('Temel Kavramlar & Sayı Basamakları', 1), 'Bölüm 1: Temel Kavramlar & Sayılar', 1, 30, 180),
        (mat_3d_id, topic_id_map.get('Bölme, Bölünebilme & EBOB-EKOK', 1), 'Bölüm 2: Bölünebilme & EBOB-EKOK', 31, 55, 140),
        (mat_3d_id, topic_id_map.get('Üslü ve Köklü İfadeler', 1), 'Bölüm 3: Üslü ve Köklü İfadeler', 56, 90, 200),
        (mat_3d_id, topic_id_map.get('Sayı & Kesir Problemleri', 1), 'Bölüm 4: Sayı ve Kesir Problemleri', 91, 130, 240),
        (mat_3d_id, topic_id_map.get('Yaş & İşçi-Havuz Problemleri', 1), 'Bölüm 5: Yaş ve İşçi Problemleri', 131, 160, 160),
        (mat_3d_id, topic_id_map.get('Hız & Yüzde-Kâr-Zarar Problemleri', 1), 'Bölüm 6: Hız ve Yüzde Kar-Zarar Problemleri', 161, 200, 220),

        (turkce_bs_id, topic_id_map.get('Sözcükte Anlam', 1), 'Bölüm 1: Sözcükte Anlam Kavramı', 1, 25, 120),
        (turkce_bs_id, topic_id_map.get('Cümlede Anlam', 1), 'Bölüm 2: Cümlede Anlam ve Yorum', 26, 50, 150),
        (turkce_bs_id, topic_id_map.get('Paragrafta Ana Fikir & Yapı', 1), 'Bölüm 3: Paragrafta Ana Fikir & Düşünceyi Geliştirme', 51, 110, 320),
        (turkce_bs_id, topic_id_map.get('Yazım Kuralları & Noktalama', 1), 'Bölüm 4: Yazım Kuralları ve Noktalama İşaretleri', 111, 145, 180),

        (turev_apo_id, topic_id_map.get('Türev ve Uygulamaları (Teğet, Tepe Noktası)', 1), 'Fasikül Bölüm 1: Türev Alma Kuralları & Teğet', 1, 60, 220),
        (turev_apo_id, topic_id_map.get('Türev ve Uygulamaları (Teğet, Tepe Noktası)', 1), 'Fasikül Bölüm 2: Ekstremum ve Maksimum-Minimum', 61, 120, 230),

        (integral_apo_id, topic_id_map.get('İntegral ve Alan Hesabı', 1), 'Fasikül Bölüm 1: Belirsiz İntegral & Kurallar', 1, 50, 200),
        (integral_apo_id, topic_id_map.get('İntegral ve Alan Hesabı', 1), 'Fasikül Bölüm 2: Belirli İntegral ve Alan Hesabı', 51, 110, 300),
    ]

    sec_map = {}
    for rid, tid, stitle, pstart, pend, qcnt in sections_seed:
        cursor.execute("""
        INSERT INTO resource_sections (resource_id, topic_id, title, page_start, page_end, question_count)
        VALUES (?, ?, ?, ?, ?, ?);
        """, (rid, tid, stitle, pstart, pend, qcnt))
        sec_map[stitle] = cursor.lastrowid

    # 8. Demo Students & Many-to-Many Relationships Seed
    students_demo = [
        ('Burak Akcan', 'burak.akcan@student.com', 'SAYISAL', 'Fen Lisesi', 'İTÜ', 'Bilgisayar Mühendisliği', 520.0, 1500, coach_1_id),
        ('Elif Yılmaz', 'elif.yilmaz@student.com', 'SAYISAL', 'Anadolu Lisesi', 'ODTÜ', 'Elektrik-Elektronik Müh.', 510.0, 2500, coach_1_id),
        ('Mert Demir', 'mert.demir@student.com', 'SAYISAL', 'Özel Kolej', 'Boğaziçi', 'Endüstri Mühendisliği', 525.0, 1000, coach_1_id),
        ('Zeynep Kaya', 'zeynep.kaya@student.com', 'EA', 'Anadolu Lisesi', 'Boğaziçi', 'İşletme', 480.0, 3000, coach_1_id),
        ('Can Öztürk', 'can.ozturk@student.com', 'EA', 'Atatürk Lisesi', 'Galatasaray', 'Hukuk', 490.0, 2000, coach_1_id),
        ('Ayşe Çelik', 'ayse.celik@student.com', 'SOZEL', 'Anadolu Lisesi', 'İstanbul Üniv.', 'Tarih / Öğretmenlik', 440.0, 5000, coach_2_id),
        ('Emre Arslan', 'emre.arslan@student.com', 'SOZEL', 'Sosyal Bilimler L.', 'Boğaziçi', 'Tarih', 460.0, 3500, coach_2_id),
        ('Selin Yıldız', 'selin.yildiz@student.com', 'YDT', 'Anadolu Lisesi', 'Boğaziçi', 'Mütercim Tercümanlık', 495.0, 1200, coach_2_id),
        ('Deniz Şahin', 'deniz.sahin@student.com', 'YDT', 'Özel Lise', 'Hacettepe', 'İngiliz Dil Bilimi', 475.0, 2800, coach_2_id),
        ('Kaan Tekin', 'kaan.tekin@student.com', 'SAYISAL', 'Fen Lisesi', 'Bilkent', 'Makine Mühendisliği', 515.0, 1800, coach_1_id),
    ]

    student_id_map = {}
    for name, email, track, school, uni, dept, tscore, trank, cid in students_demo:
        cursor.execute("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'STUDENT', ?);", (email, student_pw, name))
        uid = cursor.lastrowid
        cursor.execute("""
        INSERT INTO students (user_id, coach_id, track, school, target_university, target_department, target_score, target_rank, start_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE('now', '-60 days'));
        """, (uid, cid, track, school, uni, dept, tscore, trank))
        sid = cursor.lastrowid
        student_id_map[name] = sid

        # Seed Primary Relationship (MAIN_COACH)
        cursor.execute("""
        INSERT INTO coach_student_relationships (coach_id, student_id, relationship_type, status, assigned_by)
        VALUES (?, ?, 'MAIN_COACH', 'ACTIVE', ?);
        """, (cid, sid, admin_user_id))

        # Profile Initial vs Current Nets
        initial_nets = {'TYT': 65.0, 'AYT': 35.0} if track != 'YDT' else {'TYT': 60.0, 'YDT': 55.0}
        current_nets = {'TYT': 88.5, 'AYT': 62.0} if track != 'YDT' else {'TYT': 78.0, 'YDT': 74.0}
        cursor.execute("INSERT INTO student_profiles (student_id, initial_nets_json, current_nets_json) VALUES (?, ?, ?);",
                       (sid, json.dumps(initial_nets), json.dumps(current_nets)))

        # Assign Specific Resources (Student Resources - NOT ALL RESOURCES ARE ASSIGNED)
        if name == 'Burak Akcan':
            assigned_res_list = [mat_3d_id, turkce_bs_id, turev_apo_id]
        elif track == 'SAYISAL':
            assigned_res_list = [mat_3d_id, turev_apo_id, integral_apo_id]
        else:
            assigned_res_list = [turkce_bs_id]

        for rid in assigned_res_list:
            cursor.execute("""
            INSERT INTO student_resources (student_id, resource_id, assigned_by_coach_id, start_date, target_end_date, status, priority, coach_note, completion_percentage)
            VALUES (?, ?, ?, DATE('now', '-30 days'), DATE('now', '+60 days'), 'IN_PROGRESS', 'YUKSEK', 'Konu anlatımları bittikçe testleri sırayla temizle.', 62.0);
            """, (sid, rid, cid))
            s_res_id = cursor.lastrowid

            # Seed section progress for this student resource
            cursor.execute("SELECT id FROM resource_sections WHERE resource_id = ?;", (rid,))
            sec_rows = cursor.fetchall()
            for idx, srow in enumerate(sec_rows):
                s_status = 'COMPLETED' if idx < 3 else ('IN_PROGRESS' if idx == 3 else 'NOT_STARTED')
                cursor.execute("""
                INSERT INTO student_resource_section_progress (student_resource_id, section_id, status, completed_questions)
                VALUES (?, ?, ?, ?);
                """, (s_res_id, srow['id'], s_status, 120 if s_status == 'COMPLETED' else 0))

            # Seed Student Resource Topic Progress (Resource-based Curriculum Topic Tracking)
            cursor.execute("SELECT id, name FROM topics LIMIT 15;")
            topics_rows = cursor.fetchall()
            for t_idx, trow in enumerate(topics_rows):
                t_status = 'COMPLETED' if t_idx < 4 else ('IN_PROGRESS' if t_idx < 8 else ('REVIEW_REQUIRED' if t_idx == 8 else 'NOT_STARTED'))
                cursor.execute("""
                INSERT INTO student_resource_topic_progress (student_resource_id, topic_id, status, progress_percentage, marked_by, coach_approved)
                VALUES (?, ?, ?, ?, 'STUDENT', ?);
                """, (s_res_id, trow['id'], t_status, 100.0 if t_status == 'COMPLETED' else (65.0 if t_status == 'IN_PROGRESS' else 0.0), 1 if t_status == 'COMPLETED' else 0))

        # Seed Mock Exams Results
        for i in range(1, 6):
            exam_date = (date.today() - timedelta(days=i*10)).isoformat()
            cursor.execute("INSERT INTO mock_exams (title, exam_type, publisher) VALUES (?, 'TYT', 'ÖZDEBİR');", (f"Özdebir TYT Deneme {i}",))
            meid = cursor.lastrowid
            
            t_net = 25.0 + i * 2.0
            m_net = 20.0 + i * 2.5
            
            cursor.execute("""
            INSERT INTO mock_exam_results (student_id, mock_exam_id, subject_id, correct, incorrect, empty, net, exam_date, analysis_done)
            VALUES (?, ?, ?, ?, ?, 2, ?, ?, 1);
            """, (sid, meid, subject_map['Türkçe'], int(t_net + 4), 4, t_net, exam_date))

            cursor.execute("""
            INSERT INTO mock_exam_results (student_id, mock_exam_id, subject_id, correct, incorrect, empty, net, exam_date, analysis_done)
            VALUES (?, ?, ?, ?, ?, 2, ?, ?, 1);
            """, (sid, meid, subject_map['Matematik'], int(m_net + 4), 4, m_net, exam_date))

        risk_lvl = 'GREEN' if sid % 3 != 0 else ('YELLOW' if sid % 3 == 1 else 'ORANGE')
        reasons = ["Deneme netleri yükselişte (+4.5 net/ay)", "Program uyum oranı %88"] if risk_lvl == 'GREEN' else ["Son 2 denemede Matematik net düşüşü var", "Ödev teslimi 1 gün gecikmeli"]
        cursor.execute("""
        INSERT INTO risk_scores (student_id, risk_level, reasons_json, net_trend_direction, inactivity_days, late_assignments_count)
        VALUES (?, ?, ?, 'UPWARD', 0, 0);
        """, (sid, risk_lvl, json.dumps(reasons)))

        cursor.execute("""
        INSERT INTO books (student_id, title, author, total_pages, read_pages, rating_stars, status, start_date)
        VALUES (?, 'Nutuk', 'Mustafa Kemal Atatürk', 600, 450, 5, 'IN_PROGRESS', DATE('now', '-30 days'));
        """, (sid,))

        cursor.execute("INSERT INTO achievements (student_id, badge_code, badge_name, description) VALUES (?, 'FIRST_1000', '1.000 Soru Kulübü', '1000 adet soru çözüldü!');", (sid,))

    # Seed Secondary Subject Coach Relationships (Demonstrating MANY-TO-MANY)
    # Burak Akcan (Student 1) has Ahmet Yılmaz (Coach 2) as MATH_COACH
    cursor.execute("""
    INSERT INTO coach_student_relationships (coach_id, student_id, relationship_type, status, assigned_by)
    VALUES (?, ?, 'MATH_COACH', 'ACTIVE', ?);
    """, (coach_2_id, student_id_map['Burak Akcan'], admin_user_id))

    # Zeynep Kaya (Student 4) has Ümmü Akcan (Coach 1) as COUNSELOR
    cursor.execute("""
    INSERT INTO coach_student_relationships (coach_id, student_id, relationship_type, status, assigned_by)
    VALUES (?, ?, 'COUNSELOR', 'ACTIVE', ?);
    """, (coach_1_id, student_id_map['Zeynep Kaya'], admin_user_id))

    # Seed Coach Notes
    cursor.execute("""
    INSERT INTO coach_notes (coach_id, student_id, note, visibility)
    VALUES (?, ?, 'Öğrencinin Matematik Temel Kavramlar eksikleri kapatıldı. 3D TYT Matematik kitabına başlandı.', 'PRIVATE_TO_COACH');
    """, (coach_1_id, student_id_map['Burak Akcan']))

    # Seed Smart & Academic WhatsApp-style Messages
    # User 2: Ümmü Akcan (Coach 1), User 4: Burak Akcan (Student 1)
    # User 3: Ahmet Yılmaz (Coach 2), User 5: Elif Yılmaz (Student 2)
    cursor.execute("""
    INSERT INTO messages (sender_id, receiver_id, message_type, content, is_read, is_pinned, sent_at)
    VALUES
    (4, 2, 'TEXT', 'Merhaba Ümmü Hocam! Bugünkü çalışma programımı ve 3D TYT Matematik etüdümü tamamladım.', 1, 0, DATETIME('now', '-2 hours')),
    (2, 4, 'TEXT', 'Tebrikler Burak! Son denemende Problemler konusunda net düşüşü var. Aşağıya ilgili ödevi ve kaynağı ekliyorum.', 1, 0, DATETIME('now', '-1 hours')),
    (2, 4, 'RESOURCE', '📚 Ümmü Akcan size yeni bir kaynak atadı: 3D TYT Matematik Soru Bankası', 1, 0, DATETIME('now', '-50 minutes')),
    (2, 4, 'ASSIGNMENT', '📝 Yeni Ödev Oluşturuldu: 3D TYT Matematik - Problemler (Test 5-8) - Teslim: 18 Ağustos', 1, 0, DATETIME('now', '-45 minutes')),
    (2, 4, 'TEXT', 'Bu ödevi bitirdikten sonra yapamadığın soruların görselini buraya gönderebilirsin.', 1, 1, DATETIME('now', '-30 minutes')),
    (4, 2, 'TEXT', 'Tamamdır hocam! Görselleri ve çözümleri akşam buradan ileteceğim. Teşekkürler 🙏', 0, 0, DATETIME('now', '-10 minutes')),
    (4, 3, 'TEXT', 'Ahmet Hocam merhaba! Matematik branş denemesi analizi hakkında sorum olacaktı.', 1, 0, DATETIME('now', '-3 hours')),
    (3, 4, 'TEXT', 'Selam Burak, takıldığın soruların fotoğrafını buraya gönderebilirsin, akşam kontrol edip geri dönüş yapacağım.', 1, 0, DATETIME('now', '-2 hours'));
    """)

    # Seed Simple Curriculum Topics (curriculum)
    curriculum_seed = [
        # TYT ORTAK
        ('TYT', 'ORTAK', 'Türkçe', 'Sözcükte Anlam', 1),
        ('TYT', 'ORTAK', 'Türkçe', 'Cümlede Anlam', 2),
        ('TYT', 'ORTAK', 'Türkçe', 'Paragrafta Anlam & Yapı', 3),
        ('TYT', 'ORTAK', 'Türkçe', 'Ses Bilgisi', 4),
        ('TYT', 'ORTAK', 'Türkçe', 'Yazım Kuralları & Noktalama', 5),
        ('TYT', 'ORTAK', 'Türkçe', 'Cümlenin Ögeleri', 6),
        ('TYT', 'ORTAK', 'Türkçe', 'Sözcük Türleri', 7),
        ('TYT', 'ORTAK', 'Türkçe', 'Anlatım Bozuklukları', 8),

        ('TYT', 'ORTAK', 'Matematik', 'Temel Kavramlar & Sayı Basamakları', 1),
        ('TYT', 'ORTAK', 'Matematik', 'Bölünebilme & EBOB-EKOK', 2),
        ('TYT', 'ORTAK', 'Matematik', 'Rasyonel Sayılar & Basit Eşitsizlikler', 3),
        ('TYT', 'ORTAK', 'Matematik', 'Mutlak Değer & Üslü-Köklü İfadeler', 4),
        ('TYT', 'ORTAK', 'Matematik', 'Çarpanlara Ayırma & Oran-Orantı', 5),
        ('TYT', 'ORTAK', 'Matematik', 'Problemler (Sayı, Kesir, Yaş, Yüzde, Hız)', 6),
        ('TYT', 'ORTAK', 'Matematik', 'Kümeler & Mantık', 7),
        ('TYT', 'ORTAK', 'Matematik', 'Fonksiyonlar', 8),
        ('TYT', 'ORTAK', 'Matematik', 'Permütasyon-Kombinasyon-Olasılık', 9),

        ('TYT', 'ORTAK', 'Geometri', 'Doğruda ve Üçgende Açılar', 1),
        ('TYT', 'ORTAK', 'Geometri', 'Dik ve Özel Üçgenler', 2),
        ('TYT', 'ORTAK', 'Geometri', 'Üçgende Eşlik, Benzerlik & Alan', 3),
        ('TYT', 'ORTAK', 'Geometri', 'Dörtgenler & Çokgenler', 4),
        ('TYT', 'ORTAK', 'Geometri', 'Çamber & Daire', 5),
        ('TYT', 'ORTAK', 'Geometri', 'Katı Cisimler', 6),
        ('TYT', 'ORTAK', 'Geometri', 'Analitik Geometri', 7),

        ('TYT', 'ORTAK', 'Fizik', 'Fizik Bilimine Giriş & Madde Özellikleri', 1),
        ('TYT', 'ORTAK', 'Fizik', 'Basınç & Kaldırma Kuvveti', 2),
        ('TYT', 'ORTAK', 'Fizik', 'Isı ve Sıcaklık', 3),
        ('TYT', 'ORTAK', 'Fizik', 'Hareket, Kuvvet & Enerji', 4),
        ('TYT', 'ORTAK', 'Fizik', 'Elektrik, Manyetizma & Dalgalar', 5),
        ('TYT', 'ORTAK', 'Fizik', 'Optik', 6),

        ('TYT', 'ORTAK', 'Kimya', 'Kimya Bilimi & Atom Teorileri', 1),
        ('TYT', 'ORTAK', 'Kimya', 'Periyodik Sistem & Etkileşimler', 2),
        ('TYT', 'ORTAK', 'Kimya', 'Maddenin Halleri & Mol Hesabı', 3),
        ('TYT', 'ORTAK', 'Kimya', 'Karışımlar & Asit-Baz-Tuz', 4),

        ('TYT', 'ORTAK', 'Biyoloji', 'Canlıların Ortak Özellikleri & Hücre', 1),
        ('TYT', 'ORTAK', 'Biyoloji', 'Canlıların Sınıflandırılması', 2),
        ('TYT', 'ORTAK', 'Biyoloji', 'Hücre Bölünmeleri & Kalıtım', 3),
        ('TYT', 'ORTAK', 'Biyoloji', 'Ekosistem Ekolojisi', 4),

        ('TYT', 'ORTAK', 'Tarih', 'Tarih Bilimi & İlk Çağlar', 1),
        ('TYT', 'ORTAK', 'Tarih', 'İlk Türk Devletleri & Türk İslam Tarihi', 2),
        ('TYT', 'ORTAK', 'Tarih', 'Osmanlı Siyasi Tarihi', 3),
        ('TYT', 'ORTAK', 'Tarih', 'Milli Mücadele & Atatürk İnkılapları', 4),

        ('TYT', 'ORTAK', 'Coğrafya', 'Doğa ve İnsan & İklim Bilgisi', 1),
        ('TYT', 'ORTAK', 'Coğrafya', 'Yerin Şekillenmesi & Harita Bilgisi', 2),
        ('TYT', 'ORTAK', 'Coğrafya', 'Nüfus, Yerleşme & Afetler', 3),

        ('TYT', 'ORTAK', 'Felsefe', 'Felsefeyi Tanıma & Varlık/Bilgi Felsefesi', 1),
        ('TYT', 'ORTAK', 'Felsefe', 'Ahlak, Sanat, Din ve Siyaset Felsefesi', 2),

        ('TYT', 'ORTAK', 'Din Kültürü', 'İnanç, İbadet & Ahlak', 1),
        ('TYT', 'ORTAK', 'Din Kültürü', 'Hz. Muhammed ve Gençlik & İslam Bilim', 2),

        # AYT SAYISAL
        ('AYT', 'SAYISAL', 'Matematik', 'Polinomlar', 1),
        ('AYT', 'SAYISAL', 'Matematik', 'İkinci Dereceden Denklemler', 2),
        ('AYT', 'SAYISAL', 'Matematik', 'Parabol', 3),
        ('AYT', 'SAYISAL', 'Matematik', 'Trigonometri', 4),
        ('AYT', 'SAYISAL', 'Matematik', 'Logaritma', 5),
        ('AYT', 'SAYISAL', 'Matematik', 'Diziler', 6),
        ('AYT', 'SAYISAL', 'Matematik', 'Limit ve Süreklilik', 7),
        ('AYT', 'SAYISAL', 'Matematik', 'Türev ve Uygulamaları', 8),
        ('AYT', 'SAYISAL', 'Matematik', 'İntegral ve Alan Hesabı', 9),

        ('AYT', 'SAYISAL', 'Geometri', 'Çemberin Analitik İncelenmesi', 1),
        ('AYT', 'SAYISAL', 'Geometri', 'Dönüşüm Geometrisi', 2),
        ('AYT', 'SAYISAL', 'Geometri', 'Uzay Geometri & Katı Cisimler', 3),

        ('AYT', 'SAYISAL', 'Fizik', 'Vektörler & Tork-Denge', 1),
        ('AYT', 'SAYISAL', 'Fizik', 'Kütle Merkezi & Basit Makineler', 2),
        ('AYT', 'SAYISAL', 'Fizik', 'Bir ve İki Boyutta Hareket', 3),
        ('AYT', 'SAYISAL', 'Fizik', 'İtme ve Momentum', 4),
        ('AYT', 'SAYISAL', 'Fizik', 'Elektriksel Alan ve Potansiyel', 5),
        ('AYT', 'SAYISAL', 'Fizik', 'Manyetik Alan ve İndüksiyon', 6),
        ('AYT', 'SAYISAL', 'Fizik', 'Çembersel Hareket & Basit Harmonik Hareket', 7),
        ('AYT', 'SAYISAL', 'Fizik', 'Dalga Mekaniği & Modern Fizik', 8),

        ('AYT', 'SAYISAL', 'Kimya', 'Modern Atom Teorisi & Kuantum', 1),
        ('AYT', 'SAYISAL', 'Kimya', 'Gazlar & Gaz Yasaları', 2),
        ('AYT', 'SAYISAL', 'Kimya', 'Sıvı Çözeltiler & Derişim', 3),
        ('AYT', 'SAYISAL', 'Kimya', 'Kimyasal Tepkimelerde Enerji & Hız', 4),
        ('AYT', 'SAYISAL', 'Kimya', 'Kimyasal Denge & Asit-Baz Dengesi', 5),
        ('AYT', 'SAYISAL', 'Kimya', 'Kimya ve Elektrik (Piller & Elektroliz)', 6),
        ('AYT', 'SAYISAL', 'Kimya', 'Karbon Kimyasına Giriş & Organik Bileşikler', 7),

        ('AYT', 'SAYISAL', 'Biyoloji', 'Sinir Sistemi & Duyu Organları', 1),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Destek, Hareket & Sindirim Sistemi', 2),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Dolaşım, Bağışıklık & Solunum Sistemi', 3),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Boşaltım Sistemi & Üreme', 4),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Komünite ve Popülasyon Ekolojisi', 5),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Nükleik Asitler & Protein Sentezi', 6),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Canlılarda Enerji Dönüşümleri (Fotosentez & Solunum)', 7),
        ('AYT', 'SAYISAL', 'Biyoloji', 'Bitki Biyolojisi', 8),

        # AYT EŞİT AĞIRLIK (EA)
        ('AYT', 'EA', 'Matematik', 'Polinomlar', 1),
        ('AYT', 'EA', 'Matematik', 'İkinci Dereceden Denklemler', 2),
        ('AYT', 'EA', 'Matematik', 'Parabol', 3),
        ('AYT', 'EA', 'Matematik', 'Trigonometri', 4),
        ('AYT', 'EA', 'Matematik', 'Logaritma', 5),
        ('AYT', 'EA', 'Matematik', 'Diziler', 6),
        ('AYT', 'EA', 'Matematik', 'Limit ve Süreklilik', 7),
        ('AYT', 'EA', 'Matematik', 'Türev ve Uygulamaları', 8),
        ('AYT', 'EA', 'Matematik', 'İntegral ve Alan Hesabı', 9),

        ('AYT', 'EA', 'Geometri', 'Çamberin Analitik İncelenmesi', 1),
        ('AYT', 'EA', 'Geometri', 'Dönüşüm Geometrisi', 2),

        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 'Edebi Sanatlar & Nazım Şekilleri', 1),
        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 'İslamiyet Öncesi & Halk Edebiyatı', 2),
        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 'Divan Edebiyatı & Şairleri', 3),
        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 'Tanzimat & Servet-i Fünun Edebiyatı', 4),
        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 'Milli Edebiyat Dönemi', 5),
        ('AYT', 'EA', 'Türk Dili ve Edebiyatı', 'Cumhuriyet Dönemi Türk Edebiyatı', 6),

        ('AYT', 'EA', 'Tarih-1', 'Tarih Bilimi & İlk Çağ Uygarlıkları', 1),
        ('AYT', 'EA', 'Tarih-1', 'İslam Öncesi & Türk İslam Tarihi', 2),
        ('AYT', 'EA', 'Tarih-1', 'Osmanlı Siyasi Tarihi (1300-1918)', 3),
        ('AYT', 'EA', 'Tarih-1', 'Milli Mücadele Dönemi & İnkılaplar', 4),

        ('AYT', 'EA', 'Coğrafya-1', 'Ekosistem ve Madde Döngüleri', 1),
        ('AYT', 'EA', 'Coğrafya-1', 'Şehirler, Nüfus ve Ekonomi Politikaları', 2),
        ('AYT', 'EA', 'Coğrafya-1', 'Türkiye Madenler, Sanayi ve Ulaşım', 3),
        ('AYT', 'EA', 'Coğrafya-1', 'Küresel Örgütler & Çevre Sorunları', 4),

        # AYT SÖZEL
        ('AYT', 'SOZEL', 'Türk Dili ve Edebiyatı', 'Edebi Sanatlar & Nazım Şekilleri', 1),
        ('AYT', 'SOZEL', 'Türk Dili ve Edebiyatı', 'İslamiyet Öncesi & Halk Edebiyatı', 2),
        ('AYT', 'SOZEL', 'Türk Dili ve Edebiyatı', 'Divan Edebiyatı & Şairleri', 3),
        ('AYT', 'SOZEL', 'Türk Dili ve Edebiyatı', 'Tanzimat & Servet-i Fünun Edebiyatı', 4),
        ('AYT', 'SOZEL', 'Türk Dili ve Edebiyatı', 'Milli Edebiyat & Cumhuriyet Dönemi', 5),

        ('AYT', 'SOZEL', 'Tarih-1', 'Tarih Bilimi & İlk Çağ Uygarlıkları', 1),
        ('AYT', 'SOZEL', 'Tarih-1', 'İslam Öncesi & Türk İslam Tarihi', 2),
        ('AYT', 'SOZEL', 'Tarih-1', 'Osmanlı Siyasi Tarihi & İnkılaplar', 3),

        ('AYT', 'SOZEL', 'Coğrafya-1', 'Ekosistem & Şehirler', 1),
        ('AYT', 'SOZEL', 'Coğrafya-1', 'Türkiye Ekonomisi & Sanayi', 2),

        ('AYT', 'SOZEL', 'Tarih-2', 'Eski Çağ Medeniyetleri & Orta Çağ Dünya', 1),
        ('AYT', 'SOZEL', 'Tarih-2', 'Yeni ve Yakın Çağda Avrupa & Osmanlı', 2),
        ('AYT', 'SOZEL', 'Tarih-2', 'Çağdaş Türk ve Dünya Tarihi', 3),

        ('AYT', 'SOZEL', 'Coğrafya-2', 'Doğal Unsurlar & İklim Değişimi', 1),
        ('AYT', 'SOZEL', 'Coğrafya-2', 'Kültür Havzaları & Dünya Ülkeleri', 2),
        ('AYT', 'SOZEL', 'Coğrafya-2', 'Çevre Yönetimi & Doğal Kaynaklar', 3),

        ('AYT', 'SOZEL', 'Felsefe Grubu', 'Felsefe (20. Yüzyıl & Varlık/Bilgi)', 1),
        ('AYT', 'SOZEL', 'Felsefe Grubu', 'Psikoloji (Duyum, Algı, Öğrenme, Bellek)', 2),
        ('AYT', 'SOZEL', 'Felsefe Grubu', 'Sosyoloji (Toplumsal Yapı & Kurumlar)', 3),
        ('AYT', 'SOZEL', 'Felsefe Grubu', 'Mantık (Klasik Mantık & Sembolik Mantık)', 4),

        ('AYT', 'SOZEL', 'Din Kültürü', 'İslam Düşüncesinde Yorumlar & Mezhepler', 1),
        ('AYT', 'SOZEL', 'Din Kültürü', 'Güncel Dini Meseleler & Medeniyet', 2),

        # YDT (YABANCI DİL)
        ('YDT', 'YDT', 'İngilizce', 'Reading Comprehension (Okuma-Anlama Paragrafları)', 1),
        ('YDT', 'YDT', 'İngilizce', 'Vocabulary & Phrasal Verbs (Kelime Bilgisi)', 2),
        ('YDT', 'YDT', 'İngilizce', 'Grammar & Structure (Tenses, Modals, Passives, Conditionals)', 3),
        ('YDT', 'YDT', 'İngilizce', 'Cloze Test & Bağlaçlar', 4),
        ('YDT', 'YDT', 'İngilizce', 'Sentence Completion (Cümle Tamamlama)', 5),
        ('YDT', 'YDT', 'İngilizce', 'Translation (İngilizce-Türkçe / Türkçe-İngilizce Çeviri)', 6),
        ('YDT', 'YDT', 'İngilizce', 'Paragraph Completion & Irrelevant Sentence (Paragraf Tamamlama & Akışı Bozan)', 7),
        ('YDT', 'YDT', 'İngilizce', 'Restatement & Dialogue Completion (Yakın Anlamlı Cümle & Diyalog)', 8)
    ]

    for etype, ffield, sub, top, order in curriculum_seed:
        cursor.execute("""
        INSERT INTO curriculum (exam_type, field, subject, topic, display_order, active)
        VALUES (?, ?, ?, ?, ?, 1);
        """, (etype, ffield, sub, top, order))

    # Seed Sample Multi-Resource Assignments for Student 1 (Burak Akcan)
    # Assign 3D AYT Matematik, Orijinal AYT Matematik, and Bilgi Sarmal to AYT Matematik -> Polinomlar
    cursor.execute("SELECT id FROM curriculum WHERE exam_type = 'AYT' AND topic = 'Polinomlar' LIMIT 1;")
    poly_row = cursor.fetchone()
    if poly_row:
        # Resource 1: 3D AYT Matematik (COMPLETED)
        cursor.execute("""
        INSERT INTO student_topic_resources (student_id, curriculum_id, resource_id, assigned_by, status, primary_resource, progress_percentage, completed_at)
        VALUES (1, ?, 5, 1, 'COMPLETED', 1, 100.0, CURRENT_TIMESTAMP);
        """, (poly_row['id'],))
        # Resource 2: Orijinal AYT Matematik (IN_PROGRESS)
        cursor.execute("""
        INSERT INTO student_topic_resources (student_id, curriculum_id, resource_id, assigned_by, status, primary_resource, progress_percentage)
        VALUES (1, ?, 6, 1, 'IN_PROGRESS', 0, 65.0);
        """, (poly_row['id'],))
        # Resource 3: Bilgi Sarmal TYT/AYT Matematik (NOT_STARTED)
        cursor.execute("""
        INSERT INTO student_topic_resources (student_id, curriculum_id, resource_id, assigned_by, status, primary_resource, progress_percentage)
        VALUES (1, ?, 1, 1, 'NOT_STARTED', 0, 0.0);
        """, (poly_row['id'],))
        # Decoupled Topic Status: IN_PROGRESS
        cursor.execute("""
        INSERT OR REPLACE INTO student_topic_statuses (student_id, curriculum_id, status)
        VALUES (1, ?, 'IN_PROGRESS');
        """, (poly_row['id'],))

    cursor.execute("SELECT id FROM curriculum WHERE exam_type = 'AYT' AND topic = 'İkinci Dereceden Denklemler' LIMIT 1;")
    eq_row = cursor.fetchone()
    if eq_row:
        cursor.execute("""
        INSERT INTO student_topic_resources (student_id, curriculum_id, resource_id, assigned_by, status, primary_resource, progress_percentage)
        VALUES (1, ?, 6, 1, 'IN_PROGRESS', 1, 50.0);
        """, (eq_row['id'],))

    cursor.execute("SELECT id FROM curriculum WHERE exam_type = 'TYT' AND topic LIKE '%Temel Kavramlar%' LIMIT 1;")
    tk_row = cursor.fetchone()
    if tk_row:
        cursor.execute("""
        INSERT INTO student_topic_resources (student_id, curriculum_id, resource_id, assigned_by, status, primary_resource, progress_percentage, completed_at)
        VALUES (1, ?, 1, 1, 'COMPLETED', 1, 100.0, CURRENT_TIMESTAMP);
        """, (tk_row['id'],))
        cursor.execute("""
        INSERT OR REPLACE INTO student_topic_statuses (student_id, curriculum_id, status)
        VALUES (1, ?, 'COMPLETED');
        """, (tk_row['id'],))

    # Kaynak Havuzu Default Seeding
    cursor.execute("SELECT COUNT(*) as count FROM resources;")
    res_cnt = cursor.fetchone()['count']
    if res_cnt == 0:
        cursor.execute("SELECT id FROM subjects WHERE name = 'Matematik' LIMIT 1;")
        mat_sub = cursor.fetchone()
        mat_id = mat_sub['id'] if mat_sub else 1

        cursor.execute("SELECT id FROM subjects WHERE name = 'Fizik' LIMIT 1;")
        fiz_sub = cursor.fetchone()
        fiz_id = fiz_sub['id'] if fiz_sub else 2

        cursor.execute("SELECT id FROM subjects WHERE name = 'Türkçe' LIMIT 1;")
        turk_sub = cursor.fetchone()
        turk_id = turk_sub['id'] if turk_sub else 3

        sample_resources = [
            ('SYSTEM', None, '345 TYT Matematik Soru Bankası', '345 Yayınları', 'YKS', 'TYT', 'ALL', mat_id, 'Soru Bankası', 'ÖSYM tarzı yeni nesil soru bankası.'),
            ('SYSTEM', None, '3D AYT Fizik Soru Bankası', '3D Yayınları', 'YKS', 'AYT', 'SAYISAL', fiz_id, 'Soru Bankası', 'Derece hedefleyen öğrenciler için ÖSYM simülasyonu.'),
            ('SYSTEM', None, 'Apotemi Polinom Fasikülü', 'Apotemi Yayınları', 'YKS', 'AYT', 'SAYISAL', mat_id, 'Fasikül', 'Polinom ve İkinci Dereceden Denklemler özel fasikülü.'),
            ('SYSTEM', None, 'Limit TYT Türkçe Soru Bankası', 'Limit Yayınları', 'YKS', 'TYT', 'ALL', turk_id, 'Soru Bankası', 'Paragraf ve dil bilgisi odaklı soru bankası.')
        ]

        for owner_type, owner_id, name, pub, sys_type, ex_type, field, sub_id, r_type, desc in sample_resources:
            cursor.execute("""
            INSERT INTO resources (owner_type, owner_id, name, publisher, exam_system, exam_type, field, subject_id, resource_type, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (owner_type, owner_id, name, pub, sys_type, ex_type, field, sub_id, r_type, desc))

            res_id = cursor.lastrowid
            # Auto-map first 5 topics of this subject to resource
            cursor.execute("SELECT id, name FROM topics WHERE subject_id = ? LIMIT 5;", (sub_id,))
            top_rows = cursor.fetchall()
            for idx, top in enumerate(top_rows):
                cursor.execute("""
                INSERT INTO resource_topics (resource_id, curriculum_topic_id, chapter_name, order_index)
                VALUES (?, ?, ?, ?);
                """, (res_id, top['id'], top['name'], idx + 1))

    conn.commit()
    conn.close()
    print("Database master seeding with Many-to-Many relationships completed successfully!")

if __name__ == "__main__":
    init_db()
    seed_db()
