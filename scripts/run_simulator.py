import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.simulator.sensor_simulator import SensorSimulator

if __name__ == "__main__":
    SensorSimulator().run_forever()
