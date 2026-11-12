/*
 * Frontend configuration.
 * Keep the API host aligned with the FastAPI host and port in your backend terminal.
 */
window.PM_CONFIG = Object.freeze({
  API_BASE_URL: "http://127.0.0.1:8000/api/v1",
  SSE_URL: "http://127.0.0.1:8000/api/v1/events/stream",
  REQUEST_TIMEOUT_MS: 20000,
  REFRESH_INTERVAL_MS: 60000,
});
