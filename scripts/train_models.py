import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.ml.train_models import train_models

if __name__ == "__main__":
    print(train_models())
