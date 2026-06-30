import oracledb
import datetime
import re
import os
from config import config

# Enable Thick mode if needed (required for older Oracle versions or specific features)
try:
    if config.DB_CLIENT_PATH:
        oracledb.init_oracle_client(lib_dir=config.DB_CLIENT_PATH)
    else:
        # Try default locations
        oracledb.init_oracle_client()
except Exception as e:
    print(f"Note: Oracle Thick mode not initialized ({e}). Continuing in Thin mode.")

def get_connection():
    user = config.DB_USER
    password = config.DB_PASSWORD
    db_type = 'oracle'
    
    # Try to get credentials from Flask context if available
    try:
        from flask import g, has_app_context, has_request_context
        if (has_app_context() or has_request_context()):
            if hasattr(g, 'db_user') and g.db_user:
                user = g.db_user
            if hasattr(g, 'db_password') and g.db_password:
                password = g.db_password
            if hasattr(g, 'db_type') and g.db_type:
                db_type = g.db_type
    except (ImportError, RuntimeError):
        pass

    if db_type == 'postgres':
        return get_postgres_connection()
    else:
        print(f"DEBUG: Connecting to Oracle at {config.DB_DSN} as user={user}")
        return oracledb.connect(
            user=user,
            password=password,
            dsn=config.DB_DSN
        )

def get_postgres_connection():
    import psycopg2
    from flask import g
    password = None
    try:
        from flask import has_app_context, has_request_context
        if (has_app_context() or has_request_context()) and hasattr(g, 'db_password') and g.db_password:
            password = g.db_password
    except Exception:
        pass
    if not password:
        password = config.PG_PASSWORD

    user = f"postgres.{config.PG_PROJECT_REF}" if config.PG_PROJECT_REF else "postgres"
    print(f"DEBUG: Connecting to PostgreSQL at {config.PG_HOST}:{config.PG_PORT} as user={user}")
    conn = psycopg2.connect(
        host=config.PG_HOST,
        port=config.PG_PORT,
        database=config.PG_DB,
        user=user,
        password=password
    )
    if config.PG_SCHEMA:
        with conn.cursor() as cur:
            cur.execute(f"SET search_path TO {config.PG_SCHEMA};")
    return conn

def execute_query(query, params=(), is_select=True):
    conn = None
    db_type = 'oracle'
    try:
        from flask import g, has_app_context, has_request_context
        if (has_app_context() or has_request_context()) and hasattr(g, 'db_type') and g.db_type:
            db_type = g.db_type
    except (ImportError, RuntimeError):
        pass

    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        if db_type == 'postgres':
            cursor.execute(query, params)
            if is_select:
                columns = [col[0].upper() for col in cursor.description]
                result = []
                for row in cursor.fetchall():
                    d = {}
                    for col, val in zip(columns, row):
                        if isinstance(val, (datetime.date, datetime.datetime)):
                            d[col] = val.isoformat()
                        else:
                            d[col] = val
                    result.append(d)
                return result
            else:
                conn.commit()
                return cursor.rowcount
        else:
            cursor.execute(query, params)
            if is_select:
                columns = [col[0].upper() for col in cursor.description]
                def row_to_dict(*args):
                    d = {}
                    for col, val in zip(columns, args):
                        if isinstance(val, (datetime.date, datetime.datetime)):
                            d[col] = val.isoformat()
                        else:
                            d[col] = val
                    return d
                cursor.rowfactory = row_to_dict
                result = cursor.fetchall()
                return result
            else:
                conn.commit()
                return cursor.rowcount
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()
