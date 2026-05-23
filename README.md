# WWE (Waste-Watcher EcoSort)

WWE is a modern, full-stack waste management platform designed for the Egyptian market, featuring role-based portals for administrators, drivers, and residents (clients). It supports full English/Arabic internationalization (i18n), RTL layouts, dynamic routes, driver PDF exports (in Arabic), and exception reporting.

## Project Structure

- **`backend/`**: FastAPI backend with MySQL database integrations (asynchronous db calls, Amiri font Arabic PDF generator, and exception reports endpoint).
- **`ops-dashboard/`**: Operations Dashboard (port `5173`) serving Admins and Drivers.
- **`client-portal/`**: Dedicated Resident Portal (port `5174`) serving clients with active bin indicators and report submission.
- **`docker-compose.yml`**: MySQL 8.0 database configuration.

---

## Getting Started

### 1. Database Setup
Ensure Docker is installed and running, then start the MySQL database container:
```bash
docker-compose up -d
```

### 2. Backend Setup
Navigate to the backend directory, install the dependencies, seed the database, and launch the API server:
```bash
cd backend
pip install -r requirements.txt
python seed.py
uvicorn main:app --reload
```
The API server will run at `http://localhost:8000`.

### 3. Frontends Setup
For both the **Operations Dashboard** and the **Resident Portal**, run the following setup commands:

#### Operations Dashboard (Admin/Driver)
```bash
cd ops-dashboard
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

#### Resident Portal (Client)
```bash
cd client-portal
npm install
npm run dev
```
Open `http://localhost:5174` in your browser.

---

## Demo Accounts
To log in and test different roles, use the following credentials:
- **Admin**: `mohamed_admin` / Password: `password123`
- **Driver**: `driver_alex` / Password: `password123`
- **Client (Resident)**: `lena_client` / Password: `password123`
