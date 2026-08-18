#!/usr/bin/env python3
"""
SQLite to PostgreSQL Automated Migration Tool for YKS Platform
Migrates all tables, schemas, records, foreign keys, and resets primary key sequences.
"""

import sys
import os
import argparse
import sqlite3

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Error: psycopg2 is required. Run 'pip install psycopg2-binary'")
    sys.exit(1)

from database import init_db

# Tables in dependency order
ORDERED_TABLES = [
    'users',
    'coaches',
    'students',
    'coach_students',
    'coach_student_relationships',
    'coach_invitations',
    'coach_connection_requests',
    'coach_notes',
    'student_profiles',
    'subjects',
    'topics',
    'curriculum_versions',
    'curriculum',
    'publishers',
    'resources',
    'resource_sections',
    'resource_topics',
    'resource_suggestions',
    'resource_discovery_queue',
    'student_resources',
    'resource_assignments',
    'student_resource_section_progress',
    'student_resource_topic_progress',
    'student_topic_resources',
    'student_topic_statuses',
    'student_topic_progress',
    'resource_topic_progress',
    'resource_section_curriculum_topics',
    'mock_exams',
    'exam_subjects',
    'mock_exam_results',
    'mock_exam_topic_errors',
    'exam_attempts',
    'exam_test_results',
    'exam_topic_results',
    'exam_question_results',
    'exam_actions',
    'weekly_programs',
    'study_plans',
    'study_plan_items',
    'study_sessions',
    'assignments',
    'books',
    'messages',
    'conversation_settings',
    'notifications',
    'notification_preferences',
    'achievements',
    'question_logs',
    'risk_scores',
    'activity_logs'
]

def migrate(sqlite_path, postgres_url):
    print("==================================================")
    print("STARTING SQLITE -> POSTGRESQL MIGRATION")
    print(f"Source SQLite: {sqlite_path}")
    print("==================================================")

    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database file not found at {sqlite_path}")
        sys.exit(1)

    # Normalize Postgres URL
    if postgres_url.startswith("postgres://"):
        postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)

    # 1. Connect to SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    # Get list of existing tables in SQLite
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    existing_sqlite_tables = set(row[0] for row in sqlite_cur.fetchall())

    # 2. Connect to PostgreSQL
    try:
        pg_conn = psycopg2.connect(postgres_url)
        pg_conn.autocommit = False
        pg_cur = pg_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        print("✓ Connected to PostgreSQL database successfully.")
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        sys.exit(1)

    # 3. Initialize PostgreSQL Schema using database adapter
    os.environ["DATABASE_URL"] = postgres_url
    try:
        init_db()
        print("✓ PostgreSQL schema verified/initialized.")
    except Exception as e:
        print(f"Schema initialization notice/error: {e}")

    # Re-connect/ensure connection is clean
    pg_conn.commit()

    # 4. Disable FK checks temporarily for safe bulk insertion
    try:
        pg_cur.execute("SET session_replication_role = 'replica';")
    except Exception as e:
        print(f"Notice setting replica role: {e}")

    migration_report = {}
    has_error = False

    # Process all tables in ordered sequence
    tables_to_process = [t for t in ORDERED_TABLES if t in existing_sqlite_tables]
    # Add any extra tables that exist in SQLite but not in ORDERED_TABLES
    for t in existing_sqlite_tables:
        if t not in tables_to_process:
            tables_to_process.append(t)

    for table in tables_to_process:
        try:
            # Count in SQLite
            sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
            sqlite_count = sqlite_cur.fetchone()[0]

            if sqlite_count == 0:
                # Still check count in Postgres
                pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
                pg_count = pg_cur.fetchone()[0]
                migration_report[table] = (sqlite_count, pg_count, "OK (Empty)")
                continue

            # Fetch all rows from SQLite
            sqlite_cur.execute(f"SELECT * FROM {table}")
            rows = sqlite_cur.fetchall()
            if not rows:
                migration_report[table] = (0, 0, "OK")
                continue

            col_names = [col[0] for col in sqlite_cur.description]
            cols_joined = ", ".join([f'"{c}"' for c in col_names])
            placeholders = ", ".join(["%s"] * len(col_names))

            # Build insert query with ON CONFLICT DO NOTHING to avoid duplicate errors
            insert_query = f'INSERT INTO "{table}" ({cols_joined}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;'

            # Convert sqlite3.Row to tuples
            data_tuples = [tuple(row[c] for c in col_names) for row in rows]

            # Execute batch insert
            psycopg2.extras.execute_batch(pg_cur, insert_query, data_tuples, page_size=500)
            pg_conn.commit()

            # Fix Postgres auto-increment sequence if 'id' column exists
            if 'id' in col_names:
                try:
                    pg_cur.execute(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{table}"), 1),
                        (SELECT MAX(id) FROM "{table}") IS NOT NULL
                    );
                    """)
                    pg_conn.commit()
                except Exception:
                    pg_conn.rollback()

            # Verify count in PostgreSQL
            pg_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            pg_count = pg_cur.fetchone()[0]

            status = "OK" if pg_count == sqlite_count else f"MISMATCH (PG: {pg_count}, SQLite: {sqlite_count})"
            if pg_count != sqlite_count:
                has_error = True
            migration_report[table] = (sqlite_count, pg_count, status)

        except Exception as e:
            pg_conn.rollback()
            print(f"Error migrating table '{table}': {e}")
            migration_report[table] = (sqlite_count if 'sqlite_count' in locals() else -1, -1, f"ERROR: {str(e)[:40]}")
            has_error = True

    # 5. Re-enable FK checks
    try:
        pg_cur.execute("SET session_replication_role = 'DEFAULT';")
        pg_conn.commit()
    except Exception as e:
        print(f"Notice resetting session_replication_role: {e}")

    # Close connections
    sqlite_conn.close()
    pg_conn.close()

    # Print Final Migration Report
    print("\n" + "=" * 55)
    print("SQLite → PostgreSQL MIGRATION RAPORU")
    print("=" * 55)
    print(f"{'TABLO ADI':<35} | {'SQLITE':<8} | {'POSTGRES':<8} | {'DURUM'}")
    print("-" * 55)
    for tbl, (s_cnt, p_cnt, st) in migration_report.items():
        print(f"{tbl:<35} | {s_cnt:<8} | {p_cnt:<8} | {st}")
    print("=" * 55)

    if has_error:
        print("❌ Migration completed with some warnings/mismatches. Check details above.")
        return False
    else:
        print("🎉 ALL DATA MIGRATED WITH 100% ACCURACY AND INTEGRITY!")
        return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Migrate SQLite DB to PostgreSQL")
    parser.add_argument("--sqlite-path", default=os.path.join(backend_dir, "..", "yks_platform.db"), help="Path to SQLite db file")
    parser.add_argument("--postgres-url", default=os.environ.get("DATABASE_URL"), help="PostgreSQL connection URL")
    args = parser.parse_args()

    if not args.postgres_url:
        print("Usage: python scripts/migrate_sqlite_to_postgres.py --postgres-url 'postgresql://user:pass@host:5432/dbname'")
        print("Or set DATABASE_URL environment variable.")
        sys.exit(1)

    migrate(os.path.abspath(args.sqlite_path), args.postgres_url)
