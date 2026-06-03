import pandas as pd

excel_path = r"e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\vacaciones_ejemplo.xlsx"
df = pd.read_excel(excel_path)

# Let's inspect the first 25 columns and first 20 rows
# We will use .iloc to extract by index position
print(f"Excel shape: {df.shape}")

# Let's print row indices and column letters
# A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14, P=15, Q=16, R=17, S=18, T=19, U=20, V=21, W=22, X=23
col_indices = [1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
col_letters = ["B", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"]

print("\nRow samples for columns B and G-X:")
for row_idx in range(len(df)):
    row_data = df.iloc[row_idx]
    user_val = row_data.iloc[1]
    
    # We only care if there is some data or a user listed
    # Let's print the row number and the username
    non_null_partitions = []
    for p in range(6): # 6 partitions
        days_col = 6 + p * 3
        desde_col = 7 + p * 3
        hasta_col = 8 + p * 3
        
        days = row_data.iloc[days_col]
        desde = row_data.iloc[desde_col]
        hasta = row_data.iloc[hasta_col]
        
        if pd.notna(desde) or pd.notna(hasta) or pd.notna(days):
            non_null_partitions.append(f"P{p+1}: (dias={days}, desde={desde}, hasta={hasta})")
            
    if pd.notna(user_val) or len(non_null_partitions) > 0:
        print(f"Row {row_idx}: Col B (User)='{user_val}' | Partitions: {', '.join(non_null_partitions)}")
