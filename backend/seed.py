import asyncio
import database
import random

async def seed():
    print("Seeding database...")
    pool = await database.get_db_pool()

    neighborhoods = [
        "Downtown",
        "Riverside",
        "Uptown",
        "Industrial Zone",
        "Westside",
        "Sector 4",
    ]
    for n in neighborhoods:
        await database.execute_query(pool, "INSERT INTO LOCATION (city, neighborhood) VALUES ('Metro City', %s)", (n,))

    streets = [
        (1, "Main St"),
        (1, "Broadway"),
        (1, "Central Ave"),
        (2, "River Rd"),
        (2, "Harbor Blvd"),
        (3, "Park Lane"),
        (3, "Elm St"),
        (3, "Maple Ave"),
        (4, "Factory Rd"),
        (4, "Warehouse St"),
        (5, "Sunset Blvd"),
        (5, "Ocean Dr"),
        (6, "Sector 4 Main Rd"),
        (6, "Sector 4 East Ln"),
    ]
    for loc_id, name in streets:
        await database.execute_query(pool, "INSERT INTO STREET (loc_id, street_name) VALUES (%s, %s)", (loc_id, name))

    street_configs = [
        (1,  4, 40.7128, -74.0060, False),
        (2,  5, 40.7145, -74.0080, True),
        (3,  3, 40.7110, -74.0040, False),
        (4,  4, 40.7200, -73.9990, False),
        (5,  3, 40.7220, -74.0010, True),
        (6,  4, 40.7300, -74.0120, False),
        (7,  3, 40.7280, -74.0150, False),
        (8,  3, 40.7320, -74.0090, False),
        (9,  5, 40.7050, -74.0200, True),
        (10, 4, 40.7030, -74.0220, False),
        (11, 3, 40.7100, -74.0300, False),
        (12, 3, 40.7080, -74.0320, False),
    ]

    waste_types = ["General", "Recyclable", "Organic", "Hazardous"]
    bin_id = 1

    for street_id, num_bins, base_lat, base_lng, has_priority in street_configs:
        for i in range(num_bins):
            lat = round(base_lat + random.uniform(-0.008, 0.008), 6)
            lng = round(base_lng + random.uniform(-0.008, 0.008), 6)
            waste = random.choice(waste_types)

            level = round(random.uniform(15.0, 95.0), 2)

            if has_priority and i == 0:
                weight = 2.0
            elif street_id in [9, 10]:
                weight = 1.5
            else:
                weight = 1.0

            await database.execute_query(
                pool,
                "INSERT INTO BIN (street_id, waste_type, current_level, latitude, longitude, importance_weight) VALUES (%s, %s, %s, %s, %s, %s)",
                (street_id, waste, level, lat, lng, weight)
            )
            await database.execute_query(
                pool,
                "INSERT INTO SENSOR (bin_id, model_type, battery_status) VALUES (%s, 'UltraSonic-v2', %s)",
                (bin_id, round(random.uniform(40.0, 100.0), 2))
            )
            bin_id += 1

    sector4_bins = [
        (13, "General", 45.00, 40.7350, -74.0180, 1.0),
        (13, "Recyclable", 85.00, 40.7355, -74.0175, 1.0),
        (14, "Organic", 30.00, 40.7360, -74.0190, 1.0),
    ]
    for street_id, waste, level, lat, lng, weight in sector4_bins:
        await database.execute_query(
            pool,
            "INSERT INTO BIN (street_id, waste_type, current_level, latitude, longitude, importance_weight) VALUES (%s, %s, %s, %s, %s, %s)",
            (street_id, waste, level, lat, lng, weight)
        )
        await database.execute_query(
            pool,
            "INSERT INTO SENSOR (bin_id, model_type, battery_status) VALUES (%s, 'UltraSonic-v2', %s)",
            (bin_id, round(random.uniform(60.0, 100.0), 2))
        )
        bin_id += 1

    await database.execute_query(pool, "INSERT INTO TRUCK (plate_number, capacity) VALUES ('ABC-123', 8000.00)")
    await database.execute_query(pool, "INSERT INTO TRUCK (plate_number, capacity) VALUES ('XYZ-987', 8000.00)")
    await database.execute_query(pool, "INSERT INTO TRUCK (plate_number, capacity) VALUES ('DEF-456', 6000.00)")
    await database.execute_query(pool, "INSERT INTO TRUCK (plate_number, capacity) VALUES ('TRK-2026', 7500.00)")

    await database.execute_query(pool, "INSERT INTO USERS (username, password_hash, role) VALUES ('mohamed_admin', 'password123', 'admin')")
    await database.execute_query(pool, "INSERT INTO USERS (username, password_hash, role) VALUES ('lena_client', 'password123', 'client')")
    await database.execute_query(pool, "INSERT INTO USERS (username, password_hash, role) VALUES ('driver_alex', 'password123', 'driver')")

    await database.execute_query(pool, "INSERT INTO CLIENT_PROFILE (user_id, zone) VALUES (2, 'Sector 4')")

    await database.execute_query(pool, "INSERT INTO DRIVER (user_id, name, license_no, phone) VALUES (3, 'Alex Rivera', 'LIC-ALEX', '+1-555-0200')")
    await database.execute_query(pool, "INSERT INTO DRIVER (name, license_no, phone) VALUES ('John Doe', 'LIC-001', '+1-555-0101')")
    await database.execute_query(pool, "INSERT INTO DRIVER (name, license_no, phone) VALUES ('Jane Smith', 'LIC-002', '+1-555-0102')")
    await database.execute_query(pool, "INSERT INTO DRIVER (name, license_no, phone) VALUES ('Carlos Reyes', 'LIC-003', '+1-555-0103')")

    await database.execute_query(pool, "INSERT INTO TRUCK_ASSIGNMENT (driver_id, truck_id) VALUES (1, 4)")
    await database.execute_query(pool, "INSERT INTO TRUCK_ASSIGNMENT (driver_id, truck_id) VALUES (2, 1)")
    await database.execute_query(pool, "INSERT INTO TRUCK_ASSIGNMENT (driver_id, truck_id) VALUES (3, 2)")
    await database.execute_query(pool, "INSERT INTO TRUCK_ASSIGNMENT (driver_id, truck_id) VALUES (4, 3)")

    await database.execute_query(pool, "INSERT INTO TRIP_LOGS (driver_id, trip_date, time_taken_seconds) VALUES (1, '2026-05-20', 2340)")
    await database.execute_query(pool, "INSERT INTO TRIP_LOGS (driver_id, trip_date, time_taken_seconds) VALUES (1, '2026-05-18', 1875)")

    await database.execute_query(pool, "INSERT INTO BIN_REPORT (bin_id, user_id, report_type, description) VALUES (3, 3, 'BLOCKED', 'Car parked in front of bin')")
    await database.execute_query(pool, "INSERT INTO BIN_REPORT (bin_id, user_id, report_type, description) VALUES (%s, 2, 'ODOR', 'Strong smell from bin area')", (bin_id - 2,))

    print(f"Database seeding complete! {bin_id - 1} bins created across {len(street_configs) + 1} streets in {len(neighborhoods)} neighborhoods.")
    print("Users created: mohamed_admin (admin), lena_client (client), driver_alex (driver)")
    pool.close()
    await pool.wait_closed()

if __name__ == "__main__":
    asyncio.run(seed())
