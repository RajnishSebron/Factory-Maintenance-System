# Predictive Maintenance System — Complete Frontend

This is the complete replacement for the project's `frontend/` directory. It is built with HTML, CSS and vanilla JavaScript and connects to the existing FastAPI backend.

## Frontend files

```text
frontend/
├── login.html
├── index.html
├── pages/
│   └── register.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── config.js
│       ├── api.js
│       ├── login.js
│       ├── register.js
│       ├── reports.js
│       └── app.js
└── README.md
```

## Backend compatibility

The frontend uses the existing API routes under `/api/v1`:

- `POST /auth/login`, `POST /auth/logout`, `POST /auth/register`, `GET /auth/me`
- `GET /dashboard/summary`
- `GET`, `POST`, `PATCH` `/equipment`
- `GET /telemetry/{equipment_id}/latest`, `GET /telemetry/{equipment_id}/history`, `POST /telemetry/{equipment_id}`
- `GET /predictions`, `POST /predictions/run/{equipment_id}`
- `GET /alerts`, `PATCH /alerts/{alert_id}/acknowledge`
- `GET /maintenance`, `POST /maintenance`
- `GET /users`, `POST /users`, `PATCH /users/{user_id}`
- `GET /events/stream` (Server-Sent Events)
- `GET /model-monitoring/summary` (Admin/Engineer model monitoring; requires the Step 17 backend endpoint)

Authentication uses the backend's HTTP-only `access_token` cookie. All API requests use `credentials: "include"`; the SSE connection uses `withCredentials: true`.

## Configure API address

Open `assets/js/config.js`. The default configuration matches the local project setup:

```js
API_BASE_URL: "http://127.0.0.1:8000/api/v1",
SSE_URL: "http://127.0.0.1:8000/api/v1/events/stream",
```

Change the host or port only when your FastAPI backend runs at a different address.

## Run the frontend locally

From the main project directory, start the static frontend server:

```powershell
python -m http.server 5500 --directory frontend
```

Open `http://127.0.0.1:5500/login.html` in your browser. The FastAPI backend must be running separately at the address configured in `assets/js/config.js`.

## Included screens and capabilities

- Login and public Viewer registration.
- Role-aware overview dashboard.
- Equipment creation and editing, including sensor thresholds.
- Manual sensor-reading submission.
- Historical sensor charts for temperature, vibration, pressure, RPM and current.
- Prediction history and manual prediction trigger.
- Alert history and acknowledgement.
- Maintenance record creation and history.
- Admin/Engineer ML model monitoring page with saved classification/regression metrics, model versions, runtime prediction counts, fallback counts and active prediction configuration.
- Date-filtered reports and CSV/Excel export for equipment, sensor readings, predictions, alerts and maintenance history.
- Admin user creation, role changes and account activation/deactivation.
- SSE updates for sensor readings, predictions and alerts.

No frontend framework or additional Python/Node dependency is required. The frontend does not change the database schema, ML training artifacts, backend code or `.env` file.

## ML model monitoring page

The sidebar contains an **ML model monitoring** page for Admin and Engineer accounts. It reads `GET /api/v1/model-monitoring/summary`, displays the saved metrics stored inside `failure_model.joblib` and `rul_model.joblib`, and summarizes runtime prediction activity from the last 30 days. It refreshes when opened, when the user selects Refresh, after a prediction SSE event while the page is active, and on the normal 60-second page refresh cycle.

The backend endpoint must be implemented and registered as described in Step 17. The dashboard does not calculate model accuracy from live predictions; the displayed training metrics are holdout metrics from the synthetic training dataset.


## Reports and data export (Step 19)

The Reports & exports page reads records from the existing backend endpoints and applies client-side filters for equipment and date range:

- `GET /equipment`
- `GET /telemetry/{equipment_id}/history?limit=1000`
- `GET /predictions?limit=500`
- `GET /alerts?limit=500`
- `GET /maintenance?limit=500`

CSV export is generated locally in the browser. For the All datasets selection, one combined CSV is created with a `record_type` field and a JSON details column. For an individual dataset, the CSV contains its dataset-specific fields.

Excel export creates a genuine `.xlsx` workbook with a `Report_Info` worksheet and one worksheet per selected dataset. The frontend loads SheetJS 0.18.5 from jsDelivr only when the user clicks Export Excel; therefore Excel export requires internet access at export time. CSV export does not require that external library.

The report filters are applied to the records returned by the current API limits: up to 500 predictions, alerts and maintenance records; and up to 1,000 sensor readings per equipment. This is a frontend export tool, not a long-term archival or audit-grade reporting pipeline.
