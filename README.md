# Predictive Maintenance System

A local predictive-maintenance application built with **FastAPI, MySQL, SQLAlchemy, scikit-learn, HTML, CSS and Vanilla JavaScript**. It simulates industrial sensor telemetry, predicts equipment failure risk within the next 24 hours, estimates Remaining Useful Life (RUL), creates alerts, records maintenance activity and streams dashboard updates with Server-Sent Events (SSE).

> **Project status:** This repository is intended for local development, learning and demonstration. It is not a certified industrial safety system. The included training labels and sensor simulator are synthetic; model outputs must not be used as the sole basis for real maintenance or safety decisions.

## Features

- **Equipment management:** create, update and view equipment, thresholds and operating status.
- **Sensor simulator:** generates temperature, vibration, pressure, RPM, current and operating-hour readings.
- **Failure prediction:** Random Forest classification estimates whether equipment may fail within the next 24 hours.
- **Remaining Useful Life:** Random Forest regression estimates RUL in operating hours.
- **Prediction triggers:** scheduled inference every 10 minutes and event-triggered inference when configured sensor thresholds are breached.
- **Alerts:** risk-based alerts, alert history and acknowledgement workflow.
- **Maintenance history:** create and review maintenance records.
- **Real-time dashboard:** SSE streams sensor, prediction and alert events to the browser.
- **Role-based access control:** Admin, Engineer and Viewer roles.
- **Historical trends:** sensor history charts for temperature, vibration, pressure, RPM and current.
- **ML model monitoring:** training metrics, model versions, prediction counts and fallback counts.
- **Reports and exports:** date/equipment-filtered CSV and Excel workbook exports.

## Technology stack

| Layer | Technology |
|---|---|
| Backend API | Python, FastAPI, Uvicorn |
| ORM / database access | SQLAlchemy 2.x |
| Database | MySQL 8.0+ |
| Database driver | PyMySQL |
| Authentication | JWT in an HttpOnly cookie; Bearer token supported by API clients |
| Password hashing | Argon2 |
| Scheduling | APScheduler |
| Machine learning | pandas, NumPy, scikit-learn, joblib |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Live updates | Server-Sent Events (SSE) |

## System configuration

- Failure prediction horizon: **24 hours**.
- Scheduled prediction interval: **10 minutes**.
- Sensor simulator interval: **5 seconds** by default.
- Prediction triggers: **scheduled and event-triggered**, with manual prediction available through the API/UI.
- ML tasks: **failure-within-24-hours classification and RUL regression**.
- Supported roles: **Admin, Engineer and Viewer**.
- Database: **MySQL**.

## Repository structure

```text
predictive-maintenance-system/
├── backend/
│   └── app/
│       ├── api/
│       │   └── v1/
│       │       └── endpoints/       # FastAPI route handlers
│       ├── core/                    # Configuration and security helpers
│       ├── db/                      # SQLAlchemy session and DB initialization
│       ├── events/                  # In-memory SSE event broker
│       ├── ml/                      # Feature engineering, training and inference
│       ├── models/                  # SQLAlchemy models
│       ├── schemas/                 # Pydantic request/response schemas
│       ├── services/                # Telemetry, prediction and alert logic
│       ├── simulator/               # Sensor simulator
│       └── workers/                 # Scheduled prediction worker
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   └── js/
│   ├── pages/
│   ├── index.html
│   └── login.html
├── artifacts/                       # Generated model artifacts (not committed)
├── data/                            # Generated training data (not committed)
├── scripts/
│   ├── generate_training_data.py
│   ├── train_models.py
│   └── run_simulator.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Prerequisites

Install the following software before starting:

1. **Python 3.11** (Python 3.10+ is required by the syntax used in the code; Python 3.11 is recommended).
2. **MySQL Server 8.0 or newer**.
3. **MySQL Workbench** or another MySQL client.
4. **Git**.
5. A code editor such as Visual Studio Code.

This project is configured for local development. Docker and deployment infrastructure are not included.

## Run locally

Run all commands from the repository root (`predictive-maintenance-system/`) unless stated otherwise.

### 1. Clone the repository

```bash
git clone https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY>.git
cd predictive-maintenance-system
```

Replace the repository URL and folder name with your own.

### 2. Create the MySQL database and application user

Start the MySQL service and execute the following SQL as a MySQL administrator. Replace the example database password with a strong password of your own.

```sql
CREATE DATABASE IF NOT EXISTS predictive_maintenance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'pm_user'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_STRONG_DATABASE_PASSWORD';

CREATE USER IF NOT EXISTS 'pm_user'@'127.0.0.1'
  IDENTIFIED BY 'REPLACE_WITH_A_STRONG_DATABASE_PASSWORD';

GRANT ALL PRIVILEGES ON predictive_maintenance.*
  TO 'pm_user'@'localhost';

GRANT ALL PRIVILEGES ON predictive_maintenance.*
  TO 'pm_user'@'127.0.0.1';

FLUSH PRIVILEGES;
```

Use the same password in both MySQL user statements. The two host entries allow the local account to authenticate whether the MySQL client identifies the connection as `localhost` or `127.0.0.1`.

### 3. Create your local environment file

Copy the example file:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

Open `.env` and fill in the required values. At minimum, configure:

```dotenv
APP_NAME=Predictive Maintenance System
ENVIRONMENT=development

# Generate a unique secret using the command shown below.
SECRET_KEY=PASTE_YOUR_GENERATED_SECRET_HERE
ACCESS_TOKEN_EXPIRE_MINUTES=480
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Use the same password created for pm_user in MySQL.
DATABASE_URL=mysql+pymysql://pm_user:URL_ENCODED_DATABASE_PASSWORD@127.0.0.1:3306/predictive_maintenance?charset=utf8mb4

CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=SET_A_UNIQUE_PASSWORD_AT_LEAST_12_CHARACTERS_LONG

PREDICTION_INTERVAL_MINUTES=10
FAILURE_HORIZON_HOURS=24
EVENT_TRIGGER_ENABLED=true
ALERT_FAILURE_PROBABILITY=0.60
HIGH_RISK_FAILURE_PROBABILITY=0.80
CRITICAL_RISK_FAILURE_PROBABILITY=0.95
SIMULATOR_INTERVAL_SECONDS=5
SIMULATOR_API_URL=http://127.0.0.1:8000/api/v1
ARTIFACTS_DIR=artifacts
```

Generate a strong application secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the generated value into `SECRET_KEY`. Use an administrator password of at least 12 characters. The security configuration added in Step 20.1 rejects missing or weak required secrets and passwords.

**Database password encoding:** If the MySQL password contains URL-reserved characters such as `@`, `/`, `:`, `#` or `%`, percent-encode those characters in the `DATABASE_URL`. Do not change the actual MySQL password to the encoded text; encoding is only for the URL.

For local HTTP development, keep `COOKIE_SECURE=false`. Set it to `true` when serving the application over HTTPS. Do not use wildcard CORS origins with credentialed cookies.

### 4. Create and activate a Python virtual environment

```bash
python -m venv .venv
```

**Windows PowerShell**

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation in the current terminal, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux**

```bash
source .venv/bin/activate
```

### 5. Install Python dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 6. Create database tables and the administrator account

The tables are created from the SQLAlchemy models. Run the commands from the repository root.

**Windows PowerShell**

```powershell
$env:PYTHONPATH = "backend"
python -m app.db.init_db
python -m app.db.create_admin
```

**macOS / Linux**

```bash
export PYTHONPATH=backend
python -m app.db.init_db
python -m app.db.create_admin
```

The first command creates the tables if they do not already exist. The second creates the Admin account using `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. If that email already exists, the command reports that the account exists and does not reset its password.

### 7. Generate the synthetic training dataset and train both models

Run from the repository root:

```bash
python scripts/generate_training_data.py
python scripts/train_models.py
```

This creates:

```text
 data/
   synthetic_training_data.csv

 artifacts/
   failure_model.joblib
   rul_model.joblib
```

The dataset contains synthetic sensor features, a `failure_within_24h` classification target and a `rul_hours` regression target. The training scripts save the model versions and evaluation metrics in the Joblib artifacts.

The generated CSV and `.joblib` files are intentionally excluded from Git by `.gitignore`. A developer who clones the repository can regenerate them by running the two commands above.

### 8. Start the FastAPI backend

Open **Terminal 1** at the repository root. Activate the virtual environment and start Uvicorn:

```powershell
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "backend"
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

On macOS/Linux, activate `.venv` using `source .venv/bin/activate`, then run:

```bash
export PYTHONPATH=backend
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

The scheduler starts with the FastAPI application.

- API documentation: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

**Run one backend process only.** The prediction scheduler and SSE event broker are in-process components. Do not start multiple Uvicorn workers for this local configuration, otherwise each worker may run its own scheduler and maintain a separate in-memory SSE broker.

### 9. Start the frontend

Open **Terminal 2** at the repository root:

```powershell
python -m http.server 5500 --directory frontend
```

Open <http://127.0.0.1:5500/login.html> in your browser.

The API and SSE addresses are configured in `frontend/assets/js/config.js`. The defaults are:

```javascript
API_BASE_URL: "http://127.0.0.1:8000/api/v1",
SSE_URL: "http://127.0.0.1:8000/api/v1/events/stream",
```

Keep the frontend and backend hostnames consistent with the local CORS configuration. The browser uses the backend's HttpOnly `access_token` cookie for authenticated API and SSE requests.

### 10. Sign in and create an equipment record

Sign in using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values set in `.env`.

Before running the simulator, create at least one **active** equipment record using the dashboard or `POST /api/v1/equipment` in Swagger. Example request body:

```json
{
  "name": "CNC Machine 001",
  "asset_tag": "CNC-001",
  "equipment_type": "CNC Milling Machine",
  "location": "Production Floor - Unit 1",
  "criticality": "medium",
  "status": "active",
  "thresholds": {
    "temperature_max": 85.0,
    "vibration_max": 7.0,
    "pressure_min": 1.0,
    "pressure_max": 12.0,
    "current_max": 30.0
  }
}
```

Public registration creates Viewer accounts. Admin users can create Engineer and Viewer accounts through user management.

### 11. Start the sensor simulator

Open **Terminal 3** at the repository root:

```powershell
.\.venv\Scripts\Activate.ps1
python scripts/run_simulator.py
```

The simulator logs in using the configured Admin credentials, retrieves active equipment and posts synthetic sensor readings at the interval configured by `SIMULATOR_INTERVAL_SECONDS` (5 seconds by default).

Keep the backend, frontend server and simulator running in their own terminals. Stop each process with `Ctrl+C`.

## How the prediction workflow works

```text
Sensor simulator / telemetry API
              |
              v
       FastAPI telemetry route
              |
              v
        MySQL sensor_readings
              |
              v
       Feature engineering
              |
       +------+------+
       |             |
       v             v
 Failure model    RUL model
 Classifier       Regressor
       |             |
       +------+------+
              |
              v
     Prediction records
              |
        Alert service
              |
              v
       MySQL alerts
              |
              v
       SSE event broker
              |
              v
       Browser dashboard
```

- **Scheduled inference:** runs every `PREDICTION_INTERVAL_MINUTES` for active equipment with usable readings.
- **Event-triggered inference:** runs when a new telemetry reading breaches the equipment's configured thresholds, when enabled.
- **Manual inference:** can be initiated from the dashboard or `POST /api/v1/predictions/run/{equipment_id}`.
- **Failure prediction:** estimates the probability of failure within `FAILURE_HORIZON_HOURS`.
- **RUL prediction:** estimates remaining useful life in operating hours.
- **Alerting:** alerts are created when the failure probability crosses the configured risk/alert thresholds.
- **SSE:** sensor, prediction and alert events are sent to connected browsers without requiring a full page refresh.

## Roles and permissions

| Capability | Admin | Engineer | Viewer |
|---|:---:|:---:|:---:|
| View dashboard and equipment | Yes | Yes | Yes |
| Create/update equipment | Yes | Yes | No |
| Delete equipment | Yes | No | No |
| Submit telemetry | Yes | Yes | No |
| Run manual predictions | Yes | Yes | No |
| View predictions and alerts | Yes | Yes | Yes |
| Acknowledge alerts | Yes | Yes | No |
| Create maintenance records | Yes | Yes | No |
| Manage users | Yes | No | No |
| View model monitoring | Yes | Yes | No |

Public signup creates Viewer accounts only. Admin accounts are created using the initialization command; do not make the public registration endpoint create privileged roles.

## API overview

All API routes are under `/api/v1`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Register a Viewer account |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/logout` | Sign out |
| `GET` | `/auth/me` | Get the current user |
| `GET`, `POST` | `/users` | List/create users (Admin) |
| `PATCH` | `/users/{user_id}` | Update a user's role/profile/status (Admin) |
| `GET`, `POST` | `/equipment` | List/create equipment |
| `GET`, `PATCH`, `DELETE` | `/equipment/{equipment_id}` | Get/update/delete equipment |
| `POST` | `/telemetry/{equipment_id}` | Submit a sensor reading |
| `GET` | `/telemetry/{equipment_id}/latest` | Get latest sensor reading |
| `GET` | `/telemetry/{equipment_id}/history` | Get historical sensor readings |
| `GET` | `/predictions` | Get prediction history |
| `POST` | `/predictions/run/{equipment_id}` | Run a manual prediction |
| `GET` | `/alerts` | Get alert history |
| `PATCH` | `/alerts/{alert_id}/acknowledge` | Acknowledge an alert |
| `GET`, `POST` | `/maintenance` | List/create maintenance records |
| `GET` | `/dashboard/summary` | Get dashboard summary metrics |
| `GET` | `/events/stream` | Open the authenticated SSE stream |
| `GET` | `/model-monitoring/summary` | Get model metrics and runtime summary (Step 17 addition) |

Use Swagger at `/docs` for the complete request and response schemas.

## Model monitoring and reports

The complete frontend includes a Model Monitoring page and a Reports & Exports page.

- The Model Monitoring page calls `GET /api/v1/model-monitoring/summary`. This endpoint was added in Step 17 in `backend/app/api/v1/endpoints/model_monitoring.py` and must be imported and registered in `backend/app/api/v1/router.py`. If this endpoint is absent, the rest of the application can run, but the model monitoring page will not load its summary.
- Training metrics displayed by the monitoring page come from the saved model artifacts. Runtime prediction counts and averages are operational statistics, not live accuracy measurements.
- CSV reports are generated in the browser.
- Excel workbook export loads SheetJS 0.18.5 from jsDelivr when the Excel export action is selected, so Excel export needs an internet connection at that moment. CSV export does not need that external library.
- Report filtering operates on records fetched from the existing API endpoints and their API limits; it is not an archival or audit-grade reporting pipeline.

## Synthetic data and model limitations

The default `generate_training_data.py` script creates 12,000 synthetic examples. Failure labels and RUL values are generated from simulated degradation relationships. The sensor simulator also generates artificial measurements.

Consequently:

- Training metrics show that the training pipeline runs; they do not establish real-world predictive accuracy.
- The model's probability is not a calibrated guarantee that a machine will fail.
- RUL is an estimate, not a guaranteed service-life figure.
- Real deployment requires representative historical sensor data, confirmed failure timestamps, maintenance records, appropriate time-based validation, monitoring for data drift and domain-expert review.
- The current training split is a random holdout split; it is not a substitute for time-based or machine-wise validation on industrial data.

## GitHub safety checklist

Before pushing the repository:

1. Keep your real `.env` file local. **Never commit database passwords, JWT secrets, admin passwords, tokens or private connection strings.**
2. Commit `.env.example` only after checking that it contains placeholders, not your real credentials.
3. Keep `.venv/`, `__pycache__/`, generated `data/*.csv` files and local `artifacts/*.joblib` files out of Git unless you have a specific, safe reason to version them.
4. Review `git status` before every push.
5. If `.env` was committed previously, removing it in a later commit does not erase the secret from Git history. Rotate the affected credentials and clean the repository history before making the repository public.

The included `.gitignore` excludes `.env`, `.venv/`, generated CSV datasets and model artifact files.

### Suggested Git commands

```bash
git init
git add .
git status
# Confirm that .env, .venv/, data/*.csv and artifacts/*.joblib are not staged.
git commit -m "Initial commit: predictive maintenance system"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

## Troubleshooting

### `ModuleNotFoundError: No module named 'app'`

Run backend module commands from the repository root and set `PYTHONPATH` to `backend` in that terminal:

```powershell
$env:PYTHONPATH = "backend"
```

### MySQL `Access denied` or connection refused

- Confirm the MySQL service is running.
- Check that the database and application users were created.
- Confirm `DATABASE_URL` uses the same username, password and host as the MySQL account.
- If the password contains URL-reserved characters, URL-encode them in the connection URL.

### `No sensor readings available or equipment is inactive`

- Confirm the equipment status is `active`.
- Confirm that the simulator is running.
- Check the `sensor_readings` table for rows associated with the equipment ID.
- Confirm that the simulator can authenticate using the current Admin credentials in `.env`.

### Predictions use a fallback instead of trained artifacts

Run the data-generation and training commands again and confirm these files exist:

```text
artifacts/failure_model.joblib
artifacts/rul_model.joblib
```

Restart the backend after training so the inference service can load the new artifacts.

### SSE request fails or the browser shows a CORS error

- Confirm that the backend is running at the address in `frontend/assets/js/config.js`.
- Confirm the frontend origin is listed in `CORS_ORIGINS`.
- Use `127.0.0.1` consistently for the configured local frontend/backend URLs.
- For local HTTP, keep `COOKIE_SECURE=false` and `COOKIE_SAMESITE=lax`.
- Sign in again and check that the browser accepts the backend's HttpOnly cookie.

### Model Monitoring page returns 404

Confirm that the Step 17 `model_monitoring.py` endpoint exists and that `model_monitoring.router` is included in `backend/app/api/v1/router.py` with the `/model-monitoring` prefix.

### Excel export does not download

The Excel action loads SheetJS from jsDelivr at export time. Check internet connectivity or use CSV export, which is generated locally in the browser.

## Stopping the application

Press `Ctrl+C` in each terminal running the backend, frontend static server and sensor simulator. The MySQL service can remain running. Database records persist after the application processes stop.

