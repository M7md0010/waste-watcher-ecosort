-- =============================================================
-- Waste-Watcher EcoSort — Database Schema
-- Engine: MySQL 8.0+
-- Normalization: Third Normal Form (3NF)
-- =============================================================

-- -----------------------------------
-- 1. LOCATION
-- Represents a city-neighborhood pair.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS LOCATION (
    loc_id INT AUTO_INCREMENT PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_location (city, neighborhood)
) ENGINE=InnoDB;

-- -----------------------------------
-- 2. STREET
-- A street belongs to exactly one location.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS STREET (
    street_id INT AUTO_INCREMENT PRIMARY KEY,
    loc_id INT NOT NULL,
    street_name VARCHAR(150) NOT NULL,
    FOREIGN KEY (loc_id) REFERENCES LOCATION(loc_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_street_location (loc_id)
) ENGINE=InnoDB;

-- -----------------------------------
-- 3. BIN
-- A waste-collection bin placed on a street.
-- Uses DECIMAL for precision, ENUM for type safety,
-- and CHECK constraints for domain validation.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS BIN (
    bin_id INT AUTO_INCREMENT PRIMARY KEY,
    street_id INT NOT NULL,
    waste_type ENUM('General', 'Recyclable', 'Organic', 'Hazardous') NOT NULL,
    current_level DECIMAL(5,2) DEFAULT 0.00
        CHECK (current_level >= 0.00 AND current_level <= 100.00),
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    importance_weight DECIMAL(3,1) DEFAULT 1.0
        CHECK (importance_weight > 0),
    last_cleaned DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (street_id) REFERENCES STREET(street_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_bin_street (street_id),
    INDEX idx_bin_level_weight (current_level, importance_weight)
) ENGINE=InnoDB;

-- -----------------------------------
-- 4. SENSOR
-- Each bin has exactly one ultrasonic sensor (1:1).
-- UNIQUE on bin_id enforces this cardinality.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS SENSOR (
    sensor_id INT AUTO_INCREMENT PRIMARY KEY,
    bin_id INT NOT NULL UNIQUE,
    model_type ENUM('UltraSonic-v2', 'UltraSonic-v1', 'IR-Sensor') NOT NULL,
    battery_status DECIMAL(5,2) DEFAULT 100.00
        CHECK (battery_status >= 0.00 AND battery_status <= 100.00),
    FOREIGN KEY (bin_id) REFERENCES BIN(bin_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------
-- 5. SENSOR_READING
-- Time-series telemetry data from sensors.
-- status_code: 0=OK, 1=Blocked, 2=Offline
-- -----------------------------------
CREATE TABLE IF NOT EXISTS SENSOR_READING (
    reading_id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT NOT NULL,
    value DECIMAL(5,2) NOT NULL
        CHECK (value >= 0.00 AND value <= 100.00),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status_code TINYINT NOT NULL DEFAULT 0
        CHECK (status_code IN (0, 1, 2)),
    FOREIGN KEY (sensor_id) REFERENCES SENSOR(sensor_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_reading_sensor (sensor_id),
    INDEX idx_reading_timestamp (timestamp)
) ENGINE=InnoDB;

-- -----------------------------------
-- 6. TRUCK
-- A collection vehicle in the fleet.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS TRUCK (
    truck_id INT AUTO_INCREMENT PRIMARY KEY,
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    capacity DECIMAL(10,2) NOT NULL
        CHECK (capacity > 0),
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS USERS (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'client', 'driver') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CLIENT_PROFILE (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    zone VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS DRIVER (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    license_no VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(20) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS TRIP_LOGS (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    trip_date DATE NOT NULL,
    time_taken_seconds INT NOT NULL,
    FOREIGN KEY (driver_id) REFERENCES DRIVER(driver_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_trip_driver (driver_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS BIN_REPORT (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    bin_id INT NOT NULL,
    user_id INT NOT NULL,
    report_type ENUM('BLOCKED','VANDALIZED','ODOR','ILLEGAL_DUMPING','OVERFLOWING','OTHER') NOT NULL,
    description VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (bin_id) REFERENCES BIN(bin_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_report_bin (bin_id),
    INDEX idx_report_user (user_id)
) ENGINE=InnoDB;

-- -----------------------------------
-- 8. TRUCK_ASSIGNMENT
-- Maps a driver to a truck for a shift window.
-- shift_end NULL = shift currently active.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS TRUCK_ASSIGNMENT (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    truck_id INT NOT NULL,
    shift_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    shift_end DATETIME NULL,
    CHECK (shift_end IS NULL OR shift_end >= shift_start),
    FOREIGN KEY (driver_id) REFERENCES DRIVER(driver_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (truck_id) REFERENCES TRUCK(truck_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_assignment_driver (driver_id),
    INDEX idx_assignment_truck (truck_id)
) ENGINE=InnoDB;

-- -----------------------------------
-- 9. ROUTE
-- A collection route assigned to a truck+driver.
-- Links directly to both TRUCK and DRIVER for
-- audit trail (avoids fragile join through TRUCK_ASSIGNMENT).
-- -----------------------------------
CREATE TABLE IF NOT EXISTS ROUTE (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    truck_id INT NOT NULL,
    driver_id INT NULL,
    target_street_id INT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME NULL,
    status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'PENDING',
    CHECK (end_time IS NULL OR end_time >= start_time),
    FOREIGN KEY (truck_id) REFERENCES TRUCK(truck_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES DRIVER(driver_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (target_street_id) REFERENCES STREET(street_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_route_status (status),
    INDEX idx_route_truck (truck_id)
) ENGINE=InnoDB;

-- -----------------------------------
-- 10. ROUTE_STOP
-- Individual bin stops within a route.
-- Composite PK (route_id, bin_id) prevents duplicates.
-- -----------------------------------
CREATE TABLE IF NOT EXISTS ROUTE_STOP (
    route_id INT NOT NULL,
    bin_id INT NOT NULL,
    stop_sequence INT NOT NULL,
    actual_time DATETIME NULL,
    is_collected BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (route_id, bin_id),
    FOREIGN KEY (route_id) REFERENCES ROUTE(route_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (bin_id) REFERENCES BIN(bin_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_route_stop_route (route_id)
) ENGINE=InnoDB;

-- -----------------------------------
-- 11. ALERT
-- System-generated notifications for anomalies
-- (overflow, sensor offline, low battery, etc.)
-- -----------------------------------
CREATE TABLE IF NOT EXISTS ALERT (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    bin_id INT NULL,
    sensor_id INT NULL,
    alert_type ENUM('OVERFLOW', 'SENSOR_OFFLINE', 'SENSOR_LOW_BATTERY', 'BLOCKED') NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    message VARCHAR(255) NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    FOREIGN KEY (bin_id) REFERENCES BIN(bin_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES SENSOR(sensor_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_alert_unresolved (is_resolved, created_at),
    INDEX idx_alert_bin (bin_id),
    INDEX idx_alert_type (alert_type)
) ENGINE=InnoDB;

-- =============================================================
-- TRIGGERS — Automated monitoring & data integrity
-- =============================================================

-- Trigger: Auto-generate OVERFLOW alert when bin level exceeds 90%
DELIMITER //
CREATE TRIGGER trg_bin_overflow_alert
AFTER UPDATE ON BIN
FOR EACH ROW
BEGIN
    IF NEW.current_level >= 90.00 AND OLD.current_level < 90.00 THEN
        INSERT INTO ALERT (bin_id, alert_type, severity, message)
        VALUES (
            NEW.bin_id,
            'OVERFLOW',
            CASE
                WHEN NEW.current_level >= 95.00 THEN 'CRITICAL'
                ELSE 'HIGH'
            END,
            CONCAT('Bin #', NEW.bin_id, ' fill level reached ', NEW.current_level, '%')
        );
    END IF;
END //
DELIMITER ;

-- Trigger: Auto-generate alert when sensor reading reports offline (status_code = 2)
DELIMITER //
CREATE TRIGGER trg_sensor_offline_alert
AFTER INSERT ON SENSOR_READING
FOR EACH ROW
BEGIN
    DECLARE v_bin_id INT;

    IF NEW.status_code = 2 THEN
        SELECT bin_id INTO v_bin_id FROM SENSOR WHERE sensor_id = NEW.sensor_id;
        INSERT INTO ALERT (bin_id, sensor_id, alert_type, severity, message)
        VALUES (
            v_bin_id,
            NEW.sensor_id,
            'SENSOR_OFFLINE',
            'HIGH',
            CONCAT('Sensor #', NEW.sensor_id, ' reported OFFLINE status')
        );
    ELSEIF NEW.status_code = 1 THEN
        SELECT bin_id INTO v_bin_id FROM SENSOR WHERE sensor_id = NEW.sensor_id;
        INSERT INTO ALERT (bin_id, sensor_id, alert_type, severity, message)
        VALUES (
            v_bin_id,
            NEW.sensor_id,
            'BLOCKED',
            'MEDIUM',
            CONCAT('Sensor #', NEW.sensor_id, ' reported BLOCKED status')
        );
    END IF;
END //
DELIMITER ;

-- Trigger: Auto-generate alert when sensor battery drops below 20%
DELIMITER //
CREATE TRIGGER trg_sensor_low_battery
AFTER UPDATE ON SENSOR
FOR EACH ROW
BEGIN
    IF NEW.battery_status < 20.00 AND OLD.battery_status >= 20.00 THEN
        INSERT INTO ALERT (bin_id, sensor_id, alert_type, severity, message)
        VALUES (
            NEW.bin_id,
            NEW.sensor_id,
            'SENSOR_LOW_BATTERY',
            CASE
                WHEN NEW.battery_status < 5.00 THEN 'CRITICAL'
                WHEN NEW.battery_status < 10.00 THEN 'HIGH'
                ELSE 'MEDIUM'
            END,
            CONCAT('Sensor #', NEW.sensor_id, ' battery at ', NEW.battery_status, '%')
        );
    END IF;
END //
DELIMITER ;

-- Trigger: Reset bin level & update last_cleaned when a stop is marked as collected
DELIMITER //
CREATE TRIGGER trg_collection_cleanup
AFTER UPDATE ON ROUTE_STOP
FOR EACH ROW
BEGIN
    IF NEW.is_collected = TRUE AND OLD.is_collected = FALSE THEN
        UPDATE BIN
        SET current_level = 0.00,
            last_cleaned = NOW()
        WHERE bin_id = NEW.bin_id;
    END IF;
END //
DELIMITER ;

-- =============================================================
-- VIEWS — Pre-built analytical queries
-- =============================================================

-- View: Aggregated street-level fill status
CREATE OR REPLACE VIEW STREET_FILL_STATUS AS
SELECT
    s.street_id,
    s.street_name,
    l.city,
    l.neighborhood,
    COUNT(b.bin_id) AS total_bins,
    IFNULL(AVG(b.current_level), 0) AS avg_fill_level,
    IFNULL(MAX(b.current_level), 0) AS max_fill_level
FROM
    STREET s
JOIN
    LOCATION l ON s.loc_id = l.loc_id
LEFT JOIN
    BIN b ON s.street_id = b.street_id
GROUP BY
    s.street_id, s.street_name, l.city, l.neighborhood;

-- View: Active alerts dashboard
CREATE OR REPLACE VIEW ACTIVE_ALERTS AS
SELECT
    a.alert_id,
    a.alert_type,
    a.severity,
    a.message,
    a.created_at,
    b.bin_id,
    b.waste_type,
    b.current_level,
    s.street_name,
    l.neighborhood
FROM
    ALERT a
LEFT JOIN
    BIN b ON a.bin_id = b.bin_id
LEFT JOIN
    STREET s ON b.street_id = s.street_id
LEFT JOIN
    LOCATION l ON s.loc_id = l.loc_id
WHERE
    a.is_resolved = FALSE
ORDER BY
    FIELD(a.severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
    a.created_at DESC;

-- View: Fleet overview with current driver assignments
CREATE OR REPLACE VIEW FLEET_OVERVIEW AS
SELECT
    t.truck_id,
    t.plate_number,
    t.capacity,
    t.is_active,
    d.driver_id,
    d.name AS driver_name,
    ta.shift_start,
    ta.shift_end
FROM
    TRUCK t
LEFT JOIN
    TRUCK_ASSIGNMENT ta ON t.truck_id = ta.truck_id
        AND ta.shift_end IS NULL
LEFT JOIN
    DRIVER d ON ta.driver_id = d.driver_id;
