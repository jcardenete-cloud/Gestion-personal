import oracledb
import psycopg2
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
        try:
            # Check if we are running in Google Cloud Run
            if os.environ.get('K_SERVICE'):
                # Cloud SQL Proxy (Unix Socket) connection for GCP
                instance_connection_name = 'project-47da493f-0c10-4e4f-945:europe-southwest1:personal'
                print(f"DEBUG: Connecting to PostgreSQL via Cloud SQL Proxy socket: {instance_connection_name}")
                conn = psycopg2.connect(
                    user=user,
                    password=password,
                    database=config.PG_DB,
                    host=f'/cloudsql/{instance_connection_name}'
                )
            else:
                # En producción (Render), la contraseña por defecto viene de la variable de entorno PG_PASSWORD
                # Si el usuario proporciona una contraseña, validamos que coincida con PG_PASSWORD si está configurada,
                # de lo contrario intentamos conectar con la contraseña ingresada para validar.
                conn_user = user
                conn_password = None
                try:
                    from flask import g, has_app_context, has_request_context
                    if (has_app_context() or has_request_context()) and hasattr(g, 'db_password') and g.db_password:
                        user_pwd = g.db_password
                        if config.PG_PASSWORD:
                            if user_pwd == config.PG_PASSWORD:
                                conn_password = config.PG_PASSWORD
                            else:
                                conn_password = user_pwd  # Usar la contraseña incorrecta para provocar fallo de conexión
                        else:
                            conn_password = user_pwd
                except (ImportError, RuntimeError):
                    pass

                if not conn_password:
                    conn_password = config.PG_PASSWORD if config.PG_PASSWORD else password

                if 'pooler.supabase.com' in config.PG_HOST and '.' not in conn_user and config.PG_PROJECT_REF:
                    conn_user = f"{conn_user}.{config.PG_PROJECT_REF}"
                print(f"DEBUG: Connecting to PostgreSQL at {config.PG_HOST}:{config.PG_PORT}/{config.PG_DB} as user={conn_user}")
                conn = psycopg2.connect(
                    user=conn_user,
                    password=conn_password,
                    host=config.PG_HOST,
                    port=config.PG_PORT,
                    database=config.PG_DB,
                    sslmode='require'
                )
            
            if config.PG_SCHEMA:
                with conn.cursor() as cur:
                    cur.execute(f"SET search_path TO {config.PG_SCHEMA}")
            
            return conn
        except Exception as e:
            print(f"ERROR: Failed to connect to PostgreSQL: {e}")
            raise
    else:
        print(f"DEBUG: Connecting to Oracle at {config.DB_DSN} as user={user}")
        return oracledb.connect(
            user=user,
            password=password,
            dsn=config.DB_DSN
        )

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
        
        # Adjust query for PostgreSQL if necessary (convert :param to %(param)s)
        if db_type == 'postgres':
            # Convert Oracle style :param to Postgres style %(param)s
            query = re.sub(r':([a-zA-Z0-9_]+)', r'%(\1)s', query)
            # Handle Oracle-specific TO_DATE conversion
            query = re.sub(r"TO_DATE\(%\(([a-zA-Z0-9_]+)\)s,\s*'YYYY-MM-DD'\)", r"%(\1)s::date", query)
            # General fallback for TO_DATE if format varies
            query = query.replace("TO_DATE(", "CAST(").replace("'YYYY-MM-DD')", "AS DATE")

        cursor = conn.cursor()
        
        if db_type == 'postgres':
            cursor.execute(query, params)
            if is_select:
                columns = [col[0] for col in cursor.description]
                result = []
                for row in cursor.fetchall():
                    d = {}
                    for col, val in zip(columns, row):
                        if isinstance(val, (datetime.date, datetime.datetime)):
                            d[col.upper()] = val.isoformat()
                        else:
                            d[col.upper()] = val
                    result.append(d)
                return result
            else:
                conn.commit()
                return cursor.rowcount
        else:
            # Oracle
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
