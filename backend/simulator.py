import asyncio
import aiohttp
import random

API_BASE = "http://127.0.0.1:8000/api/v1"
CYCLE_INTERVAL = 3
BIN_COUNT = 47

async def send_telemetry(session, sensor_id, value, status_code):
    payload = {"sensor_id": sensor_id, "value": round(value, 2), "status_code": status_code}
    try:
        async with session.post(f"{API_BASE}/telemetry", json=payload) as resp:
            symbol = "✅" if resp.status == 200 else "❌"
            status_label = {0: "OK", 1: "BLOCKED", 2: "OFFLINE"}.get(status_code, "?")
            print(f"  {symbol} Sensor #{sensor_id:>2} → {value:5.1f}% [{status_label}]")
    except Exception as e:
        print(f"  ❌ Sensor #{sensor_id} → connection error: {e}")

async def run_simulator():
    print("=" * 50)
    print("  WWE IoT Telemetry Simulator")
    print(f"  Simulating {BIN_COUNT} sensors")
    print(f"  Cycle interval: {CYCLE_INTERVAL}s")
    print(f"  Target: {API_BASE}/telemetry")
    print("=" * 50)

    levels = {i: random.uniform(10.0, 60.0) for i in range(1, BIN_COUNT + 1)}
    cycle = 0

    async with aiohttp.ClientSession() as session:
        while True:
            cycle += 1
            print(f"\n{'─' * 40}")
            print(f"  CYCLE {cycle}")
            print(f"{'─' * 40}")

            sensors_this_cycle = random.sample(range(1, BIN_COUNT + 1), k=min(random.randint(5, 15), BIN_COUNT))

            tasks = []
            for sensor_id in sorted(sensors_this_cycle):
                drift = random.uniform(-2.0, 5.0)
                levels[sensor_id] = max(0.0, min(100.0, levels[sensor_id] + drift))

                roll = random.random()
                if roll < 0.03:
                    status_code = 2
                elif roll < 0.07:
                    status_code = 1
                else:
                    status_code = 0

                tasks.append(send_telemetry(session, sensor_id, levels[sensor_id], status_code))

            await asyncio.gather(*tasks)
            print(f"\n  ⏳ Next cycle in {CYCLE_INTERVAL}s...")
            await asyncio.sleep(CYCLE_INTERVAL)

if __name__ == "__main__":
    try:
        asyncio.run(run_simulator())
    except KeyboardInterrupt:
        print("\n\n  🛑 Simulator stopped.")
