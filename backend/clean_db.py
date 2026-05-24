import asyncio
import database

async def clean_non_hosary():
    pool = await database.get_db_pool()
    
    print("Finding non-Hosary locations...")
    locs = await database.fetch_all(pool, "SELECT loc_id FROM LOCATION WHERE neighborhood != 'Al Hosary District'")
    
    if not locs:
        print("No non-Hosary locations found.")
    else:
        for l in locs:
            # ALERT table uses SET NULL, so we manually delete those to keep DB clean
            bins = await database.fetch_all(pool, "SELECT bin_id FROM BIN WHERE street_id IN (SELECT street_id FROM STREET WHERE loc_id = %s)", (l['loc_id'],))
            for b in bins:
                await database.execute_query(pool, "DELETE FROM ALERT WHERE bin_id = %s", (b['bin_id'],))
                
            await database.execute_query(pool, "DELETE FROM LOCATION WHERE loc_id = %s", (l['loc_id'],))
            print(f"Deleted location {l['loc_id']} and all cascading data (streets, bins, sensors, readings, stops, reports).")
    
    # Also clean up any routes that have no stops
    await database.execute_query(pool, "DELETE FROM ROUTE WHERE route_id NOT IN (SELECT route_id FROM ROUTE_STOP)")
    print("Cleaned up empty routes.")
    
    # Check total bins
    total = await database.fetch_one(pool, "SELECT COUNT(*) as c FROM BIN")
    print(f"Total bins remaining: {total['c']}")
    
    pool.close()
    await pool.wait_closed()

if __name__ == '__main__':
    asyncio.run(clean_non_hosary())
