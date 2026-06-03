from waitress import serve
from app import app
from config import config
import logging

if __name__ == '__main__':
    print(f"Starting production server on port {config.PORT}...")
    serve(app, host='0.0.0.0', port=config.PORT)
