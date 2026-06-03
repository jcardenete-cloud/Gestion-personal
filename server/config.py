import os

def load_properties(filepath):
    properties = {}
    if not os.path.exists(filepath):
        return properties
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key_value = line.split('=', 1)
                if len(key_value) == 2:
                    properties[key_value[0].strip()] = key_value[1].strip()
    return properties

class Config:
    def __init__(self, props_path='database.properties'):
        props = load_properties(props_path)
        self.DB_USER = props.get('db.user', 'system')
        self.DB_PASSWORD = props.get('db.password', 'oracle')
        self.DB_DSN = props.get('db.dsn', 'localhost:1521/xe')
        self.DB_CLIENT_PATH = props.get('db.client_path', None)
        
        # PostgreSQL defaults
        self.PG_HOST = props.get('pg.host', 'aws-1-eu-west-2.pooler.supabase.com')
        self.PG_DB = props.get('pg.database', 'postgres')
        self.PG_SCHEMA = props.get('pg.schema', 'jcf')
        self.PG_PORT = props.get('pg.port', '5432')
        
        self.PORT = int(os.environ.get('PORT', 5000))

config = Config()
