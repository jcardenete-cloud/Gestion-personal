import pandas as pd
import re

excel_path = r"e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\vacaciones_ejemplo.xlsx"
df = pd.read_excel(excel_path)

def parse_excel_date(val):
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
        
    # Check if it has datetime format (like YYYY-MM-DD HH:MM:SS)
    if ' ' in val_str:
        val_str = val_str.split(' ')[0]
        
    # Try standard YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', val_str):
        return val_str
        
    # Try DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$', val_str)
    if m:
        d, m_val, y = m.groups()
        if len(y) == 3 and y.startswith('20'): # like 206 -> 2026
            y = '2026' # Safe fallback for this year context
        elif len(y) == 2:
            y = '20' + y
        return f"{int(y):04d}-{int(m_val):02d}-{int(d):02d}"
        
    # Try DD/MMYYYY typo (like 30/072026)
    m = re.match(r'^(\d{1,2})/(\d{1,2})(\d{4})$', val_str)
    if m:
        d, m_val, y = m.groups()
        return f"{int(y):04d}-{int(m_val):02d}-{int(d):02d}"
        
    # Try DD/MM/YY typo (like 21/08/206 where it's missing a number)
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d+)$', val_str)
    if m:
        d, m_val, y = m.groups()
        if len(y) == 3 and y == '206':
            y = '2026'
        elif len(y) == 1:
            y = '202' + y
        return f"{int(y):04d}-{int(m_val):02d}-{int(d):02d}"

    return val_str # return as-is for preview

print("Parsing vacation records from excel:")
parsed_records = []
for idx in range(7, len(df)): # starting after header rows
    row = df.iloc[idx]
    user = row.iloc[1]
    if pd.isna(user) or str(user).strip().lower() in ['', 'nan', 'usuario', 'personal']:
        continue
        
    user = str(user).strip()
    
    # Check partitions G to X (6 partitions)
    for p in range(6):
        days_idx = 6 + p * 3
        desde_idx = 7 + p * 3
        hasta_idx = 8 + p * 3
        
        days_val = row.iloc[days_idx]
        desde_val = row.iloc[desde_idx]
        hasta_val = row.iloc[hasta_idx]
        
        if pd.notna(desde_val) or pd.notna(hasta_val):
            parsed_desde = parse_excel_date(desde_val)
            parsed_hasta = parse_excel_date(hasta_val)
            
            # Clean days_val
            days = None
            if pd.notna(days_val):
                try:
                    days = float(days_val)
                except ValueError:
                    days = days_val
                    
            record = {
                "row": idx + 2, # excel row is 1-indexed and pandas skips header row 0 in a specific way, but idx+2 gives approximate row
                "username": user,
                "partition": p + 1,
                "days": days,
                "desde": parsed_desde,
                "hasta": parsed_hasta,
                "desde_raw": str(desde_val),
                "hasta_raw": str(hasta_val)
            }
            parsed_records.append(record)
            print(f"Row {idx+2}: User={user}, Part={p+1}, Days={days}, Desde={parsed_desde} (raw={desde_val}), Hasta={parsed_hasta} (raw={hasta_val})")

print(f"\nTotal vacation intervals found: {len(parsed_records)}")
