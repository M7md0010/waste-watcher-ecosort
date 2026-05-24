import asyncio
import database

BINS = [
    {"street": "Al Hosary Square", "waste": "General", "level": 92.0, "lat": 29.97280, "lng": 30.94400, "weight": 2.0},
    {"street": "Al Hosary Square", "waste": "Recyclable", "level": 88.0, "lat": 29.97230, "lng": 30.94470, "weight": 1.0},
    {"street": "Al Hosary Square", "waste": "Organic", "level": 45.0, "lat": 29.97310, "lng": 30.94350, "weight": 1.0},
    {"street": "First District Main Rd", "waste": "General", "level": 95.0, "lat": 29.97550, "lng": 30.94150, "weight": 1.5},
    {"street": "First District Main Rd", "waste": "Hazardous", "level": 30.0, "lat": 29.97650, "lng": 30.93950, "weight": 1.5},
    {"street": "First District Main Rd", "waste": "Recyclable", "level": 85.0, "lat": 29.97450, "lng": 30.94280, "weight": 1.0},
    {"street": "First District Main Rd", "waste": "Organic", "level": 60.0, "lat": 29.97700, "lng": 30.93800, "weight": 1.0},
    {"street": "Second District Ave", "waste": "General", "level": 90.0, "lat": 29.96900, "lng": 30.94600, "weight": 1.0},
    {"street": "Second District Ave", "waste": "Recyclable", "level": 40.0, "lat": 29.96800, "lng": 30.94750, "weight": 1.0},
    {"street": "Second District Ave", "waste": "Organic", "level": 87.0, "lat": 29.96950, "lng": 30.94500, "weight": 1.5},
    {"street": "Second District Ave", "waste": "Hazardous", "level": 55.0, "lat": 29.96700, "lng": 30.94850, "weight": 1.0},
    {"street": "Mehwar Rd", "waste": "General", "level": 78.0, "lat": 29.97100, "lng": 30.95000, "weight": 1.0},
    {"street": "Mehwar Rd", "waste": "Recyclable", "level": 91.0, "lat": 29.97000, "lng": 30.95150, "weight": 1.0},
    {"street": "Mehwar Rd", "waste": "Organic", "level": 35.0, "lat": 29.97200, "lng": 30.94900, "weight": 1.0},
    {"street": "Central Axis", "waste": "General", "level": 86.0, "lat": 29.97400, "lng": 30.94650, "weight": 1.0},
    {"street": "Central Axis", "waste": "Recyclable", "level": 25.0, "lat": 29.97350, "lng": 30.94750, "weight": 1.0},
    {"street": "Central Axis", "waste": "Hazardous", "level": 93.0, "lat": 29.97500, "lng": 30.94550, "weight": 2.0},
    {"street": "Central Axis", "waste": "Organic", "level": 50.0, "lat": 29.97150, "lng": 30.94800, "weight": 1.0},
]

STREETS = [
    "Al Hosary Square",
    "First District Main Rd",
    "Second District Ave",
    "Mehwar Rd",
    "Central Axis",
]

async def seed():
    print("Seeding Al Hosary District bins...")
    pool = await database.get_db_pool()

    existing = await database.fetch_one(
        pool,
        "SELECT loc_id FROM LOCATION WHERE city = '6th of October City' AND neighborhood = 'Al Hosary District'"
    )

    if existing:
        loc_id = existing['loc_id']
        print(f"Location already exists (loc_id={loc_id}), cleaning old data...")
        streets = await database.fetch_all(pool, "SELECT street_id FROM STREET WHERE loc_id = %s", (loc_id,))
        for s in streets:
            await database.execute_query(pool, "DELETE FROM BIN WHERE street_id = %s", (s['street_id'],))
            await database.execute_query(pool, "DELETE FROM STREET WHERE street_id = %s", (s['street_id'],))
    else:
        loc_id = await database.execute_query(
            pool,
            "INSERT INTO LOCATION (city, neighborhood) VALUES ('6th of October City', 'Al Hosary District')"
        )
        print(f"Created location (loc_id={loc_id})")

    street_ids = {}
    for name in STREETS:
        sid = await database.execute_query(
            pool, "INSERT INTO STREET (loc_id, street_name) VALUES (%s, %s)", (loc_id, name)
        )
        street_ids[name] = sid
        print(f"  Street: {name} (id={sid})")

    bin_count = 0
    for b in BINS:
        bid = await database.execute_query(
            pool,
            "INSERT INTO BIN (street_id, waste_type, current_level, latitude, longitude, importance_weight) VALUES (%s, %s, %s, %s, %s, %s)",
            (street_ids[b["street"]], b["waste"], b["level"], b["lat"], b["lng"], b["weight"])
        )
        await database.execute_query(
            pool, "INSERT INTO SENSOR (bin_id, model_type, battery_status) VALUES (%s, 'UltraSonic-v2', 95.00)", (bid,)
        )
        tag = "[CRIT]" if b["level"] * b["weight"] >= 70 else "[OK]"
        print(f"  {tag} Bin #{bid}: {b['waste']} on {b['street']} - {b['level']}% (w={b['weight']})")
        bin_count += 1

    print(f"\nDone! {bin_count} bins seeded in Al Hosary District.")
    pool.close()
    await pool.wait_closed()

if __name__ == "__main__":
    asyncio.run(seed())
