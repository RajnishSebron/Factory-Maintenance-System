import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.ml.training_data import generate_training_dataset

if __name__ == "__main__":
    output = Path("data") / "synthetic_training_data.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    generate_training_dataset(output_path=output)
    print(f"Synthetic training data written to {output}")
