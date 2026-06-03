# Proyecto de Gestión de Encargos y Personal

Este proyecto consta de un backend en Python (Flask) y un frontend en React (Vite).

## Requisitos
- Python 3.8+
- Node.js 18+
- Base de Datos Oracle

## Configuración del Backend
1. Navega a la carpeta `server`.
2. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
3. Edita `database.properties` con tus credenciales de Oracle.
4. Ejecuta el servidor:
   ```bash
   python app.py
   ```
   El servidor correrá en `http://localhost:5000`.

## Configuración del Frontend
1. Navega a la carpeta `client`.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:5173`.

## Estructura de Tablas
La aplicación espera que las tablas `ENCARGOS`, `PERSONAL_PROYECTOS` y `LISTA_PERSONAL` existan en el esquema configurado.
