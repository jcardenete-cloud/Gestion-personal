import sys
import os

# Add server directory to path
sys.path.append(r'e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\server')

from supabase_client import select as sb_select

print("Fetching LISTA_PERSONAL from Supabase/PostgreSQL...")
try:
    users = sb_select('LISTA_PERSONAL')
    print(f"Total users found: {len(users)}")
    if users:
        print("First 5 users:")
        for u in users[:5]:
            print(f"- REF_PER: {u.get('REF_PER')}, USUARIO: {u.get('USUARIO')}, NOMBRE: {u.get('NOMBRE')}, ACTIVO: {u.get('ACTIVO')}")
except Exception as e:
    print(f"Error querying Supabase: {e}")
