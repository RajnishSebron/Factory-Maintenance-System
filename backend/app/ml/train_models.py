from pathlib import Path
from datetime import datetime, timezone
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, average_precision_score, f1_score, mean_absolute_error, mean_squared_error, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from app.ml.features import FEATURE_COLUMNS


def train_models(dataset_path: str | Path = "data/synthetic_training_data.csv", artifacts_dir: str | Path = "artifacts") -> dict:
    data = pd.read_csv(dataset_path)
    required = set(FEATURE_COLUMNS + ["failure_within_24h", "rul_hours"])
    missing = required - set(data.columns)
    if missing:
        raise ValueError(f"Training dataset is missing columns: {sorted(missing)}")
    X = data[FEATURE_COLUMNS].fillna(data[FEATURE_COLUMNS].median())
    y_cls = data["failure_within_24h"].astype(int)
    y_rul = data["rul_hours"].astype(float)
    X_train, X_test, y_train_cls, y_test_cls = train_test_split(X, y_cls, test_size=0.2, random_state=42, stratify=y_cls)
    _, _, y_train_rul, y_test_rul = train_test_split(X, y_rul, test_size=0.2, random_state=42)

    failure_model = RandomForestClassifier(n_estimators=300, max_depth=12, min_samples_leaf=3, class_weight="balanced", random_state=42, n_jobs=-1)
    failure_model.fit(X_train, y_train_cls)
    pred_cls = failure_model.predict(X_test)
    prob_cls = failure_model.predict_proba(X_test)[:, 1]
    metrics_cls = {
        "accuracy": float(accuracy_score(y_test_cls, pred_cls)),
        "precision": float(precision_score(y_test_cls, pred_cls, zero_division=0)),
        "recall": float(recall_score(y_test_cls, pred_cls, zero_division=0)),
        "f1": float(f1_score(y_test_cls, pred_cls, zero_division=0)),
        "pr_auc": float(average_precision_score(y_test_cls, prob_cls)),
    }
    if y_test_cls.nunique() > 1:
        metrics_cls["roc_auc"] = float(roc_auc_score(y_test_cls, prob_cls))

    # Use the same chronological-independent fixed split seed for the regression task.
    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X, y_rul, test_size=0.2, random_state=42)
    rul_model = RandomForestRegressor(n_estimators=300, max_depth=14, min_samples_leaf=3, random_state=42, n_jobs=-1)
    rul_model.fit(X_train_r, y_train_r)
    pred_rul = rul_model.predict(X_test_r)
    metrics_rul = {
        "mae_hours": float(mean_absolute_error(y_test_r, pred_rul)),
        "rmse_hours": float(mean_squared_error(y_test_r, pred_rul) ** 0.5),
    }

    out = Path(artifacts_dir)
    out.mkdir(parents=True, exist_ok=True)
    version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    joblib.dump({"model": failure_model, "version": version, "metrics": metrics_cls, "features": FEATURE_COLUMNS}, out / "failure_model.joblib")
    joblib.dump({"model": rul_model, "version": version, "metrics": metrics_rul, "features": FEATURE_COLUMNS}, out / "rul_model.joblib")
    return {"version": version, "failure_metrics": metrics_cls, "rul_metrics": metrics_rul}


if __name__ == "__main__":
    print(train_models())
