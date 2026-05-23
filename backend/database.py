import os
# pyrefly: ignore [missing-import]
import aiomysql
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "wwe_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "wwepassword")
DB_NAME = os.getenv("DB_NAME", "wwe_db")

async def get_db_pool():
    pool = await aiomysql.create_pool(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        autocommit=True,
        cursorclass=aiomysql.DictCursor
    )
    return pool

async def get_root_pool():
    pool = await aiomysql.create_pool(
        host=DB_HOST,
        port=DB_PORT,
        user="root",
        password="rootpassword",
        db=DB_NAME,
        autocommit=True,
        cursorclass=aiomysql.DictCursor
    )
    return pool

async def fetch_all(pool, query, args=()):
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, args)
            return await cur.fetchall()

async def fetch_one(pool, query, args=()):
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, args)
            return await cur.fetchone()

async def execute_query(pool, query, args=()):
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, args)
            return cur.lastrowid
