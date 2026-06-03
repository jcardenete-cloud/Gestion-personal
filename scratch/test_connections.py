import sys
import os
from flask import Flask, g

# Add server directory to path
sys.path.append(r'e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\server')

from db import execute_query

app = Flask(__name__)

with app.test_request_context():
    # Simulate login credentials
    g.db_user = 'system' # Default from config if not provided, but let's be explicit
    g.db_password = 'oracle'
    g.db_type = 'oracle'
    
    print("Testing Oracle connection...")
    try:
        result = execute_query("SELECT 1 FROM DUAL")
        print(f"Oracle Success: {result}")
    except Exception as e:
        print(f"Oracle Failed: {e}")

with app.test_request_context():
    g.db_user = 'postgres' # Probable user for postgres
    g.db_password = 'password' # I don't know this
    g.db_type = 'postgres'
    
    print("\nTesting Postgres connection (expecting auth failure if wrong creds)...")
    try:
        result = execute_query("SELECT 1")
        print(f"Postgres Success: {result}")
    except Exception as e:
        print(f"Postgres Result (expected failure?): {e}")
