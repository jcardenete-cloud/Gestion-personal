# Proyecto de Gestión de Encargos y Personal

Este proyecto consta de un backend en Python (Flask) y un frontend en React (Vite). Está diseñado para ser compatible tanto con bases de datos **Oracle** (modo Thin/Thick) como con **Postgres** (a través de la API y SDK de **Supabase**).

## Requisitos

- Python 3.8+
- Node.js 18+
- Base de datos Oracle o una instancia de Supabase (PostgreSQL)

---

## Configuración del Backend

1. Navega a la carpeta `server`.
2. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
3. Configura la base de datos en `database.properties` (desarrollo local) o mediante variables de entorno (producción/Render).

### Opciones de Configuración (`database.properties`)

Crea o edita el archivo `server/database.properties` con las siguientes propiedades según tu base de datos:

#### Para Oracle Database:
```properties
db.user=tu_usuario
db.password=tu_contrasena
db.dsn=host:puerto/nombre_servicio
# Si utilizas Thick mode, indica la ruta al Oracle Instant Client (ej. C:\oracle\instantclient_21_3)
db.client_path=ruta_al_instant_client
```

#### Para PostgreSQL / Supabase:
```properties
# Configuración de Postgres directa
pg.host=tu_pg_host
pg.project_ref=tu_project_ref
pg.database=postgres
pg.schema=jcf
pg.port=5432

# Credenciales de API de Supabase para acceso HTTP
supabase.url=https://tu_proyecto.supabase.co
supabase.key=tu_supabase_anon_key
```

### Variables de Entorno (Producción / Render)

En entornos de producción (configurados en `render.yaml`), las siguientes variables de entorno tienen prioridad sobre el archivo `database.properties`:
- `PORT`: Puerto en el que corre el servidor backend (por defecto `5000`).
- `SECRET_KEY`: Clave secreta para las sesiones de Flask.
- `PG_HOST`: Host de la base de datos PostgreSQL.
- `PG_PROJECT_REF`: Referencia del proyecto en Supabase.
- `PG_DATABASE`: Nombre de la base de datos (por defecto `postgres`).
- `PG_SCHEMA`: Esquema de la base de datos (por defecto `jcf`).
- `PG_PORT`: Puerto (por defecto `5432`).
- `PG_PASSWORD`: Contraseña de PostgreSQL (utilizada a nivel de aplicación para verificar el inicio de sesión en el modo Postgres).
- `SUPABASE_URL`: URL del proyecto de Supabase.
- `SUPABASE_KEY`: Clave de API (Service/Anon Key) de Supabase.

4. Ejecuta el servidor de desarrollo local:
   ```bash
   python app.py
   ```
   El servidor correrá en `http://localhost:5000` (o el puerto configurado en `PORT`).

---

## Configuración del Frontend

1. Navega a la carpeta `client`.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. (Opcional) Configura la URL del backend mediante variables de entorno en un archivo `.env` o `.env.production` (ej. `VITE_API_URL=https://tu-backend.com/api`).
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:5173`.

> [!NOTE]
> La aplicación frontend permite configurar la URL del backend en la pantalla de inicio de sesión. Esta URL tiene prioridad y se guarda en el `localStorage` del navegador.

---

## Automatización y Scripts (Desarrollo Local en Windows)

El proyecto incluye scripts preparados para facilitar el control de los servicios en sistemas Windows:

- **`start_services.bat`**: Inicia tanto el backend como el frontend en segundo plano.
- **`stop_services.bat`**: Detiene automáticamente cualquier proceso escuchando en los puertos `5000` (Backend) y `5173` (Frontend).
- **`run_hidden.vbs`**: Ejecuta `start_services.bat` de forma oculta para no dejar consolas abiertas.
- **`create_shortcuts.ps1`**: Script de PowerShell que crea dos accesos directos en tu escritorio ("Arrancar Gestion Personal" y "Detener Gestion Personal") para controlar la aplicación con un solo clic.

Para crear los accesos directos, abre PowerShell en la raíz del proyecto y ejecuta:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\create_shortcuts.ps1
```

---

## Estructura de Tablas

La aplicación gestiona y espera que existan las siguientes tablas en el esquema configurado:

- **`UBICACION`**: Almacena las sedes u oficinas del personal (`REF_UBI`, `A_LUGAR`).
- **`ENCARGOS`**: Proyectos o encargos asignados (`CODIGOPR`, `NOMBRE`, `AREA`, `INICIO`, `FIN`, `CLIENTE`, `FIN_REAL`, `PRESUPUESTO`, `DESCRIPCION`, `INFOR`).
- **`LISTA_PERSONAL`**: Información de los empleados (`REF_PER`, `NOMBRE`, `APELLIDO1`, `APELLIDO2`, `PERFIL`, `BAJA`, `USUARIO`, `ACTIVO`, `REF_UBI`, `INCORPORACION`, `IDEMPLEADO`, etc.).
- **`PERSONAL_PROYECTOS`**: Relación y asignación de personal a proyectos/encargos (`REF_PER`, `CODIGOPR`, `ALTA`, `BAJA`, `PORCENTAJE`, `RTP`).
- **`VACACIONES`**: Control de días festivos y periodos de vacaciones de la plantilla (`ID_VACACION`, `REF_PER`, `DURACION`, `FECHA_DESDE`, `FECHA_HASTA`, `PARTICION_NUM`, `ORIGEN_FICHERO`, `FECHA_CARGA`).
- **`FESTIVOS`**: Registro de días inhábiles por sede (`ID_FESTIVO`, `YEAR`, `REF_UBI`, `FECHA`, `DESCRIPCION`).

> [!TIP]
> Si se utiliza **Oracle**, el backend creará automáticamente las tablas `VACACIONES` y `FESTIVOS`, así como sus respectivas secuencias (`SEQ_VACACIONES`, `SEQ_FESTIVOS`), si detecta que no existen en el inicio de la petición.
> En **Postgres / Supabase**, se asume que todo el esquema de tablas ha sido creado previamente.

---

## Despliegue e Integración Continua (CI/CD)

- **Render**: Configurado mediante [render.yaml](file:///e:/fcardene/Utiles/Repositorio_DevOps/Gestion-Personal/render.yaml) para desplegar el backend en Python utilizando `waitress` (`run_prod.py`).
- **Azure Pipelines**: Configurado en [azure-pipelines.yml](file:///e:/fcardene/Utiles/Repositorio_DevOps/Gestion-Personal/azure-pipelines.yml) para sincronizar automáticamente la rama `main` del repositorio de Azure DevOps con un repositorio espejo de GitHub mediante un Personal Access Token (`GITHUB_PAT`).
