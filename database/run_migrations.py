import psycopg2
import os

conn_string = "postgresql://postgres.vcdulcpzaplohpkxzbnm:Hfkma1609%40@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
seed_file = os.path.join(os.path.dirname(__file__), "seed.sql")

files = sorted([
    os.path.join(migrations_dir, f)
    for f in os.listdir(migrations_dir)
    if f.endswith(".sql")
]) + [seed_file]

conn = psycopg2.connect(
    host="db.vcdulcpzaplohpkxzbnm.supabase.co",
    port=5432,
    dbname="postgres",
    user="postgres",
    password="Hfkma1609@",
    sslmode="require"
)
conn.autocommit = True
cur = conn.cursor()

for path in files:
    print(f"Running {os.path.basename(path)}...", end=" ")
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    try:
        cur.execute(sql)
        print("OK")
    except Exception as e:
        print(f"ERROR: {e}")

cur.close()
conn.close()
print("\nDone.")
