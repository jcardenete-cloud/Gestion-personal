import pandas as pd
import json

excel_path = r"e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\vacaciones_ejemplo.xlsx"

try:
    xl = pd.ExcelFile(excel_path)
    print("Sheets in Excel file:", xl.sheet_names)
    
    # Let's inspect the first sheet
    df = xl.parse(xl.sheet_names[0])
    print(f"\nFirst sheet size: {df.shape}")
    print("\nColumns:")
    for idx, col in enumerate(df.columns):
        print(f"Col {idx} ({col}): {df.iloc[:2, idx].tolist() if len(df) > 0 else 'N/A'}")
        
    print("\nFirst 5 rows (raw):")
    print(df.head(5).to_string())
except Exception as e:
    print(f"Error reading Excel: {e}")
