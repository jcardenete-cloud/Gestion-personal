from flask import Flask, request, jsonify, g
from flask_cors import CORS
from db import execute_query
from config import config
import datetime
import logging

logging.basicConfig(filename='backend_debug.log', level=logging.DEBUG, 
                    format='%(asctime)s %(levelname)s: %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = data.get('username')
    password = data.get('password')
    db_type = data.get('db_type', 'oracle')
    
    if not user or not password:
        return jsonify({"error": "Usuario y contraseña requeridos"}), 400
        
    # Verify credentials by trying to connect
    try:
        from flask import g
        g.db_user = user
        g.db_password = password
        g.db_type = db_type
        logging.info(f"Attempting login for user={user} on db_type={db_type}")
        # Simple query to test connection
        test_query = "SELECT 1" if db_type == 'postgres' else "SELECT 1 FROM DUAL"
        execute_query(test_query)
        logging.info(f"Login successful for {user}")
        return jsonify({"status": "success", "user": user, "db_type": db_type})
    except Exception as e:
        logging.error(f"Login failed for {user} on {db_type}: {str(e)}")
        return jsonify({"error": f"Error de conexión ({db_type}): {str(e)}"}), 401

@app.before_request
def before_request_func():
    from flask import g
    g.db_user = request.headers.get('X-DB-User')
    g.db_password = request.headers.get('X-DB-Password')
    g.db_type = request.headers.get('X-DB-Type', 'oracle')

@app.route('/api/encargos', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_encargos():
    if request.method == 'GET':
        query = "SELECT * FROM ENCARGOS"
        result = execute_query(query)
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        query = """INSERT INTO ENCARGOS (CODIGOPR, NOMBRE, AREA, INICIO, FIN, CLIENTE, FIN_REAL, PRESUPUESTO, DESCRIPCION, INFOR) 
                   VALUES (:CODIGOPR, :NOMBRE, :AREA, TO_DATE(:INICIO, 'YYYY-MM-DD'), TO_DATE(:FIN, 'YYYY-MM-DD'), :CLIENTE, TO_DATE(:FIN_REAL, 'YYYY-MM-DD'), :PRESUPUESTO, :DESCRIPCION, :INFOR)"""
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"}), 201

    elif request.method == 'PUT':
        data = request.json
        query = """UPDATE ENCARGOS SET NOMBRE=:NOMBRE, AREA=:AREA, INICIO=TO_DATE(:INICIO, 'YYYY-MM-DD'), FIN=TO_DATE(:FIN, 'YYYY-MM-DD'), 
                   CLIENTE=:CLIENTE, FIN_REAL=TO_DATE(:FIN_REAL, 'YYYY-MM-DD'), PRESUPUESTO=:PRESUPUESTO, DESCRIPCION=:DESCRIPCION, INFOR=:INFOR 
                   WHERE CODIGOPR=:CODIGOPR"""
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"})

    elif request.method == 'DELETE':
        codigopr = request.args.get('codigopr')
        query = "DELETE FROM ENCARGOS WHERE CODIGOPR=:codigopr"
        execute_query(query, {"codigopr": codigopr}, is_select=False)
        return jsonify({"status": "success"})

@app.route('/api/personal/bulk-location', methods=['POST'])
def bulk_update_personal_location():
    data = request.json
    ref_pers = data.get('ref_pers', [])
    new_location = data.get('new_location')

    if not ref_pers or not new_location:
        return jsonify({"error": "Se requieren IDs de personal y la nueva ubicación"}), 400

    try:
        # Update each person one by one to keep it simple and avoid complex IN clause generation
        for ref_per in ref_pers:
            query = "UPDATE LISTA_PERSONAL SET REF_UBI=:new_location WHERE REF_PER=:ref_per"
            execute_query(query, {"new_location": new_location, "ref_per": ref_per}, is_select=False)
        
        return jsonify({"status": "success", "message": f"Ubicación actualizada para {len(ref_pers)} personas"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/personal', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_personal():
    if request.method == 'GET':
        query = "SELECT * FROM LISTA_PERSONAL"
        result = execute_query(query)
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        query = """INSERT INTO LISTA_PERSONAL (NOMBRE, APELLIDO1, APELLIDO2, PERFIL, BAJA, USUARIO, TELEFONO_1, TELEFONO_2, ACTIVO, RESP, NIF, PLANTILLA, REF_PER, REF_UBI, SITUACION, INCORPORACION, N_FICHA, F_CONTRATO, REF_TIT, IDEMPLEADO) 
                   VALUES (:NOMBRE, :APELLIDO1, :APELLIDO2, :PERFIL, TO_DATE(:BAJA, 'YYYY-MM-DD'), :USUARIO, :TELEFONO_1, :TELEFONO_2, :ACTIVO, :RESP, :NIF, :PLANTILLA, :REF_PER, :REF_UBI, :SITUACION, TO_DATE(:INCORPORACION, 'YYYY-MM-DD'), :N_FICHA, TO_DATE(:F_CONTRATO, 'YYYY-MM-DD'), :REF_TIT, :IDEMPLEADO)"""
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"}), 201

    elif request.method == 'PUT':
        data = request.json
        query = """UPDATE LISTA_PERSONAL SET NOMBRE=:NOMBRE, APELLIDO1=:APELLIDO1, APELLIDO2=:APELLIDO2, PERFIL=:PERFIL, BAJA=TO_DATE(:BAJA, 'YYYY-MM-DD'), 
                   USUARIO=:USUARIO, TELEFONO_1=:TELEFONO_1, TELEFONO_2=:TELEFONO_2, ACTIVO=:ACTIVO, RESP=:RESP, NIF=:NIF, PLANTILLA=:PLANTILLA, 
                   REF_UBI=:REF_UBI, SITUACION=:SITUACION, INCORPORACION=TO_DATE(:INCORPORACION, 'YYYY-MM-DD'), N_FICHA=:N_FICHA, F_CONTRATO=TO_DATE(:F_CONTRATO, 'YYYY-MM-DD'), REF_TIT=:REF_TIT, IDEMPLEADO=:IDEMPLEADO 
                   WHERE REF_PER=:REF_PER"""
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"})

    elif request.method == 'DELETE':
        ref_per = request.args.get('ref_per')
        query = "DELETE FROM LISTA_PERSONAL WHERE REF_PER=:ref_per"
        execute_query(query, {"ref_per": ref_per}, is_select=False)
        return jsonify({"status": "success"})

@app.route('/api/personal-proyectos', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_personal_proyectos():
    codigopr = request.args.get('codigopr')
    
    if request.method == 'GET':
        if codigopr:
            query = """SELECT pp.*, p.NOMBRE, p.APELLIDO1, p.APELLIDO2, p.PERFIL 
                       FROM PERSONAL_PROYECTOS pp
                       JOIN LISTA_PERSONAL p ON pp.REF_PER = p.REF_PER
                       WHERE pp.CODIGOPR = :codigopr"""
            result = execute_query(query, {"codigopr": codigopr})
        else:
            query = "SELECT * FROM PERSONAL_PROYECTOS"
            result = execute_query(query)
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        query = """INSERT INTO PERSONAL_PROYECTOS (REF_PER, CODIGOPR, ALTA, BAJA, PORCENTAJE, RTP) 
                   VALUES (:REF_PER, :CODIGOPR, TO_DATE(:ALTA, 'YYYY-MM-DD'), TO_DATE(:BAJA, 'YYYY-MM-DD'), :PORCENTAJE, :RTP)"""
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"}), 201

    elif request.method == 'PUT':
        data = request.json
        query = """UPDATE PERSONAL_PROYECTOS SET ALTA=TO_DATE(:ALTA, 'YYYY-MM-DD'), BAJA=TO_DATE(:BAJA, 'YYYY-MM-DD'), PORCENTAJE=:PORCENTAJE, RTP=:RTP 
                   WHERE REF_PER=:REF_PER AND CODIGOPR=:CODIGOPR"""
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"})

    elif request.method == 'DELETE':
        ref_per = request.args.get('ref_per')
        codigopr = request.args.get('codigopr')
        query = "DELETE FROM PERSONAL_PROYECTOS WHERE REF_PER=:ref_per AND CODIGOPR=:codigopr"
        execute_query(query, {"ref_per": ref_per, "codigopr": codigopr}, is_select=False)
        return jsonify({"status": "success"})

@app.route('/api/ubicacion', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_ubicacion():
    if request.method == 'GET':
        query = "SELECT * FROM UBICACION ORDER BY REF_UBI"
        result = execute_query(query)
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        query = "INSERT INTO UBICACION (REF_UBI, A_LUGAR) VALUES (:REF_UBI, :A_LUGAR)"
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"}), 201

    elif request.method == 'PUT':
        data = request.json
        query = "UPDATE UBICACION SET A_LUGAR=:A_LUGAR WHERE REF_UBI=:REF_UBI"
        execute_query(query, data, is_select=False)
        return jsonify({"status": "success"})

    elif request.method == 'DELETE':
        ref_ubi = request.args.get('ref_ubi')
        query = "DELETE FROM UBICACION WHERE REF_UBI=:ref_ubi"
        execute_query(query, {"ref_ubi": ref_ubi}, is_select=False)
        return jsonify({"status": "success"})

@app.route('/api/schema', methods=['GET'])
def get_schema():
    from flask import g
    db_type = getattr(g, 'db_type', 'oracle')
    
    # Only include relevant tables
    tables = ('LISTA_PERSONAL', 'ENCARGOS', 'PERSONAL_PROYECTOS', 'UBICACION')
    
    if db_type == 'postgres':
        table_list = ", ".join([f"'{t.lower()}'" for t in tables])
        query = f"""SELECT upper(table_name) as table_name, upper(column_name) as column_name 
                   FROM information_schema.columns 
                   WHERE table_schema = '{config.PG_SCHEMA}' 
                   AND lower(table_name) IN ({table_list}) 
                   ORDER BY table_name, ordinal_position"""
    else:
        query = f"SELECT table_name, column_name FROM user_tab_columns WHERE table_name IN {tables} ORDER BY table_name, column_id"
    
    result = execute_query(query)
    
    schema = {}
    for row in result:
        table = row['TABLE_NAME']
        column = row['COLUMN_NAME']
        if table not in schema:
            schema[table] = []
        schema[table].append(column)
    
    return jsonify(schema)

def parse_iso_date(val):
    if not val:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val
    try:
        val_str = str(val).split('+')[0].rstrip('Z')
        return datetime.datetime.fromisoformat(val_str)
    except Exception:
        try:
            return datetime.datetime.strptime(val_str.split('T')[0], "%Y-%m-%d")
        except Exception:
            return val

@app.route('/api/backup/export', methods=['GET'])
def backup_export():
    try:
        tables = ['UBICACION', 'ENCARGOS', 'LISTA_PERSONAL', 'PERSONAL_PROYECTOS', 'VACACIONES', 'FESTIVOS']
        backup_data = {}
        for table in tables:
            try:
                query = f"SELECT * FROM {table}"
                backup_data[table] = execute_query(query)
            except Exception as e:
                logging.warning(f"No se pudo exportar la tabla {table} (puede que no exista): {str(e)}")
                backup_data[table] = []
        return jsonify({
            "status": "success",
            "timestamp": datetime.datetime.now().isoformat(),
            "data": backup_data
        })
    except Exception as e:
        logging.error(f"Error exporting backup: {str(e)}")
        return jsonify({"error": f"Error al exportar copia de seguridad: {str(e)}"}), 500

@app.route('/api/backup/import', methods=['POST'])
def backup_import():
    payload = request.json
    if not payload or 'data' not in payload:
        return jsonify({"error": "Datos de copia de seguridad no proporcionados"}), 400
    
    backup_data = payload['data']
    # Delete order (dependents first)
    tables_to_delete = ['VACACIONES', 'PERSONAL_PROYECTOS', 'LISTA_PERSONAL', 'ENCARGOS', 'FESTIVOS', 'UBICACION']
    
    try:
        # Step 1: Clear current tables
        for table in tables_to_delete:
            try:
                execute_query(f"DELETE FROM {table}", is_select=False)
            except Exception as e:
                logging.warning(f"No se pudo vaciar la tabla {table} (puede que no exista): {str(e)}")
            
        inserted_counts = {}
        
        # 1. UBICACION
        if 'UBICACION' in backup_data and backup_data['UBICACION']:
            try:
                for row in backup_data['UBICACION']:
                    execute_query("INSERT INTO UBICACION (REF_UBI, A_LUGAR) VALUES (:REF_UBI, :A_LUGAR)", row, is_select=False)
                inserted_counts['UBICACION'] = len(backup_data['UBICACION'])
            except Exception as e:
                logging.warning(f"No se pudo importar UBICACION: {str(e)}")
            
        # 3. ENCARGOS
        if 'ENCARGOS' in backup_data and backup_data['ENCARGOS']:
            try:
                for row in backup_data['ENCARGOS']:
                    clean_row = {**row}
                    for f in ['INICIO', 'FIN', 'FIN_REAL']:
                        clean_row[f] = parse_iso_date(clean_row.get(f))
                    execute_query("""INSERT INTO ENCARGOS (CODIGOPR, NOMBRE, AREA, INICIO, FIN, CLIENTE, FIN_REAL, PRESUPUESTO, DESCRIPCION, INFOR) 
                                   VALUES (:CODIGOPR, :NOMBRE, :AREA, :INICIO, :FIN, :CLIENTE, :FIN_REAL, :PRESUPUESTO, :DESCRIPCION, :INFOR)""", 
                                  clean_row, is_select=False)
                inserted_counts['ENCARGOS'] = len(backup_data['ENCARGOS'])
            except Exception as e:
                logging.warning(f"No se pudo importar ENCARGOS: {str(e)}")
            
        # 4. LISTA_PERSONAL
        if 'LISTA_PERSONAL' in backup_data and backup_data['LISTA_PERSONAL']:
            try:
                for row in backup_data['LISTA_PERSONAL']:
                    clean_row = {**row}
                    for f in ['BAJA', 'INCORPORACION', 'F_CONTRATO']:
                        clean_row[f] = parse_iso_date(clean_row.get(f))
                    execute_query("""INSERT INTO LISTA_PERSONAL (NOMBRE, APELLIDO1, APELLIDO2, PERFIL, BAJA, USUARIO, TELEFONO_1, TELEFONO_2, ACTIVO, RESP, NIF, PLANTILLA, REF_PER, REF_UBI, SITUACION, INCORPORACION, N_FICHA, F_CONTRATO, REF_TIT, IDEMPLEADO) 
                                   VALUES (:NOMBRE, :APELLIDO1, :APELLIDO2, :PERFIL, :BAJA, :USUARIO, :TELEFONO_1, :TELEFONO_2, :ACTIVO, :RESP, :NIF, :PLANTILLA, :REF_PER, :REF_UBI, :SITUACION, :INCORPORACION, :N_FICHA, :F_CONTRATO, :REF_TIT, :IDEMPLEADO)""", 
                                  clean_row, is_select=False)
                inserted_counts['LISTA_PERSONAL'] = len(backup_data['LISTA_PERSONAL'])
            except Exception as e:
                logging.warning(f"No se pudo importar LISTA_PERSONAL: {str(e)}")
            
        # 5. PERSONAL_PROYECTOS
        if 'PERSONAL_PROYECTOS' in backup_data and backup_data['PERSONAL_PROYECTOS']:
            try:
                for row in backup_data['PERSONAL_PROYECTOS']:
                    clean_row = {**row}
                    for f in ['ALTA', 'BAJA']:
                        clean_row[f] = parse_iso_date(clean_row.get(f))
                    execute_query("""INSERT INTO PERSONAL_PROYECTOS (REF_PER, CODIGOPR, ALTA, BAJA, PORCENTAJE, RTP) 
                                   VALUES (:REF_PER, :CODIGOPR, :ALTA, :BAJA, :PORCENTAJE, :RTP)""", 
                                  clean_row, is_select=False)
                inserted_counts['PERSONAL_PROYECTOS'] = len(backup_data['PERSONAL_PROYECTOS'])
            except Exception as e:
                logging.warning(f"No se pudo importar PERSONAL_PROYECTOS: {str(e)}")

        # 6. VACACIONES
        if 'VACACIONES' in backup_data and backup_data['VACACIONES']:
            try:
                from flask import g
                db_type = getattr(g, 'db_type', 'oracle')
                for row in backup_data['VACACIONES']:
                    clean_row = {**row}
                    clean_row['FECHA_DESDE'] = parse_iso_date(clean_row.get('FECHA_DESDE'))
                    clean_row['FECHA_HASTA'] = parse_iso_date(clean_row.get('FECHA_HASTA'))
                    if isinstance(clean_row['FECHA_DESDE'], (datetime.datetime, datetime.date)):
                        clean_row['FECHA_DESDE'] = clean_row['FECHA_DESDE'].strftime('%Y-%m-%d')
                    if isinstance(clean_row['FECHA_HASTA'], (datetime.datetime, datetime.date)):
                        clean_row['FECHA_HASTA'] = clean_row['FECHA_HASTA'].strftime('%Y-%m-%d')
                    if db_type == 'postgres':
                        if 'ID_VACACION' in clean_row and clean_row['ID_VACACION'] is not None:
                            query = """
                                INSERT INTO VACACIONES (ID_VACACION, REF_PER, DURACION, FECHA_DESDE, FECHA_HASTA, PARTICION_NUM, ORIGEN_FICHERO, FECHA_CARGA)
                                VALUES (:ID_VACACION, :REF_PER, :DURACION, CAST(:FECHA_DESDE AS DATE), CAST(:FECHA_HASTA AS DATE), :PARTICION_NUM, :ORIGEN_FICHERO, CURRENT_TIMESTAMP)
                            """
                        else:
                            query = """
                                INSERT INTO VACACIONES (REF_PER, DURACION, FECHA_DESDE, FECHA_HASTA, PARTICION_NUM, ORIGEN_FICHERO, FECHA_CARGA)
                                VALUES (:REF_PER, :DURACION, CAST(:FECHA_DESDE AS DATE), CAST(:FECHA_HASTA AS DATE), :PARTICION_NUM, :ORIGEN_FICHERO, CURRENT_TIMESTAMP)
                            """
                    else:
                        query = """
                            INSERT INTO VACACIONES (ID_VACACION, REF_PER, DURACION, FECHA_DESDE, FECHA_HASTA, PARTICION_NUM, ORIGEN_FICHERO, FECHA_CARGA)
                            VALUES (SEQ_VACACIONES.NEXTVAL, :REF_PER, :DURACION, TO_DATE(:FECHA_DESDE, 'YYYY-MM-DD'), TO_DATE(:FECHA_HASTA, 'YYYY-MM-DD'), :PARTICION_NUM, :ORIGEN_FICHERO, SYSDATE)
                        """
                    execute_query(query, clean_row, is_select=False)
                inserted_counts['VACACIONES'] = len(backup_data['VACACIONES'])
            except Exception as e:
                logging.warning(f"No se pudo importar VACACIONES: {str(e)}")
            
        # 7. FESTIVOS
        if 'FESTIVOS' in backup_data and backup_data['FESTIVOS']:
            try:
                from flask import g
                db_type = getattr(g, 'db_type', 'oracle')
                for row in backup_data['FESTIVOS']:
                    clean_row = {**row}
                    # Ensure fecha is in YYYY-MM-DD
                    fecha = parse_iso_date(clean_row.get('FECHA') or clean_row.get('fecha'))
                    if isinstance(fecha, (datetime.datetime, datetime.date)):
                        fecha_str = fecha.strftime('%Y-%m-%d')
                    else:
                        fecha_str = str(fecha) if fecha is not None else None

                    if db_type == 'postgres':
                        query = "INSERT INTO festivos (year, ref_ubi, fecha, descripcion) VALUES (:year, :ref_ubi, TO_DATE(:fecha, 'YYYY-MM-DD'), :descripcion)"
                    else:
                        query = "INSERT INTO FESTIVOS (ID_FESTIVO, YEAR, REF_UBI, FECHA, DESCRIPCION) VALUES (SEQ_FESTIVOS.NEXTVAL, :year, :ref_ubi, TO_DATE(:fecha, 'YYYY-MM-DD'), :descripcion)"

                    params = {
                        'year': int(clean_row.get('YEAR') or clean_row.get('year')) if clean_row.get('YEAR') or clean_row.get('year') is not None else None,
                        'ref_ubi': int(clean_row.get('REF_UBI') or clean_row.get('ref_ubi')) if (clean_row.get('REF_UBI') or clean_row.get('ref_ubi')) is not None else None,
                        'fecha': fecha_str,
                        'descripcion': clean_row.get('DESCRIPCION') or clean_row.get('descripcion')
                    }
                    execute_query(query, params, is_select=False)
                inserted_counts['FESTIVOS'] = len(backup_data['FESTIVOS'])
            except Exception as e:
                logging.warning(f"No se pudo importar FESTIVOS: {str(e)}")
            
        return jsonify({
            "status": "success",
            "message": "Datos importados con éxito",
            "inserted_counts": inserted_counts
        })
    except Exception as e:
        logging.error(f"Error importing backup: {str(e)}")
        return jsonify({"error": f"Error al importar copia de seguridad: {str(e)}"}), 500

@app.route('/api/query', methods=['POST'])
def execute_dynamic_query():
    data = request.json
    sql = data.get('sql')
    if not sql:
        return jsonify({"error": "SQL query is required"}), 400
    
    # Basic security check - only allow SELECT
    if not sql.strip().upper().startswith('SELECT'):
        return jsonify({"error": "Only SELECT queries are allowed"}), 403
        
    try:
        result = execute_query(sql)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

def check_and_create_vacaciones_table():
    from flask import g
    db_type = getattr(g, 'db_type', 'oracle')
    if db_type == 'postgres':
        try:
            execute_query("SELECT 1 FROM vacaciones WHERE 1=0")
        except Exception:
            logging.info("Creating VACACIONES table for Postgres...")
            create_sql = """
                CREATE TABLE vacaciones (
                    id_vacacion SERIAL PRIMARY KEY,
                    ref_per INTEGER NOT NULL,
                    duracion NUMERIC(5,1),
                    fecha_desde DATE NOT NULL,
                    fecha_hasta DATE NOT NULL,
                    particion_num INTEGER,
                    origen_fichero VARCHAR(255),
                    fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            execute_query(create_sql, is_select=False)

def check_and_create_festivos_table():
    from flask import g
    db_type = getattr(g, 'db_type', 'oracle')
    if db_type == 'postgres':
        try:
            execute_query("SELECT 1 FROM festivos WHERE 1=0")
        except Exception:
            logging.info("Creating FESTIVOS table for Postgres...")
            create_sql = """
                CREATE TABLE festivos (
                    id_festivo SERIAL PRIMARY KEY,
                    year INTEGER NOT NULL,
                    ref_ubi INTEGER,
                    fecha DATE NOT NULL,
                    descripcion VARCHAR(255)
                )
            """
            execute_query(create_sql, is_select=False)
    else:
        try:
            execute_query("SELECT 1 FROM FESTIVOS WHERE ROWNUM = 1")
        except Exception:
            logging.info("Creating FESTIVOS table and sequence for Oracle...")
            try:
                execute_query("CREATE SEQUENCE SEQ_FESTIVOS START WITH 1 INCREMENT BY 1", is_select=False)
            except Exception as seq_err:
                logging.warning(f"Sequence SEQ_FESTIVOS creation skipped: {seq_err}")
            create_sql = """
                CREATE TABLE FESTIVOS (
                    ID_FESTIVO NUMBER PRIMARY KEY,
                    YEAR NUMBER(4) NOT NULL,
                    REF_UBI NUMBER,
                    FECHA DATE NOT NULL,
                    DESCRIPCION VARCHAR2(255)
                )
            """
            execute_query(create_sql, is_select=False)
            
@app.route('/api/vacaciones', methods=['GET'])
def get_vacaciones():
    check_and_create_vacaciones_table()
    
    ref_per = request.args.get('ref_per')
    year = request.args.get('year')
    origen_fichero = request.args.get('origen_fichero')
    codigopr = request.args.get('codigopr')
    
    query = """
        SELECT v.ID_VACACION, v.REF_PER, v.DURACION, v.FECHA_DESDE, v.FECHA_HASTA, 
               v.PARTICION_NUM, v.ORIGEN_FICHERO, v.FECHA_CARGA,
               p.NOMBRE, p.APELLIDO1, p.APELLIDO2, p.PERFIL, p.USUARIO
        FROM VACACIONES v
        JOIN LISTA_PERSONAL p ON v.REF_PER = p.REF_PER
    """
    params = {}
    where_clauses = []
    
    if ref_per:
        where_clauses.append("v.REF_PER = :ref_per")
        params["ref_per"] = int(ref_per)
        
    if year:
        where_clauses.append("EXTRACT(YEAR FROM v.FECHA_DESDE) = :year")
        params["year"] = int(year)
        
    if origen_fichero:
        where_clauses.append("v.ORIGEN_FICHERO = :origen_fichero")
        params["origen_fichero"] = origen_fichero

    if codigopr:
        where_clauses.append("EXISTS (SELECT 1 FROM PERSONAL_PROYECTOS pp WHERE pp.REF_PER = v.REF_PER AND pp.CODIGOPR = :codigopr)")
        params["codigopr"] = codigopr
        
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
        
    query += " ORDER BY v.FECHA_CARGA DESC, v.FECHA_DESDE DESC"
    
    try:
        result = execute_query(query, params)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vacaciones/ficheros', methods=['GET'])
def get_vacaciones_ficheros():
    check_and_create_vacaciones_table()
    try:
        query = "SELECT DISTINCT ORIGEN_FICHERO FROM VACACIONES WHERE ORIGEN_FICHERO IS NOT NULL ORDER BY ORIGEN_FICHERO"
        result = execute_query(query)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vacaciones/import', methods=['POST'])
def import_vacaciones():
    check_and_create_vacaciones_table()
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Se requiere una lista de registros de vacaciones"}), 400
        
    inserted_count = 0
    try:
        from flask import g
        db_type = getattr(g, 'db_type', 'oracle')
        
        for row in data:
            fecha_desde = parse_iso_date(row.get('fecha_desde'))
            fecha_hasta = parse_iso_date(row.get('fecha_hasta'))
            
            if not fecha_desde or not fecha_hasta:
                continue
                
            if db_type == 'postgres':
                # PostgreSQL: CAST for date conversion, CURRENT_TIMESTAMP for automatic fecha_carga
                query = """
                    INSERT INTO VACACIONES (REF_PER, DURACION, FECHA_DESDE, FECHA_HASTA, PARTICION_NUM, ORIGEN_FICHERO, FECHA_CARGA)
                    VALUES (:ref_per, :duracion, CAST(:fecha_desde AS DATE), CAST(:fecha_hasta AS DATE), :particion_num, :origen_fichero, CURRENT_TIMESTAMP)
                """
            else:
                # Oracle with Sequence and SYSDATE for fecha_carga
                query = """
                    INSERT INTO VACACIONES (ID_VACACION, REF_PER, DURACION, FECHA_DESDE, FECHA_HASTA, PARTICION_NUM, ORIGEN_FICHERO, FECHA_CARGA)
                    VALUES (SEQ_VACACIONES.NEXTVAL, :ref_per, :duracion, TO_DATE(:fecha_desde, 'YYYY-MM-DD'), TO_DATE(:fecha_hasta, 'YYYY-MM-DD'), :particion_num, :origen_fichero, SYSDATE)
                """
                
            params = {
                "ref_per": int(row['ref_per']),
                "duracion": float(row.get('duracion')) if row.get('duracion') is not None else None,
                "fecha_desde": row['fecha_desde'].split('T')[0],
                "fecha_hasta": row['fecha_hasta'].split('T')[0],
                "particion_num": int(row['particion_num']) if row.get('particion_num') is not None else None,
                "origen_fichero": row.get('origen_fichero', 'Carga manual')
            }
            execute_query(query, params, is_select=False)
            inserted_count += 1
            
        return jsonify({"status": "success", "message": f"{inserted_count} periodos de vacaciones importados correctamente"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vacaciones', methods=['PUT'])
def update_vacacion():
    check_and_create_vacaciones_table()
    data = request.json or {}
    id_vacacion = data.get('id')
    if not id_vacacion:
        return jsonify({"error": "Se requiere el ID de vacaciones"}), 400

    duracion = data.get('duracion')
    fecha_desde = parse_iso_date(data.get('fecha_desde'))
    fecha_hasta = parse_iso_date(data.get('fecha_hasta'))
    particion_num = data.get('particion_num')
    origen_fichero = data.get('origen_fichero')

    if not fecha_desde or not fecha_hasta:
        return jsonify({"error": "Se requiere fecha desde y fecha hasta en formato YYYY-MM-DD"}), 400

    if isinstance(fecha_desde, (datetime.datetime, datetime.date)):
        fecha_desde = fecha_desde.strftime('%Y-%m-%d')
    if isinstance(fecha_hasta, (datetime.datetime, datetime.date)):
        fecha_hasta = fecha_hasta.strftime('%Y-%m-%d')

    try:
        db_type = getattr(g, 'db_type', 'oracle')
        query = """
            UPDATE VACACIONES
            SET DURACION = :duracion,
                FECHA_DESDE = TO_DATE(:fecha_desde, 'YYYY-MM-DD'),
                FECHA_HASTA = TO_DATE(:fecha_hasta, 'YYYY-MM-DD'),
                PARTICION_NUM = :particion_num,
                ORIGEN_FICHERO = :origen_fichero
            WHERE ID_VACACION = :id_vacacion
        """
        params = {
            "duracion": float(duracion) if duracion is not None and duracion != '' else None,
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "particion_num": int(particion_num) if particion_num is not None and particion_num != '' else None,
            "origen_fichero": origen_fichero,
            "id_vacacion": int(id_vacacion)
        }
        execute_query(query, params, is_select=False)
        return jsonify({"status": "success", "message": "Periodo de vacaciones actualizado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vacaciones', methods=['DELETE'])
def delete_vacaciones():
    check_and_create_vacaciones_table()
    id_vacacion = request.args.get('id')
    origen_fichero = request.args.get('origen_fichero')

    if not id_vacacion and not origen_fichero:
        return jsonify({"error": "Se requiere el ID de vacaciones o el nombre del fichero de origen"}), 400

    try:
        if id_vacacion:
            query = "DELETE FROM VACACIONES WHERE ID_VACACION = :id_vacacion"
            execute_query(query, {"id_vacacion": int(id_vacacion)}, is_select=False)
            message = "Periodo de vacaciones eliminado correctamente"
        else:
            query = "DELETE FROM VACACIONES WHERE ORIGEN_FICHERO = :origen_fichero"
            execute_query(query, {"origen_fichero": origen_fichero}, is_select=False)
            message = f"Todas las vacaciones del fichero '{origen_fichero}' han sido eliminadas"

        return jsonify({"status": "success", "message": message})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/festivos', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_festivos():
    from flask import g
    check_and_create_festivos_table()

    if request.method == 'GET':
        year = request.args.get('year')
        ref_ubi = request.args.get('ref_ubi')
        params = {}
        where = []
        query = "SELECT * FROM FESTIVOS"
        if year:
            where.append("YEAR = :year")
            params['year'] = int(year)
        if ref_ubi:
            where.append("REF_UBI = :ref_ubi")
            params['ref_ubi'] = int(ref_ubi)
        if where:
            query += " WHERE " + " AND ".join(where)
        query += " ORDER BY FECHA"
        try:
            result = execute_query(query, params)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if request.method == 'POST':
        data = request.json or {}
        year = int(data.get('year'))
        ref_ubi = data.get('ref_ubi')
        fecha = data.get('fecha')
        descripcion = data.get('descripcion')
        if not year or not fecha:
            return jsonify({"error": "Se requieren 'year' y 'fecha'"}), 400
        try:
            db_type = getattr(g, 'db_type', 'oracle')
            if db_type == 'postgres':
                query = "INSERT INTO festivos (year, ref_ubi, fecha, descripcion) VALUES (:year, :ref_ubi, TO_DATE(:fecha, 'YYYY-MM-DD'), :descripcion)"
            else:
                # Oracle sequence
                query = "INSERT INTO FESTIVOS (ID_FESTIVO, YEAR, REF_UBI, FECHA, DESCRIPCION) VALUES (SEQ_FESTIVOS.NEXTVAL, :year, :ref_ubi, TO_DATE(:fecha, 'YYYY-MM-DD'), :descripcion)"
            params = { 'year': year, 'ref_ubi': int(ref_ubi) if ref_ubi is not None else None, 'fecha': fecha, 'descripcion': descripcion }
            execute_query(query, params, is_select=False)
            return jsonify({"status": "success"}), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if request.method == 'PUT':
        data = request.json or {}
        id_festivo = data.get('id_festivo') or data.get('id')
        if not id_festivo:
            return jsonify({"error": "Se requiere 'id_festivo'"}), 400
        year = data.get('year')
        ref_ubi = data.get('ref_ubi')
        fecha = data.get('fecha')
        descripcion = data.get('descripcion')
        try:
            query = "UPDATE FESTIVOS SET YEAR=:year, REF_UBI=:ref_ubi, FECHA=TO_DATE(:fecha, 'YYYY-MM-DD'), DESCRIPCION=:descripcion WHERE ID_FESTIVO=:id_festivo"
            params = { 'year': int(year) if year is not None else None, 'ref_ubi': int(ref_ubi) if ref_ubi is not None else None, 'fecha': fecha, 'descripcion': descripcion, 'id_festivo': int(id_festivo) }
            execute_query(query, params, is_select=False)
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if request.method == 'DELETE':
        id_festivo = request.args.get('id') or request.args.get('id_festivo')
        if not id_festivo:
            return jsonify({"error": "Se requiere 'id' param para eliminar"}), 400
        try:
            query = "DELETE FROM FESTIVOS WHERE ID_FESTIVO = :id_festivo"
            execute_query(query, {'id_festivo': int(id_festivo)}, is_select=False)
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route('/api/export-calendar', methods=['POST'])
def export_calendar():
    """Export calendar with styling to XLSX using openpyxl"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import PatternFill, Font, Alignment
        from io import BytesIO
        
        data = request.json
        months = data.get('months', [])  # List of {monthYear, days}
        employees = data.get('employees', [])  # List of employee names
        cellColors = data.get('cellColors', {})  # {cellRef: colorHex}
        
        wb = Workbook()
        ws = wb.active
        ws.title = 'Calendario'
        
        # Row 1: Month headers
        ws.append(['Empleado'] + [m['monthYear'].split()[0] for m in months])
        
        # Row 2: Day numbers
        dayRow = ['']
        for month in months:
            for day in month.get('days', []):
                dayRow.append(day.get('number', ''))
        ws.append(dayRow)
        
        # Employee data rows (starts at row 3)
        for emp in employees:
            row = [emp]
            # Add empty cells for each day
            totalDays = sum(len(m.get('days', [])) for m in months)
            row.extend([''] * totalDays)
            ws.append(row)
        
        # Apply colors
        colorMap = {
            'EF4444': PatternFill(start_color='FFEF4444', end_color='FFEF4444', fill_type='solid'),
            '60A5FA': PatternFill(start_color='FF60A5FA', end_color='FF60A5FA', fill_type='solid'),
            'C084FC': PatternFill(start_color='FFC084FC', end_color='FFC084FC', fill_type='solid'),
            'A7F3D0': PatternFill(start_color='FFA7F3D0', end_color='FFA7F3D0', fill_type='solid')
        }
        
        for cellRef, colorHex in cellColors.items():
            try:
                cell = ws[cellRef]
                if colorHex in colorMap:
                    cell.fill = colorMap[colorHex]
            except:
                pass  # Skip invalid cell refs
        
        # Column widths
        ws.column_dimensions['A'].width = 25
        for i in range(2, 100):
            ws.column_dimensions[chr(64 + i)].width = 4
        
        # Freeze panes
        ws.freeze_panes = 'B3'
        
        # Export to bytes
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        from flask import send_file
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'calendario_{data.get("year", 2026)}.xlsx'
        )
    except Exception as e:
        logging.error(f"Export error: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=config.PORT, host='0.0.0.0')

