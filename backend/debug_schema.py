import asyncio
from database import engine
from sqlalchemy import inspect, text

async def check():
    async with engine.connect() as conn:
        def get_tables(connection):
            inspector = inspect(connection)
            return inspector.get_table_names()
        
        tables = await conn.run_sync(get_tables)
        print(f"Tables: {tables}")
        
        if "agent_outputs" in tables:
            def get_cols(connection):
                inspector = inspect(connection)
                return inspector.get_columns("agent_outputs")
            cols = await conn.run_sync(get_cols)
            col_names = [c['name'] for c in cols]
            print(f"Columns in agent_outputs: {col_names}")
        else:
            print("Table agent_outputs is MISSING!")

if __name__ == "__main__":
    asyncio.run(check())
