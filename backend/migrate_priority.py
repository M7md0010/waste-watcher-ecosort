import asyncio
import database

async def run():
    pool = await database.get_db_pool()

    root_pool = await database.get_root_pool()

    await database.execute_query(root_pool, "SET GLOBAL log_bin_trust_function_creators = 1")
    print("Enabled log_bin_trust_function_creators")

    existing = await database.fetch_all(pool, """
        SELECT TRIGGER_NAME FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = 'wwe_db' AND TRIGGER_NAME = 'trg_bin_needs_collection'
    """)
    if existing:
        await database.execute_query(pool, "DROP TRIGGER trg_bin_needs_collection")
        print("Dropped existing trigger")

    await database.execute_query(pool, """
        CREATE TRIGGER trg_bin_needs_collection
        AFTER UPDATE ON BIN
        FOR EACH ROW
        BEGIN
            IF NEW.current_level * NEW.importance_weight >= 70.0
               AND OLD.current_level * OLD.importance_weight < 70.0 THEN
                INSERT INTO ALERT (bin_id, alert_type, severity, message)
                VALUES (
                    NEW.bin_id,
                    'NEEDS_COLLECTION',
                    CASE
                        WHEN NEW.current_level * NEW.importance_weight >= 90.0 THEN 'CRITICAL'
                        WHEN NEW.current_level * NEW.importance_weight >= 80.0 THEN 'HIGH'
                        ELSE 'MEDIUM'
                    END,
                    CONCAT('Bin #', NEW.bin_id, ' priority score reached ',
                           ROUND(NEW.current_level * NEW.importance_weight, 1),
                           ' — flagged for collection')
                );
            END IF;
        END
    """)
    print("Trigger trg_bin_needs_collection created")

    rows = await database.fetch_all(pool, "SELECT bin_id, priority_score, street_name, neighborhood FROM BINS_NEEDING_COLLECTION LIMIT 5")
    print(f"\nView returns {len(rows)} qualifying bins (showing first 5):")
    for r in rows:
        print(f"  Bin #{r['bin_id']} score={r['priority_score']} at {r['street_name']}, {r['neighborhood']}")

    root_pool.close()
    await root_pool.wait_closed()
    pool.close()
    await pool.wait_closed()

if __name__ == "__main__":
    asyncio.run(run())
