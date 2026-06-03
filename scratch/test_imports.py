import sys
import os

# Add server directory to path
sys.path.append(r'e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\server')

try:
    import oracledb
    print("oracledb imported successfully")
except Exception as e:
    print(f"oracledb import failed: {e}")

try:
    import psycopg2
    print("psycopg2 imported successfully")
except Exception as e:
    print(f"psycopg2 import failed: {e}")

from config import config
print(f"Config loaded. Port: {config.PORT}")

try:
    from db import get_connection
    print("db.py loaded successfully")
except Exception as e:
    print(f"db.py load failed: {e}")
