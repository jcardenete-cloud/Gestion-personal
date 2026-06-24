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

        # PostgreSQL — las variables de entorno tienen prioridad (Render/producción)
        # Si no existen, se usa database.properties (desarrollo local)
        self.PG_HOST = os.environ.get('PG_HOST') or props.get('pg.host', 'aws-1-eu-west-2.pooler.supabase.com')
        self.PG_PROJECT_REF = os.environ.get('PG_PROJECT_REF') or props.get('pg.project_ref', 'jecqveavazmvmxsbahmr')
        self.PG_DB = os.environ.get('PG_DATABASE') or props.get('pg.database', 'postgres')
        self.PG_SCHEMA = os.environ.get('PG_SCHEMA') or props.get('pg.schema', 'jcf')
        self.PG_PORT = os.environ.get('PG_PORT') or props.get('pg.port', '5432')
        # La contraseña SOLO viene de variable de entorno (nunca del fichero en producción)
        self.PG_PASSWORD = os.environ.get('PG_PASSWORD') or None

        # Supabase HTTP API settings for Postgres access via SDK
        self.SUPABASE_URL = os.environ.get('SUPABASE_URL') or props.get('supabase.url')
        self.SUPABASE_SERVICE_ROLE_KEY = (
            os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
            or os.environ.get('SUPABASE_KEY')
            or props.get('supabase.service_role_key')
            or props.get('supabase.key')
        )
        self.SUPABASE_KEY = self.SUPABASE_SERVICE_ROLE_KEY

        self.PORT = int(os.environ.get('PORT', 5000))

config = Config()
