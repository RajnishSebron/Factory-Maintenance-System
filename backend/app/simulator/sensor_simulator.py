import os
import random
import time
import requests
from app.core.config import settings


class SensorSimulator:
    def __init__(self) -> None:
        self.base_url = settings.simulator_api_url.rstrip("/")
        self.session = requests.Session()
        self.operating_hours: dict[int, float] = {}

    def login(self) -> None:
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"email": settings.admin_email, "password": settings.admin_password},
            timeout=15,
        )
        response.raise_for_status()

    def get_equipment(self) -> list[dict]:
        response = self.session.get(f"{self.base_url}/equipment", timeout=15)
        response.raise_for_status()
        return response.json()

    def generate_reading(self, equipment_id: int) -> dict:
        hours = self.operating_hours.get(equipment_id, 500.0) + random.uniform(0.01, 0.08)
        self.operating_hours[equipment_id] = hours
        # Occasional drift makes the demo stream show changing operating conditions.
        drift = random.choice([0.0, 0.0, 0.0, random.uniform(5.0, 18.0)])
        temperature = random.uniform(48, 72) + drift
        vibration = random.uniform(0.5, 3.5) + drift * 0.12
        pressure = random.uniform(3.5, 7.5) - drift * 0.04
        current = random.uniform(7, 18) + drift * 0.25
        return {
            "temperature": round(temperature, 2),
            "vibration": round(max(0.1, vibration), 2),
            "pressure": round(max(0.1, pressure), 2),
            "rpm": round(random.uniform(1400, 1800), 1),
            "current": round(current, 2),
            "operating_hours": round(hours, 2),
            "source": "simulator",
        }

    def run_forever(self) -> None:
        self.login()
        print("Sensor simulator started. Stop with Ctrl+C.")
        while True:
            try:
                equipment = self.get_equipment()
                for item in equipment:
                    if item.get("status") != "active":
                        continue
                    payload = self.generate_reading(item["id"])
                    response = self.session.post(f"{self.base_url}/telemetry/{item['id']}", json=payload, timeout=15)
                    if response.status_code >= 400:
                        print(f"Telemetry error for {item['asset_tag']}: {response.text}")
                    else:
                        print(f"Sent reading for {item['asset_tag']}")
                time.sleep(settings.simulator_interval_seconds)
            except requests.RequestException as exc:
                print(f"Simulator API error: {exc}. Retrying in 5 seconds.")
                time.sleep(5)


if __name__ == "__main__":
    SensorSimulator().run_forever()
