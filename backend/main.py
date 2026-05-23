# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fpdf import FPDF
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import List, Optional
import database
from contextlib import asynccontextmanager
import math
import os
from datetime import date
# pyrefly: ignore [missing-import]
import arabic_reshaper
# pyrefly: ignore [missing-import]
from bidi.algorithm import get_display

FONTS_DIR = os.path.join(os.path.dirname(__file__), 'fonts')

def arabic_text(text):
    reshaped = arabic_reshaper.reshape(text)
    return get_display(reshaped)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    db_pool = await database.get_db_pool()
    yield
    if db_pool:
        db_pool.close()
        await db_pool.wait_closed()

app = FastAPI(title="Waste-Watcher EcoSort API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryPayload(BaseModel):
    sensor_id: int
    value: float
    status_code: int

class RouteCreate(BaseModel):
    truck_id: int
    driver_id: Optional[int] = None

class BinCreate(BaseModel):
    street_id: int
    waste_type: str
    current_level: float = 0.0
    latitude: float
    longitude: float
    importance_weight: float = 1.0

class BinUpdate(BaseModel):
    current_level: Optional[float] = None
    importance_weight: Optional[float] = None
    waste_type: Optional[str] = None

class TruckCreate(BaseModel):
    plate_number: str
    capacity: float

class TruckUpdate(BaseModel):
    plate_number: Optional[str] = None
    capacity: Optional[float] = None
    is_active: Optional[bool] = None

class DriverCreate(BaseModel):
    name: str
    license_no: str

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    license_no: Optional[str] = None

class LoginPayload(BaseModel):
    username: str
    password: str

class TripLogCreate(BaseModel):
    driver_id: int
    trip_date: str
    time_taken_seconds: int

class BinReportCreate(BaseModel):
    bin_id: int
    user_id: int
    report_type: str
    description: Optional[str] = None


@app.post("/api/v1/auth/login")
async def login(payload: LoginPayload):
    query = "SELECT user_id, username, password_hash, role FROM USERS WHERE username = %s"
    user = await database.fetch_one(db_pool, query, (payload.username,))
    if not user or user['password_hash'] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    result = {
        "user_id": user['user_id'],
        "username": user['username'],
        "role": user['role'],
    }

    if user['role'] == 'driver':
        driver = await database.fetch_one(db_pool, "SELECT driver_id FROM DRIVER WHERE user_id = %s", (user['user_id'],))
        if driver:
            result["driver_id"] = driver['driver_id']

    if user['role'] == 'client':
        profile = await database.fetch_one(db_pool, "SELECT zone FROM CLIENT_PROFILE WHERE user_id = %s", (user['user_id'],))
        if profile:
            result["zone"] = profile['zone']

    return result


@app.get("/api/v1/dashboard/admin/stats")
async def get_admin_stats():
    bins_total = await database.fetch_one(db_pool, "SELECT COUNT(*) as cnt FROM BIN")
    bins_critical = await database.fetch_one(db_pool, "SELECT COUNT(*) as cnt FROM BIN WHERE current_level * importance_weight >= 70")
    routes_active = await database.fetch_one(db_pool, "SELECT COUNT(*) as cnt FROM ROUTE WHERE status = 'IN_PROGRESS'")
    trucks_active = await database.fetch_one(db_pool, "SELECT COUNT(*) as cnt FROM TRUCK WHERE is_active = TRUE")
    alerts_unresolved = await database.fetch_one(db_pool, "SELECT COUNT(*) as cnt FROM ALERT WHERE is_resolved = FALSE")
    sensor_errors = await database.fetch_one(db_pool, "SELECT COUNT(*) as cnt FROM SENSOR_READING WHERE status_code != 0")

    return {
        "total_bins": bins_total['cnt'],
        "critical_bins": bins_critical['cnt'],
        "active_routes": routes_active['cnt'],
        "active_trucks": trucks_active['cnt'],
        "unresolved_alerts": alerts_unresolved['cnt'],
        "sensor_errors": sensor_errors['cnt'],
    }


@app.get("/api/v1/dashboard/client/bins")
async def get_client_bins(zone: str):
    query = """
        SELECT b.bin_id, b.street_id, b.waste_type, b.current_level, b.latitude, b.longitude,
               b.importance_weight, b.last_cleaned, s.street_name, l.neighborhood
        FROM BIN b
        JOIN STREET s ON b.street_id = s.street_id
        JOIN LOCATION l ON s.loc_id = l.loc_id
        WHERE l.neighborhood = %s
        ORDER BY b.bin_id
    """
    return await database.fetch_all(db_pool, query, (zone,))


@app.post("/api/v1/dashboard/bins/{bin_id}/emergency")
async def request_emergency_clearance(bin_id: int):
    bin_check = await database.fetch_one(db_pool, "SELECT bin_id FROM BIN WHERE bin_id = %s", (bin_id,))
    if not bin_check:
        raise HTTPException(status_code=404, detail="Bin not found")

    await database.execute_query(db_pool, "UPDATE BIN SET current_level = 100.00 WHERE bin_id = %s", (bin_id,))
    await database.execute_query(
        db_pool,
        "INSERT INTO ALERT (bin_id, alert_type, severity, message) VALUES (%s, 'OVERFLOW', 'CRITICAL', %s)",
        (bin_id, f"EMERGENCY: Bin #{bin_id} flagged for immediate clearance by resident")
    )
    return {"status": "success", "bin_id": bin_id, "message": "Emergency clearance requested"}


@app.get("/api/v1/dashboard/trip-logs")
async def get_trip_logs(driver_id: int):
    query = "SELECT log_id, driver_id, trip_date, time_taken_seconds FROM TRIP_LOGS WHERE driver_id = %s ORDER BY trip_date DESC"
    return await database.fetch_all(db_pool, query, (driver_id,))


@app.post("/api/v1/dashboard/trip-logs")
async def create_trip_log(log: TripLogCreate):
    query = "INSERT INTO TRIP_LOGS (driver_id, trip_date, time_taken_seconds) VALUES (%s, %s, %s)"
    log_id = await database.execute_query(db_pool, query, (log.driver_id, log.trip_date, log.time_taken_seconds))
    return {"status": "success", "log_id": log_id}


@app.post("/api/v1/dashboard/bin-reports")
async def create_bin_report(report: BinReportCreate):
    query = "INSERT INTO BIN_REPORT (bin_id, user_id, report_type, description) VALUES (%s, %s, %s, %s)"
    report_id = await database.execute_query(db_pool, query, (report.bin_id, report.user_id, report.report_type, report.description))
    if report.report_type == 'OVERFLOWING':
        await database.execute_query(db_pool, "UPDATE BIN SET current_level = 100.00 WHERE bin_id = %s", (report.bin_id,))
        await database.execute_query(
            db_pool,
            "INSERT INTO ALERT (bin_id, alert_type, severity, message) VALUES (%s, 'OVERFLOW', 'CRITICAL', %s)",
            (report.bin_id, f"REPORT: Bin #{report.bin_id} reported as overflowing by user #{report.user_id}")
        )
    return {"status": "success", "report_id": report_id}


@app.get("/api/v1/dashboard/bin-reports")
async def get_bin_reports(bin_id: Optional[int] = None, resolved: Optional[bool] = None):
    if bin_id is not None and resolved is not None:
        query = "SELECT * FROM BIN_REPORT WHERE bin_id = %s AND is_resolved = %s ORDER BY created_at DESC"
        return await database.fetch_all(db_pool, query, (bin_id, resolved))
    elif bin_id is not None:
        query = "SELECT * FROM BIN_REPORT WHERE bin_id = %s ORDER BY created_at DESC"
        return await database.fetch_all(db_pool, query, (bin_id,))
    elif resolved is not None:
        query = "SELECT * FROM BIN_REPORT WHERE is_resolved = %s ORDER BY created_at DESC LIMIT 100"
        return await database.fetch_all(db_pool, query, (resolved,))
    else:
        return await database.fetch_all(db_pool, "SELECT * FROM BIN_REPORT ORDER BY created_at DESC LIMIT 100")


@app.post("/api/v1/telemetry")
async def receive_telemetry(payload: TelemetryPayload):
    """IoT Ingestion Endpoint"""
    insert_query = """
        INSERT INTO SENSOR_READING (sensor_id, value, status_code)
        VALUES (%s, %s, %s)
    """
    await database.execute_query(db_pool, insert_query, (payload.sensor_id, payload.value, payload.status_code))
    
    sensor_query = "SELECT bin_id FROM SENSOR WHERE sensor_id = %s"
    sensor = await database.fetch_one(db_pool, sensor_query, (payload.sensor_id,))
    
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
        
    bin_id = sensor['bin_id']
    update_bin_query = "UPDATE BIN SET current_level = %s WHERE bin_id = %s"
    await database.execute_query(db_pool, update_bin_query, (payload.value, bin_id))
    
    return {"status": "success", "message": "Telemetry processed"}

@app.get("/api/v1/hardware/route-status")
async def get_hardware_route_status():
    """Returns minimal JSON array of bin_ids on active routes"""
    query = """
        SELECT rs.bin_id 
        FROM ROUTE_STOP rs
        JOIN ROUTE r ON rs.route_id = r.route_id
        WHERE r.status = 'IN_PROGRESS'
    """
    results = await database.fetch_all(db_pool, query)
    active_bins = [row['bin_id'] for row in results]
    return active_bins

@app.get("/api/v1/dashboard/streets")
async def get_all_streets():
    query = """
        SELECT s.street_id, s.street_name, l.neighborhood, l.city
        FROM STREET s
        JOIN LOCATION l ON s.loc_id = l.loc_id
        ORDER BY l.neighborhood, s.street_name
    """
    return await database.fetch_all(db_pool, query)

@app.get("/api/v1/dashboard/streets/fill-status")
async def get_street_fill_status():
    """Returns aggregated street-level fill averages using the SQL View"""
    query = "SELECT * FROM STREET_FILL_STATUS"
    results = await database.fetch_all(db_pool, query)
    return results

@app.get("/api/v1/dashboard/bins")
async def get_all_bins():
    query = """
        SELECT b.bin_id, b.street_id, b.waste_type, b.current_level, b.latitude, b.longitude,
               b.importance_weight, b.last_cleaned, s.street_name, l.neighborhood
        FROM BIN b
        JOIN STREET s ON b.street_id = s.street_id
        JOIN LOCATION l ON s.loc_id = l.loc_id
        ORDER BY b.bin_id
    """
    return await database.fetch_all(db_pool, query)

@app.post("/api/v1/dashboard/bins")
async def create_bin(bin_data: BinCreate):
    query = """
        INSERT INTO BIN (street_id, waste_type, current_level, latitude, longitude, importance_weight)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    bin_id = await database.execute_query(db_pool, query, (
        bin_data.street_id, bin_data.waste_type, bin_data.current_level,
        bin_data.latitude, bin_data.longitude, bin_data.importance_weight
    ))
    # Auto-create sensor for the new bin
    await database.execute_query(db_pool, "INSERT INTO SENSOR (bin_id, model_type) VALUES (%s, 'UltraSonic-v2')", (bin_id,))
    return {"status": "success", "bin_id": bin_id}

@app.patch("/api/v1/dashboard/bins/{bin_id}")
async def update_bin(bin_id: int, update: BinUpdate):
    fields, values = [], []
    if update.current_level is not None:
        fields.append("current_level = %s"); values.append(update.current_level)
    if update.importance_weight is not None:
        fields.append("importance_weight = %s"); values.append(update.importance_weight)
    if update.waste_type is not None:
        fields.append("waste_type = %s"); values.append(update.waste_type)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(bin_id)
    query = f"UPDATE BIN SET {', '.join(fields)} WHERE bin_id = %s"
    await database.execute_query(db_pool, query, tuple(values))
    return {"status": "success", "bin_id": bin_id}

@app.delete("/api/v1/dashboard/bins/{bin_id}")
async def delete_bin(bin_id: int):
    await database.execute_query(db_pool, "DELETE FROM BIN WHERE bin_id = %s", (bin_id,))
    return {"status": "success", "bin_id": bin_id}

@app.get("/api/v1/dashboard/trucks")
async def get_all_trucks():
    return await database.fetch_all(db_pool, "SELECT * FROM TRUCK ORDER BY truck_id")

@app.post("/api/v1/dashboard/trucks")
async def create_truck(truck: TruckCreate):
    query = "INSERT INTO TRUCK (plate_number, capacity) VALUES (%s, %s)"
    truck_id = await database.execute_query(db_pool, query, (truck.plate_number, truck.capacity))
    return {"status": "success", "truck_id": truck_id}

@app.patch("/api/v1/dashboard/trucks/{truck_id}")
async def update_truck(truck_id: int, update: TruckUpdate):
    fields, values = [], []
    if update.plate_number is not None:
        fields.append("plate_number = %s"); values.append(update.plate_number)
    if update.capacity is not None:
        fields.append("capacity = %s"); values.append(update.capacity)
    if update.is_active is not None:
        fields.append("is_active = %s"); values.append(update.is_active)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(truck_id)
    await database.execute_query(db_pool, f"UPDATE TRUCK SET {', '.join(fields)} WHERE truck_id = %s", tuple(values))
    return {"status": "success", "truck_id": truck_id}

@app.delete("/api/v1/dashboard/trucks/{truck_id}")
async def delete_truck(truck_id: int):
    await database.execute_query(db_pool, "DELETE FROM TRUCK WHERE truck_id = %s", (truck_id,))
    return {"status": "success", "truck_id": truck_id}

@app.get("/api/v1/dashboard/drivers")
async def get_all_drivers():
    return await database.fetch_all(db_pool, "SELECT * FROM DRIVER ORDER BY driver_id")

@app.post("/api/v1/dashboard/drivers")
async def create_driver(driver: DriverCreate):
    query = "INSERT INTO DRIVER (name, license_no) VALUES (%s, %s)"
    driver_id = await database.execute_query(db_pool, query, (driver.name, driver.license_no))
    return {"status": "success", "driver_id": driver_id}

@app.patch("/api/v1/dashboard/drivers/{driver_id}")
async def update_driver(driver_id: int, update: DriverUpdate):
    fields, values = [], []
    if update.name is not None:
        fields.append("name = %s"); values.append(update.name)
    if update.license_no is not None:
        fields.append("license_no = %s"); values.append(update.license_no)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
    values.append(driver_id)
    await database.execute_query(db_pool, f"UPDATE DRIVER SET {', '.join(fields)} WHERE driver_id = %s", tuple(values))
    return {"status": "success", "driver_id": driver_id}

@app.delete("/api/v1/dashboard/drivers/{driver_id}")
async def delete_driver(driver_id: int):
    await database.execute_query(db_pool, "DELETE FROM DRIVER WHERE driver_id = %s", (driver_id,))
    return {"status": "success", "driver_id": driver_id}

@app.get("/api/v1/dashboard/routes")
async def get_all_routes():
    query = """
        SELECT r.route_id, r.status, r.start_time, t.plate_number,
               d.name AS driver_name
        FROM ROUTE r
        JOIN TRUCK t ON r.truck_id = t.truck_id
        LEFT JOIN DRIVER d ON r.driver_id = d.driver_id
        ORDER BY r.route_id DESC
    """
    return await database.fetch_all(db_pool, query)

@app.delete("/api/v1/dashboard/routes/{route_id}")
async def delete_route(route_id: int):
    await database.execute_query(db_pool, "DELETE FROM ROUTE WHERE route_id = %s", (route_id,))
    return {"status": "success", "route_id": route_id}

@app.get("/api/v1/dashboard/routes/{route_id}/stops")
async def get_route_stops(route_id: int):
    query = """
        SELECT rs.stop_sequence, b.bin_id, b.waste_type, b.current_level, b.importance_weight,
               b.latitude, b.longitude, s.street_name, l.neighborhood, rs.is_collected
        FROM ROUTE_STOP rs
        JOIN BIN b ON rs.bin_id = b.bin_id
        JOIN STREET s ON b.street_id = s.street_id
        JOIN LOCATION l ON s.loc_id = l.loc_id
        WHERE rs.route_id = %s
        ORDER BY rs.stop_sequence ASC
    """
    stops = await database.fetch_all(db_pool, query, (route_id,))
    
    # Calculate distances between consecutive stops
    depot = (40.7128, -74.0060)
    enriched = []
    total_distance = 0.0
    for i, stop in enumerate(stops):
        if i == 0:
            leg_dist = haversine(depot[0], depot[1], float(stop['latitude']), float(stop['longitude']))
        else:
            prev = stops[i - 1]
            leg_dist = haversine(float(prev['latitude']), float(prev['longitude']), float(stop['latitude']), float(stop['longitude']))
        leg_dist_m = round(leg_dist * 1000, 1)  # Convert km to meters
        total_distance += leg_dist
        enriched.append({
            **stop,
            'distance_from_prev_m': leg_dist_m,
            'cumulative_distance_km': round(total_distance, 3),
        })
    return {"stops": enriched, "total_distance_km": round(total_distance, 3), "total_distance_m": round(total_distance * 1000, 1)}

@app.get("/api/v1/dashboard/routes/{route_id}/pdf")
async def generate_route_pdf(route_id: int):
    route_query = """
        SELECT r.route_id, r.start_time, t.plate_number 
        FROM ROUTE r
        JOIN TRUCK t ON r.truck_id = t.truck_id
        WHERE r.route_id = %s
    """
    route_info = await database.fetch_one(db_pool, route_query, (route_id,))
    if not route_info:
        raise HTTPException(status_code=404, detail="Route not found")
        
    stops_query = """
        SELECT rs.stop_sequence, b.bin_id, b.waste_type, b.current_level, b.importance_weight,
               b.latitude, b.longitude, s.street_name, l.neighborhood
        FROM ROUTE_STOP rs
        JOIN BIN b ON rs.bin_id = b.bin_id
        JOIN STREET s ON b.street_id = s.street_id
        JOIN LOCATION l ON s.loc_id = l.loc_id
        WHERE rs.route_id = %s
        ORDER BY rs.stop_sequence ASC
    """
    stops = await database.fetch_all(db_pool, stops_query, (route_id,))
    
    # Calculate distances
    depot = (40.7128, -74.0060)
    total_distance = 0.0
    leg_distances = []
    for i, stop in enumerate(stops):
        if i == 0:
            leg = haversine(depot[0], depot[1], float(stop['latitude']), float(stop['longitude']))
        else:
            prev = stops[i - 1]
            leg = haversine(float(prev['latitude']), float(prev['longitude']), float(stop['latitude']), float(stop['longitude']))
        leg_distances.append(leg)
        total_distance += leg
    
    # Build PDF (Landscape for more columns)
    pdf = FPDF(orientation='L')
    pdf.add_page()
    pdf.set_font("helvetica", "B", 18)
    pdf.cell(0, 12, "Waste-Watcher EcoSort", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 6, "Driver Route Itinerary & Collection Manifest", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(8)
    
    # Info row
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(70, 8, f"Route ID: {route_info['route_id']}")
    pdf.cell(70, 8, f"Truck: {route_info['plate_number']}")
    pdf.cell(70, 8, f"Date: {route_info['start_time']}")
    pdf.cell(0, 8, f"Stops: {len(stops)}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "B", 11)
    pdf.set_fill_color(41, 128, 185)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, f"   TOTAL ROUTE DISTANCE: {total_distance * 1000:.0f} meters ({total_distance:.2f} km)", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(6)
    
    # Table header
    col_w = [15, 20, 60, 45, 25, 25, 35, 30]
    headers = ["#", "Bin", "Location", "Coordinates", "Fill", "Priority", "Leg Distance", "Cumulative"]
    pdf.set_font("helvetica", "B", 8)
    pdf.set_fill_color(52, 73, 94)
    pdf.set_text_color(255, 255, 255)
    for i, h in enumerate(headers):
        last = i == len(headers) - 1
        pdf.cell(col_w[i], 9, h, border=1, fill=True, new_x="LMARGIN" if last else "RIGHT", new_y="NEXT" if last else "TOP")
    pdf.set_text_color(0, 0, 0)
    
    # Table rows
    pdf.set_font("helvetica", "", 8)
    cumulative = 0.0
    for i, stop in enumerate(stops):
        leg = leg_distances[i]
        cumulative += leg
        loc = f"{stop['street_name']}, {stop['neighborhood']}"
        coords = f"{stop['latitude']:.4f}, {stop['longitude']:.4f}"
        imp = "Hospital" if stop['importance_weight'] >= 2.0 else ("Industrial" if stop['importance_weight'] >= 1.5 else "Normal")
        
        # Alternate row colors
        if i % 2 == 0:
            pdf.set_fill_color(240, 240, 240)
        else:
            pdf.set_fill_color(255, 255, 255)
        
        vals = [
            str(stop['stop_sequence']),
            f"#{stop['bin_id']}",
            loc,
            coords,
            f"{stop['current_level']:.1f}%",
            imp,
            f"{leg * 1000:.0f} m",
            f"{cumulative:.2f} km",
        ]
        for j, v in enumerate(vals):
            last = j == len(vals) - 1
            pdf.cell(col_w[j], 8, v, border=1, fill=True, new_x="LMARGIN" if last else "RIGHT", new_y="NEXT" if last else "TOP")
        
    pdf_bytes = bytes(pdf.output())
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=route_{route_id}_itinerary.pdf"
    })

@app.get("/api/v1/dashboard/routes/{route_id}/pdf-ar")
async def generate_route_pdf_arabic(route_id: int):
    route_query = """
        SELECT r.route_id, r.start_time, t.plate_number
        FROM ROUTE r
        JOIN TRUCK t ON r.truck_id = t.truck_id
        WHERE r.route_id = %s
    """
    route_info = await database.fetch_one(db_pool, route_query, (route_id,))
    if not route_info:
        raise HTTPException(status_code=404, detail="Route not found")

    stops_query = """
        SELECT rs.stop_sequence, b.bin_id, b.waste_type, b.current_level, b.importance_weight,
               b.latitude, b.longitude, s.street_name, l.neighborhood
        FROM ROUTE_STOP rs
        JOIN BIN b ON rs.bin_id = b.bin_id
        JOIN STREET s ON b.street_id = s.street_id
        JOIN LOCATION l ON s.loc_id = l.loc_id
        WHERE rs.route_id = %s
        ORDER BY rs.stop_sequence ASC
    """
    stops = await database.fetch_all(db_pool, stops_query, (route_id,))

    depot = (40.7128, -74.0060)
    total_distance = 0.0
    leg_distances = []
    for i, stop in enumerate(stops):
        if i == 0:
            leg = haversine(depot[0], depot[1], float(stop['latitude']), float(stop['longitude']))
        else:
            prev = stops[i - 1]
            leg = haversine(float(prev['latitude']), float(prev['longitude']), float(stop['latitude']), float(stop['longitude']))
        leg_distances.append(leg)
        total_distance += leg

    pdf = FPDF(orientation='L')
    pdf.add_font('Amiri', '', os.path.join(FONTS_DIR, 'Amiri-Regular.ttf'), uni=True)
    pdf.add_font('Amiri', 'B', os.path.join(FONTS_DIR, 'Amiri-Bold.ttf'), uni=True)
    pdf.add_page()

    pdf.set_font('Amiri', 'B', 18)
    pdf.cell(0, 12, arabic_text('حارس النفايات - الفرز الذكي'), new_x='LMARGIN', new_y='NEXT', align='C')
    pdf.set_font('Amiri', '', 10)
    pdf.cell(0, 6, arabic_text('جدول مسار السائق وبيان الجمع'), new_x='LMARGIN', new_y='NEXT', align='C')
    pdf.ln(8)

    pdf.set_font('Amiri', 'B', 10)
    pdf.cell(70, 8, arabic_text(f'رقم المسار: {route_info["route_id"]}'))
    pdf.cell(70, 8, arabic_text(f'الشاحنة: {route_info["plate_number"]}'))
    pdf.cell(70, 8, arabic_text(f'التاريخ: {route_info["start_time"]}'))
    pdf.cell(0, 8, arabic_text(f'المحطات: {len(stops)}'), new_x='LMARGIN', new_y='NEXT')

    pdf.set_font('Amiri', 'B', 11)
    pdf.set_fill_color(41, 128, 185)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, arabic_text(f'   المسافة الإجمالية: {total_distance * 1000:.0f} متر ({total_distance:.2f} كم)'), new_x='LMARGIN', new_y='NEXT', fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(6)

    col_w = [30, 35, 25, 25, 45, 60, 20, 15]
    headers_ar = ['التراكمي', 'مسافة المرحلة', 'الأولوية', 'الامتلاء', 'الإحداثيات', 'الموقع', 'الحاوية', '#']
    pdf.set_font('Amiri', 'B', 8)
    pdf.set_fill_color(52, 73, 94)
    pdf.set_text_color(255, 255, 255)
    for i, h in enumerate(headers_ar):
        last = i == len(headers_ar) - 1
        pdf.cell(col_w[i], 9, arabic_text(h), border=1, fill=True, new_x='LMARGIN' if last else 'RIGHT', new_y='NEXT' if last else 'TOP')
    pdf.set_text_color(0, 0, 0)

    pdf.set_font('Amiri', '', 8)
    cumulative = 0.0
    waste_ar = {'General': 'عام', 'Recyclable': 'قابل للتدوير', 'Organic': 'عضوي', 'Hazardous': 'خطر'}
    for i, stop in enumerate(stops):
        leg = leg_distances[i]
        cumulative += leg
        loc = f"{stop['street_name']}, {stop['neighborhood']}"
        coords = f"{stop['latitude']:.4f}, {stop['longitude']:.4f}"
        imp_ar = 'مستشفى' if stop['importance_weight'] >= 2.0 else ('صناعي' if stop['importance_weight'] >= 1.5 else 'عادي')

        if i % 2 == 0:
            pdf.set_fill_color(240, 240, 240)
        else:
            pdf.set_fill_color(255, 255, 255)

        vals = [
            f"{cumulative:.2f} km",
            f"{leg * 1000:.0f} m",
            arabic_text(imp_ar),
            f"{stop['current_level']:.1f}%",
            coords,
            loc,
            f"#{stop['bin_id']}",
            str(stop['stop_sequence']),
        ]
        for j, v in enumerate(vals):
            last = j == len(vals) - 1
            pdf.cell(col_w[j], 8, v, border=1, fill=True, new_x='LMARGIN' if last else 'RIGHT', new_y='NEXT' if last else 'TOP')

    nav_header = arabic_text('روابط التنقل عبر خرائط جوجل')
    pdf.ln(6)
    pdf.set_font('Amiri', 'B', 10)
    pdf.cell(0, 8, nav_header, new_x='LMARGIN', new_y='NEXT')
    pdf.set_font('Amiri', '', 8)
    for stop in stops:
        link = f"https://www.google.com/maps/dir/?api=1&destination={stop['latitude']},{stop['longitude']}"
        label = arabic_text(f"محطة {stop['stop_sequence']} - حاوية #{stop['bin_id']}:")
        pdf.cell(80, 6, label)
        pdf.set_text_color(41, 128, 185)
        pdf.cell(0, 6, link, new_x='LMARGIN', new_y='NEXT', link=link)
        pdf.set_text_color(0, 0, 0)

    pdf_bytes = bytes(pdf.output())
    return Response(content=pdf_bytes, media_type='application/pdf', headers={
        'Content-Disposition': f'attachment; filename=route_{route_id}_itinerary_ar.pdf'
    })

@app.post("/api/v1/dashboard/routes")
async def create_route(route: RouteCreate):
    query = "INSERT INTO ROUTE (truck_id, driver_id, status) VALUES (%s, %s, 'IN_PROGRESS')"
    route_id = await database.execute_query(db_pool, query, (route.truck_id, route.driver_id))
    
    bins_query = "SELECT bin_id, latitude, longitude, current_level, importance_weight FROM BIN"
    bins = await database.fetch_all(db_pool, bins_query)
        
    # Priority Selection Filter
    selected_bins = [b for b in bins if float(b['current_level']) * float(b['importance_weight']) >= 70.0]
            
    # Shortest Path TSP Routing (Nearest Neighbor with Haversine)
    depot = (40.7128, -74.0060)
    current_pos = depot
    seq = 1
    total_distance = 0.0
    
    while selected_bins:
        closest_bin = None
        min_dist = float('inf')
        for b in selected_bins:
            dist = haversine(current_pos[0], current_pos[1], float(b['latitude']), float(b['longitude']))
            if dist < min_dist:
                min_dist = dist
                closest_bin = b
                
        stop_query = "INSERT INTO ROUTE_STOP (route_id, bin_id, stop_sequence) VALUES (%s, %s, %s)"
        await database.execute_query(db_pool, stop_query, (route_id, closest_bin['bin_id'], seq))
        seq += 1
        total_distance += min_dist
        current_pos = (float(closest_bin['latitude']), float(closest_bin['longitude']))
        selected_bins.remove(closest_bin)
        
    return {
        "status": "success",
        "route_id": route_id,
        "stops_created": seq - 1,
        "total_distance_km": round(total_distance, 3),
        "total_distance_m": round(total_distance * 1000, 1),
    }

@app.patch("/api/v1/dashboard/routes/{route_id}/stops/{bin_id}/collect")
async def mark_stop_collected(route_id: int, bin_id: int):
    """Mark a route stop as collected. The DB trigger auto-resets the bin level."""
    query = """
        UPDATE ROUTE_STOP
        SET is_collected = TRUE, actual_time = NOW()
        WHERE route_id = %s AND bin_id = %s
    """
    await database.execute_query(db_pool, query, (route_id, bin_id))
    return {"status": "success", "route_id": route_id, "bin_id": bin_id}

@app.get("/api/v1/dashboard/alerts")
async def get_alerts(resolved: Optional[bool] = None):
    """Get alerts, optionally filtered by resolution status."""
    if resolved is None:
        query = "SELECT * FROM ALERT ORDER BY created_at DESC LIMIT 100"
        return await database.fetch_all(db_pool, query)
    else:
        query = "SELECT * FROM ALERT WHERE is_resolved = %s ORDER BY created_at DESC LIMIT 100"
        return await database.fetch_all(db_pool, query, (resolved,))

@app.get("/api/v1/dashboard/alerts/active")
async def get_active_alerts():
    """Get active alerts using the ACTIVE_ALERTS view."""
    return await database.fetch_all(db_pool, "SELECT * FROM ACTIVE_ALERTS")

@app.patch("/api/v1/dashboard/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int):
    """Mark an alert as resolved."""
    query = "UPDATE ALERT SET is_resolved = TRUE, resolved_at = NOW() WHERE alert_id = %s"
    await database.execute_query(db_pool, query, (alert_id,))
    return {"status": "success", "alert_id": alert_id}

@app.get("/")
async def root():
    return {"message": "Welcome to Waste-Watcher EcoSort API"}
