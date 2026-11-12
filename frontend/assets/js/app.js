(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    user: null,
    equipment: [],
    predictions: [],
    alerts: [],
    maintenance: [],
    users: [],
    modelMonitoring: null,
    eventSource: null,
    trendRequest: 0,
    trendTimer: null,
    refreshTimer: null,
    activeView: "overview",
  };

  const VIEW_META = {
    overview: ["Equipment health overview", "Monitor asset status, live telemetry and predictive risk."],
    equipment: ["Equipment management", "Manage machine records and submit sensor measurements."],
    trends: ["Historical sensor trends", "Explore stored telemetry and equipment behaviour over time."],
    predictions: ["Failure and RUL predictions", "Review model output and run on-demand inference."],
    alerts: ["Alert center", "Review predicted failure risks and acknowledge alerts."],
    maintenance: ["Maintenance management", "Record service activity and review equipment maintenance history."],
    reports: ["Reports and data export", "Generate date-filtered operational reports and download CSV or Excel files."],
    "model-monitoring": ["ML model monitoring", "Review training metrics, model versions and recent inference activity."],
    users: ["User management", "Manage application accounts and role-based permissions."],
  };

  const METRICS = {
    temperature: { label: "Temperature", unit: "°C", decimals: 1 },
    vibration: { label: "Vibration", unit: "mm/s", decimals: 2 },
    pressure: { label: "Pressure", unit: "bar", decimals: 2 },
    rpm: { label: "RPM", unit: "rpm", decimals: 0 },
    current: { label: "Current", unit: "A", decimals: 2 },
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function number(value, decimals = 1) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(decimals) : "—";
  }

  function dateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function localDateTimeValue(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function showToast(message, type = "info") {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast visible ${type}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3600);
  }

  function setMessage(id, message, isError = false) {
    const element = $(id);
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
  }

  function setButtonBusy(button, busy, busyText = "Saving…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function canWrite() {
    return Boolean(state.user && ["admin", "engineer"].includes(state.user.role));
  }

  function isAdmin() {
    return Boolean(state.user && state.user.role === "admin");
  }

  function equipmentName(id) {
    const found = state.equipment.find((item) => Number(item.id) === Number(id));
    return found ? found.name : `Equipment #${id}`;
  }

  function statusPill(value) {
    const safe = escapeHtml(String(value || "unknown").toLowerCase());
    return `<span class="status-pill ${safe}">${escapeHtml(value || "Unknown")}</span>`;
  }

  function riskPill(value) {
    const safe = escapeHtml(String(value || "low").toLowerCase());
    return `<span class="risk-pill ${safe}">${escapeHtml(value || "low")}</span>`;
  }

  function switchView(view, updateHash = true) {
    if (!VIEW_META[view]) view = "overview";
    if (view === "users" && !isAdmin()) view = "overview";
    if (view === "model-monitoring" && !canWrite()) view = "overview";
    state.activeView = view;
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.panel !== view);
    });
    document.querySelectorAll("[data-view]").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === view);
      if (link.dataset.view === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    $("view-title").textContent = VIEW_META[view][0];
    $("view-subtitle").textContent = VIEW_META[view][1];
    if (updateHash) history.replaceState(null, "", `#${view}`);
    if (view === "trends") loadTrendData();
    if (view === "alerts") loadAlerts();
    if (view === "maintenance") loadMaintenance();
    if (view === "model-monitoring" && canWrite()) loadModelMonitoring();
    if (view === "reports") {
      window.PM_REPORTS?.prepareEquipment(state.equipment);
      window.PM_REPORTS?.generate().catch((error) => showToast(error.message, "error"));
    }
    if (view === "users" && isAdmin()) loadUsers();
  }

  async function loadCurrentUser() {
    state.user = await PM_API.get("/auth/me");
    $("user-name").textContent = state.user.full_name;
    $("user-role").textContent = state.user.role.toUpperCase();
    $("user-avatar").textContent = (state.user.full_name || "U").trim().charAt(0).toUpperCase();
    document.querySelectorAll(".write-control").forEach((element) => {
      element.classList.toggle("hidden", !canWrite());
    });
    document.querySelectorAll(".admin-only").forEach((element) => {
      element.classList.toggle("hidden", !isAdmin());
    });
    document.querySelectorAll(".privileged-only").forEach((element) => {
      element.classList.toggle("hidden", !canWrite());
    });
  }

  async function loadSummary() {
    const summary = await PM_API.get("/dashboard/summary");
    $("equipment-count").textContent = summary.equipment_count ?? 0;
    $("active-equipment").textContent = summary.active_equipment ?? 0;
    $("open-alerts").textContent = summary.unacknowledged_alerts ?? 0;
    $("critical-alerts").textContent = summary.critical_alerts ?? 0;
    $("nav-alert-count").textContent = summary.unacknowledged_alerts ?? 0;
  }

  function updateEquipmentSelects() {
    const config = [
      ["telemetry-equipment", "Select equipment"],
      ["maintenance-equipment", "Select equipment"],
      ["trend-equipment", "Select equipment"],
      ["prediction-equipment", "Select active equipment"],
      ["report-equipment-filter", "All equipment"],
    ];
    config.forEach(([id, placeholder]) => {
      const select = $(id);
      if (!select) return;
      const previous = select.value;
      let available = state.equipment;
      if (id === "prediction-equipment") available = state.equipment.filter((item) => item.status === "active");
      select.innerHTML = `<option value="">${available.length ? placeholder : "No equipment available"}</option>` +
        available.map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.asset_tag)})</option>`).join("");
      if (available.some((item) => String(item.id) === previous)) select.value = previous;
    });
  }

  async function loadEquipment() {
    state.equipment = await PM_API.get("/equipment");
    updateEquipmentSelects();

    const latestByEquipment = await Promise.all(state.equipment.map(async (item) => {
      try { return [item.id, await PM_API.get(`/telemetry/${item.id}/latest`)]; }
      catch (error) { if (/404/.test(error.message)) return [item.id, null]; throw error; }
    }));
    const latestMap = new Map(latestByEquipment);
    const rows = state.equipment.map((item) => {
      const latest = latestMap.get(item.id);
      const latestText = latest
        ? `${number(latest.temperature, 1)} °C · ${number(latest.vibration, 2)} mm/s`
        : "No readings";
      const latestSub = latest ? dateTime(latest.recorded_at) : "Waiting for telemetry";
      const actions = `${canWrite() ? `<button class="button button-mini button-soft" data-action="edit-equipment" data-id="${item.id}">Edit</button><button class="button button-mini button-soft" data-action="run-prediction" data-id="${item.id}">Predict</button>` : "<span class='muted'>Read only</span>"}`;
      return `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.asset_tag)}</small></td>
        <td>${escapeHtml(item.equipment_type || "Industrial machine")}</td>
        <td>${escapeHtml(item.location || "—")}</td>
        <td>${riskPill(item.criticality)}</td>
        <td>${statusPill(item.status)}</td>
        <td><strong>${latestText}</strong><small>${latestSub}</small></td>
        <td><div class="table-actions">${actions}</div></td>
      </tr>`;
    });
    const table = $("equipment-table");
    table.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="7" class="empty-cell">No equipment registered. Add your first asset to begin monitoring.</td></tr>';
    $("equipment-table-count").textContent = `${state.equipment.length} asset${state.equipment.length === 1 ? "" : "s"}`;

    const overviewRows = state.equipment.slice(0, 6).map((item) => {
      const latest = latestMap.get(item.id);
      return `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.asset_tag)}</small></td><td>${escapeHtml(item.location || "—")}</td><td>${riskPill(item.criticality)}</td><td>${statusPill(item.status)}</td><td>${latest ? `${number(latest.temperature, 1)} °C` : "—"}</td></tr>`;
    });
    $("overview-equipment-table").innerHTML = overviewRows.length ? overviewRows.join("") : '<tr><td colspan="5" class="empty-cell">No equipment registered yet.</td></tr>';
  }

  async function loadPredictions() {
    state.predictions = await PM_API.get("/predictions?limit=100");
    renderPredictions();
  }

  function renderPredictions() {
    const records = state.predictions || [];
    const table = $("predictions-table");
    const rows = records.map((item) => `
      <tr>
        <td><strong>${escapeHtml(equipmentName(item.equipment_id))}</strong><small>Equipment ID ${item.equipment_id}</small></td>
        <td>${dateTime(item.created_at)}</td>
        <td><span class="tag tag-neutral">${escapeHtml(item.trigger_type)}</span></td>
        <td><strong>${number(Number(item.failure_probability) * 100, 1)}%</strong><small>Within ${Number(item.horizon_hours || 24)} hours</small></td>
        <td>${riskPill(item.risk_level)}</td>
        <td><strong>${number(item.rul_hours, 1)} h</strong></td>
        <td><small>Failure: ${escapeHtml(item.failure_model_version || "—")}</small><small>RUL: ${escapeHtml(item.rul_model_version || "—")}</small></td>
      </tr>`);
    table.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="7" class="empty-cell">No predictions have been recorded.</td></tr>';

    const recent = records.slice(0, 5).map((item) => `
      <article class="compact-item">
        <div><strong>${escapeHtml(equipmentName(item.equipment_id))}</strong><small>${escapeHtml(item.trigger_type)} · ${dateTime(item.created_at)}</small></div>
        <div class="compact-metric">${number(Number(item.failure_probability) * 100, 1)}%<small>${escapeHtml(item.risk_level)}</small></div>
      </article>`);
    $("overview-predictions").innerHTML = recent.length ? recent.join("") : '<p class="muted">No predictions yet. Run a manual prediction or wait for the scheduler.</p>';
  }

  async function loadAlerts() {
    const filter = $("alert-filter")?.value || "all";
    let path = "/alerts?limit=200";
    if (filter === "open") path += "&unacknowledged_only=true";
    state.alerts = await PM_API.get(path);
    if (filter === "acknowledged") state.alerts = state.alerts.filter((item) => item.is_acknowledged);
    renderAlerts();
  }

  function renderAlerts() {
    const writable = canWrite();
    const records = state.alerts || [];
    const table = $("alerts-table");
    const rows = records.map((item) => `
      <tr>
        <td>${riskPill(item.severity)}</td>
        <td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></td>
        <td>${escapeHtml(equipmentName(item.equipment_id))}</td>
        <td>${dateTime(item.created_at)}</td>
        <td>${item.is_acknowledged ? '<span class="status-pill acknowledged">Acknowledged</span>' : '<span class="status-pill open">Open</span>'}</td>
        <td>${!item.is_acknowledged && writable ? `<button class="button button-mini button-soft" data-action="ack-alert" data-id="${item.id}">Acknowledge</button>` : "—"}</td>
      </tr>`);
    table.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="6" class="empty-cell">No alerts match this filter.</td></tr>';

    const recent = records.slice(0, 5).map((item) => `
      <article class="compact-item alert-compact">
        <div><strong>${escapeHtml(item.title)}</strong><small>${dateTime(item.created_at)} · ${item.is_acknowledged ? "Acknowledged" : "Open"}</small></div>
        ${riskPill(item.severity)}
      </article>`);
    $("overview-alerts").innerHTML = recent.length ? recent.join("") : '<p class="muted">No alerts have been generated.</p>';
  }

  async function loadMaintenance() {
    const records = await PM_API.get("/maintenance?limit=200");
    state.maintenance = records;
    const table = $("maintenance-table");
    const rows = records.map((item) => `
      <tr>
        <td><strong>${escapeHtml(equipmentName(item.equipment_id))}</strong><small>Equipment ID ${item.equipment_id}</small></td>
        <td>${dateTime(item.performed_at)}</td>
        <td><span class="tag tag-neutral">${escapeHtml(item.maintenance_type)}</span></td>
        <td>${number(item.downtime_hours, 1)} h</td>
        <td class="description-cell">${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.performed_by || "—")}</td>
      </tr>`);
    table.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="6" class="empty-cell">No maintenance records have been recorded.</td></tr>';
    $("maintenance-count").textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
  }

  async function loadUsers() {
    if (!isAdmin()) return;
    state.users = await PM_API.get("/users");
    const rows = state.users.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.full_name)}</strong><small>User ID ${item.id}</small></td>
        <td>${escapeHtml(item.email)}</td>
        <td><select class="user-role-select" data-user-id="${item.id}" aria-label="Role for ${escapeHtml(item.full_name)}">
          <option value="viewer" ${item.role === "viewer" ? "selected" : ""}>Viewer</option>
          <option value="engineer" ${item.role === "engineer" ? "selected" : ""}>Engineer</option>
          <option value="admin" ${item.role === "admin" ? "selected" : ""}>Admin</option>
        </select></td>
        <td>${item.is_active ? '<span class="status-pill active">Active</span>' : '<span class="status-pill inactive">Inactive</span>'}</td>
        <td><button class="button button-mini button-soft" data-action="toggle-user" data-id="${item.id}" data-active="${item.is_active}" ${Number(item.id) === Number(state.user.id) ? "disabled title='You cannot deactivate your own account here'" : ""}>${item.is_active ? "Deactivate" : "Activate"}</button></td>
      </tr>`);
    $("users-table").innerHTML = rows.length ? rows.join("") : '<tr><td colspan="5" class="empty-cell">No users found.</td></tr>';
  }

  async function loadAll() {
    const firstPass = await Promise.allSettled([loadSummary(), loadEquipment()]);
    const secondPass = await Promise.allSettled([loadPredictions(), loadAlerts(), loadMaintenance()]);
    const failed = [...firstPass, ...secondPass].filter((item) => item.status === "rejected");
    if (failed.length) showToast(failed[0].reason.message, "error");
    if (isAdmin()) await loadUsers().catch((error) => showToast(error.message, "error"));
  }

  function resetEquipmentForm() {
    $("equipment-form").reset();
    $("equipment-id").value = "";
    $("equipment-type").value = "Industrial machine";
    $("equipment-status").value = "active";
    $("threshold-temperature").value = "85";
    $("threshold-vibration").value = "7";
    $("threshold-pressure-min").value = "1";
    $("threshold-pressure-max").value = "12";
    $("threshold-current").value = "30";
    $("equipment-form-title").textContent = "Register equipment";
    setMessage("equipment-form-message", "");
  }

  function openEquipmentForm(item = null) {
    resetEquipmentForm();
    if (item) {
      $("equipment-id").value = item.id;
      $("equipment-name").value = item.name || "";
      $("equipment-asset-tag").value = item.asset_tag || "";
      $("equipment-type").value = item.equipment_type || "Industrial machine";
      $("equipment-location").value = item.location || "";
      $("equipment-criticality").value = item.criticality || "medium";
      $("equipment-status").value = item.status || "active";
      $("equipment-description").value = item.description || "";
      const thresholds = item.thresholds || {};
      $("threshold-temperature").value = thresholds.temperature_max ?? 85;
      $("threshold-vibration").value = thresholds.vibration_max ?? 7;
      $("threshold-pressure-min").value = thresholds.pressure_min ?? 1;
      $("threshold-pressure-max").value = thresholds.pressure_max ?? 12;
      $("threshold-current").value = thresholds.current_max ?? 30;
      $("equipment-form-title").textContent = `Edit ${item.name}`;
    }
    $("equipment-form-panel").classList.remove("hidden");
    $("equipment-form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveEquipment(event) {
    event.preventDefault();
    const id = $("equipment-id").value;
    const payload = {
      name: $("equipment-name").value.trim(),
      equipment_type: $("equipment-type").value.trim() || "Industrial machine",
      location: $("equipment-location").value.trim() || null,
      criticality: $("equipment-criticality").value,
      status: $("equipment-status").value,
      description: $("equipment-description").value.trim() || null,
      thresholds: {
        temperature_max: Number($("threshold-temperature").value),
        vibration_max: Number($("threshold-vibration").value),
        pressure_min: Number($("threshold-pressure-min").value),
        pressure_max: Number($("threshold-pressure-max").value),
        current_max: Number($("threshold-current").value),
      },
    };
    if (!id) payload.asset_tag = $("equipment-asset-tag").value.trim();
    const button = event.submitter;
    setButtonBusy(button, true);
    try {
      if (id) await PM_API.patch(`/equipment/${id}`, payload);
      else await PM_API.post("/equipment", payload);
      $("equipment-form-panel").classList.add("hidden");
      resetEquipmentForm();
      await loadEquipment();
      await loadSummary();
      showToast(id ? "Equipment updated" : "Equipment created", "success");
    } catch (error) {
      setMessage("equipment-form-message", error.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function runManualPrediction(equipmentId) {
    if (!canWrite()) return showToast("Your role cannot run predictions.", "error");
    try {
      await PM_API.post(`/predictions/run/${Number(equipmentId)}`);
      await Promise.all([loadPredictions(), loadAlerts(), loadSummary()]);
      showToast("Prediction generated successfully", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function submitTelemetry(event) {
    event.preventDefault();
    if (!canWrite()) return;
    const equipmentId = Number($("telemetry-equipment").value);
    if (!equipmentId) return setMessage("telemetry-form-message", "Select equipment first.", true);
    const payload = {
      temperature: Number($("reading-temperature").value),
      vibration: Number($("reading-vibration").value),
      pressure: Number($("reading-pressure").value),
      rpm: Number($("reading-rpm").value),
      current: Number($("reading-current").value),
      operating_hours: Number($("reading-operating-hours").value),
      source: "dashboard_manual",
    };
    const button = event.submitter;
    setButtonBusy(button, true, "Submitting…");
    try {
      await PM_API.post(`/telemetry/${equipmentId}`, payload);
      setMessage("telemetry-form-message", "Sensor reading stored successfully.");
      await Promise.all([loadEquipment(), loadSummary()]);
      showToast("Sensor reading submitted", "success");
      if (state.activeView === "trends" && Number($("trend-equipment").value) === equipmentId) loadTrendData();
    } catch (error) {
      setMessage("telemetry-form-message", error.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function acknowledgeAlert(id) {
    try {
      await PM_API.patch(`/alerts/${Number(id)}/acknowledge`, {});
      await Promise.all([loadAlerts(), loadSummary()]);
      showToast("Alert acknowledged", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function resetMaintenanceForm() {
    $("maintenance-form").reset();
    $("maintenance-performed-at").value = localDateTimeValue();
    $("maintenance-downtime").value = "0";
    setMessage("maintenance-form-message", "");
  }

  async function submitMaintenance(event) {
    event.preventDefault();
    if (!canWrite()) return;
    const payload = {
      equipment_id: Number($("maintenance-equipment").value),
      performed_at: $("maintenance-performed-at").value,
      maintenance_type: $("maintenance-type").value,
      description: $("maintenance-description").value.trim(),
      downtime_hours: Number($("maintenance-downtime").value),
    };
    const button = event.submitter;
    setButtonBusy(button, true, "Saving…");
    try {
      await PM_API.post("/maintenance", payload);
      resetMaintenanceForm();
      $("maintenance-form-panel").classList.add("hidden");
      await loadMaintenance();
      showToast("Maintenance record saved", "success");
    } catch (error) {
      setMessage("maintenance-form-message", error.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function submitUser(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const payload = {
      full_name: $("new-user-name").value.trim(),
      email: $("new-user-email").value.trim(),
      password: $("new-user-password").value,
      role: $("new-user-role").value,
    };
    const button = event.submitter;
    setButtonBusy(button, true, "Creating…");
    try {
      await PM_API.post("/users", payload);
      $("user-form").reset();
      setMessage("user-form-message", "User created successfully.");
      await loadUsers();
      showToast("User created", "success");
    } catch (error) {
      setMessage("user-form-message", error.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function updateUserRole(id, role) {
    try {
      await PM_API.patch(`/users/${Number(id)}`, { role });
      await loadUsers();
      showToast("User role updated", "success");
    } catch (error) {
      showToast(error.message, "error");
      await loadUsers();
    }
  }

  async function toggleUserActive(id, currentActive) {
    try {
      await PM_API.patch(`/users/${Number(id)}`, { is_active: !currentActive });
      await loadUsers();
      showToast(currentActive ? "User deactivated" : "User activated", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function formatMetric(value, metric) {
    const config = METRICS[metric];
    return `${number(value, config.decimals)} ${config.unit}`;
  }

  function updateTrendStats(values, metric) {
    if (!values.length) {
      ["trend-latest", "trend-average", "trend-minimum", "trend-maximum"].forEach((id) => $(id).textContent = "—");
      return;
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    $("trend-latest").textContent = formatMetric(values[values.length - 1], metric);
    $("trend-average").textContent = formatMetric(total / values.length, metric);
    $("trend-minimum").textContent = formatMetric(Math.min(...values), metric);
    $("trend-maximum").textContent = formatMetric(Math.max(...values), metric);
  }

  function renderTrendChart(readings, metric) {
    const svg = $("trend-chart");
    const config = METRICS[metric];
    const width = 960;
    const height = 340;
    const margin = { top: 22, right: 28, bottom: 52, left: 76 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = readings.map((item) => Number(item[metric])).filter(Number.isFinite);

    if (!values.length) {
      svg.innerHTML = '<text x="480" y="170" text-anchor="middle" class="chart-empty">No sensor readings available for this selection</text>';
      return;
    }

    let minValue = Math.min(...values);
    let maxValue = Math.max(...values);
    if (minValue === maxValue) {
      const padding = Math.max(Math.abs(minValue) * 0.08, 1);
      minValue -= padding;
      maxValue += padding;
    } else {
      const padding = (maxValue - minValue) * 0.12;
      minValue -= padding;
      maxValue += padding;
    }
    const x = (index) => margin.left + (values.length === 1 ? plotWidth / 2 : index * plotWidth / (values.length - 1));
    const y = (value) => margin.top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
    const points = values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = maxValue - ((maxValue - minValue) * index / 4);
      const yy = margin.top + plotHeight * index / 4;
      return `<line class="chart-grid" x1="${margin.left}" y1="${yy}" x2="${margin.left + plotWidth}" y2="${yy}"/><text class="chart-axis-label" x="${margin.left - 12}" y="${yy + 4}" text-anchor="end">${value.toFixed(config.decimals)}</text>`;
    }).join("");
    const areaPath = `M ${margin.left} ${margin.top + plotHeight} L ${points.replaceAll(" ", " L ")} L ${margin.left + plotWidth} ${margin.top + plotHeight} Z`;
    const linePath = `M ${points.replaceAll(" ", " L ")}`;
    const first = readings[0]?.recorded_at;
    const last = readings[readings.length - 1]?.recorded_at;
    const label = (value) => value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const circles = values.map((value, index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="${values.length > 150 ? 1.8 : 3.1}"><title>${escapeHtml(formatMetric(value, metric))}</title></circle>`).join("");
    svg.innerHTML = `${grid}<path class="chart-area" d="${areaPath}"/><path class="chart-line" d="${linePath}"/>${circles}
      <text class="chart-axis-label" x="${margin.left}" y="${height - 15}" text-anchor="start">${escapeHtml(label(first))}</text>
      <text class="chart-axis-label" x="${margin.left + plotWidth}" y="${height - 15}" text-anchor="end">${escapeHtml(label(last))}</text>`;
  }

  async function loadTrendData() {
    if (state.activeView !== "trends") return;
    const equipmentId = Number($("trend-equipment").value);
    const metric = $("trend-metric").value;
    const limit = Number($("trend-limit").value);
    const requestId = ++state.trendRequest;
    if (!equipmentId) {
      updateTrendStats([], metric);
      renderTrendChart([], metric);
      $("trend-status").textContent = "Select equipment to view its sensor history.";
      return;
    }
    $("trend-status").textContent = "Loading historical readings…";
    try {
      const response = await PM_API.get(`/telemetry/${equipmentId}/history?limit=${limit}`);
      if (requestId !== state.trendRequest) return;
      const readings = (Array.isArray(response) ? response.slice() : []).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      const valid = readings.filter((item) => Number.isFinite(Number(item[metric])));
      const values = valid.map((item) => Number(item[metric]));
      updateTrendStats(values, metric);
      renderTrendChart(valid, metric);
      const config = METRICS[metric];
      $("trend-status").textContent = `${valid.length} readings · ${equipmentName(equipmentId)} · ${config.label}`;
    } catch (error) {
      if (requestId !== state.trendRequest) return;
      updateTrendStats([], metric);
      renderTrendChart([], metric);
      $("trend-status").textContent = error.message;
      $("trend-status").classList.add("error");
    }
  }

  function formatModelMetric(value, asPercent = false, suffix = "") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "—";
    if (asPercent) return `${(parsed * 100).toFixed(1)}%`;
    return `${parsed.toFixed(3)}${suffix}`;
  }

  function renderMetricRows(metrics, definitions) {
    const entries = definitions.filter(([, key]) => metrics && metrics[key] !== undefined && metrics[key] !== null);
    if (!entries.length) return '<tr><td colspan="2" class="empty-cell">No evaluation metrics found in this model artifact.</td></tr>';
    return entries.map(([label, key, type]) => {
      const value = type === "percent"
        ? formatModelMetric(metrics[key], true)
        : type === "hours"
          ? `${number(metrics[key], 2)} h`
          : formatModelMetric(metrics[key]);
      return `<tr><td>${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`;
    }).join("");
  }

  function renderVersionCounts(failureCounts, rulCounts) {
    const rows = [];
    Object.entries(failureCounts || {}).forEach(([version, count]) => {
      rows.push(`<tr><td>Failure prediction</td><td><strong>${escapeHtml(version)}</strong></td><td>${Number(count) || 0}</td></tr>`);
    });
    Object.entries(rulCounts || {}).forEach(([version, count]) => {
      rows.push(`<tr><td>RUL regression</td><td><strong>${escapeHtml(version)}</strong></td><td>${Number(count) || 0}</td></tr>`);
    });
    return rows.length ? rows.join("") : '<tr><td colspan="3" class="empty-cell">No version usage data available.</td></tr>';
  }

  function renderModelMonitoring(data) {
    state.modelMonitoring = data;
    const failure = data.failure_prediction_model || {};
    const rul = data.rul_model || {};
    const runtime = data.runtime || {};
    const configuration = data.configuration || {};
    const failureLoaded = failure.status === "loaded";
    const rulLoaded = rul.status === "loaded";
    const failureFallback = Number(runtime.failure_fallback_predictions || 0);
    const rulFallback = Number(runtime.rul_fallback_predictions || 0);

    $("failure-model-status").textContent = failureLoaded ? "Loaded" : (failure.status || "Unavailable");
    $("rul-model-status").textContent = rulLoaded ? "Loaded" : (rul.status || "Unavailable");
    $("failure-model-version").textContent = failure.version || "Version unavailable";
    $("rul-model-version").textContent = rul.version || "Version unavailable";
    $("failure-model-version-detail").textContent = failure.version || "—";
    $("rul-model-version-detail").textContent = rul.version || "—";
    $("failure-model-features").textContent = Number.isFinite(Number(failure.feature_count)) ? String(failure.feature_count) : "—";
    $("rul-model-features").textContent = Number.isFinite(Number(rul.feature_count)) ? String(rul.feature_count) : "—";
    $("failure-model-badge").textContent = failure.status || "unknown";
    $("rul-model-badge").textContent = rul.status || "unknown";
    $("failure-model-badge").className = `status-pill ${failureLoaded ? "active" : "inactive"}`;
    $("rul-model-badge").className = `status-pill ${rulLoaded ? "active" : "inactive"}`;

    const failureMetrics = failure.metrics || {};
    const rulMetrics = rul.metrics || {};
    $("failure-model-metrics").innerHTML = renderMetricRows(failureMetrics, [
      ["Accuracy", "accuracy", "percent"],
      ["Precision", "precision", "percent"],
      ["Recall", "recall", "percent"],
      ["F1 score", "f1", "percent"],
      ["PR-AUC", "pr_auc", "percent"],
      ["ROC-AUC", "roc_auc", "percent"],
    ]);
    $("rul-model-metrics").innerHTML = renderMetricRows(rulMetrics, [
      ["Mean absolute error (MAE)", "mae_hours", "hours"],
      ["Root mean squared error (RMSE)", "rmse_hours", "hours"],
    ]);

    $("model-total-predictions").textContent = Number(runtime.total_predictions || 0).toLocaleString();
    $("model-fallback-predictions").textContent = (failureFallback + rulFallback).toLocaleString();
    $("model-average-failure").textContent = runtime.average_failure_probability == null
      ? "—" : `${(Number(runtime.average_failure_probability) * 100).toFixed(1)}%`;
    $("model-average-rul").textContent = runtime.average_rul_hours == null
      ? "—" : `${number(runtime.average_rul_hours, 1)} h`;
    $("model-failure-fallback-count").textContent = failureFallback.toLocaleString();
    $("model-rul-fallback-count").textContent = rulFallback.toLocaleString();
    $("model-version-counts").innerHTML = renderVersionCounts(
      runtime.failure_model_version_counts,
      runtime.rul_model_version_counts
    );

    $("model-config-horizon").textContent = configuration.failure_horizon_hours == null
      ? "—" : `${configuration.failure_horizon_hours} hours`;
    $("model-config-interval").textContent = configuration.prediction_interval_minutes == null
      ? "—" : `${configuration.prediction_interval_minutes} minutes`;
    $("model-config-alert-threshold").textContent = configuration.alert_failure_probability == null
      ? "—" : `${(Number(configuration.alert_failure_probability) * 100).toFixed(0)}%`;
    $("model-config-period").textContent = `${Number(data.period_days || 30)} days`;

    const stamp = data.generated_at ? dateTime(data.generated_at) : new Date().toLocaleString();
    $("model-monitoring-updated").textContent = `Updated ${stamp}`;
    $("model-monitoring-status").textContent = "Model metrics and runtime prediction statistics loaded.";
    $("model-monitoring-status").classList.remove("error");
  }

  async function loadModelMonitoring() {
    if (!canWrite()) return;
    const status = $("model-monitoring-status");
    if (status) {
      status.textContent = "Loading model monitoring data…";
      status.classList.remove("error");
    }
    try {
      const data = await PM_API.get("/model-monitoring/summary");
      renderModelMonitoring(data || {});
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      }
      showToast(`Model monitoring could not be loaded: ${error.message}`, "error");
    }
  }

  function connectEvents() {
    if (state.eventSource) state.eventSource.close();
    const source = new EventSource(window.PM_CONFIG.SSE_URL, { withCredentials: true });
    state.eventSource = source;
    source.addEventListener("open", () => {
      $("connection-indicator").classList.add("connected");
      $("connection-label").textContent = "Live stream connected";
    });
    source.addEventListener("error", () => {
      $("connection-indicator").classList.remove("connected");
      $("connection-label").textContent = "Reconnecting…";
    });
    source.addEventListener("connected", () => {
      $("connection-indicator").classList.add("connected");
      $("connection-label").textContent = "Live stream connected";
    });

    ["sensor.reading", "prediction.created", "alert.created", "alert.acknowledged"].forEach((eventName) => {
      source.addEventListener(eventName, (event) => {
        let payload = {};
        try { payload = JSON.parse(event.data || "{}"); } catch (_) { payload = {}; }
        const readable = eventName.replaceAll(".", " ");
        const label = payload.equipment_name || equipmentName(payload.equipment_id);
        showToast(`${readable} received${label ? ` · ${label}` : ""}`, "info");
        window.clearTimeout(state.trendTimer);
        state.trendTimer = window.setTimeout(() => {
          Promise.allSettled([loadSummary(), loadEquipment(), loadPredictions(), loadAlerts()]);
          if (state.activeView === "trends" && (eventName === "sensor.reading" || !payload.equipment_id || Number($("trend-equipment").value) === Number(payload.equipment_id))) {
            loadTrendData();
          }
          if (state.activeView === "model-monitoring" && eventName === "prediction.created") {
            loadModelMonitoring();
          }
        }, 350);
      });
    });
  }

  function bindNavigation() {
    document.querySelectorAll("[data-view]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        switchView(link.dataset.view);
      });
    });
    document.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.go));
    });
    window.addEventListener("hashchange", () => {
      const view = window.location.hash.replace("#", "");
      if (view && view !== state.activeView) switchView(view, false);
    });
  }

  function bindEvents() {
    $("logout-button").addEventListener("click", async () => {
      try { await PM_API.post("/auth/logout", {}); }
      catch (error) { showToast(error.message, "error"); }
      finally { window.location.href = "/login.html"; }
    });

    $("show-equipment-form").addEventListener("click", () => openEquipmentForm());
    $("close-equipment-form").addEventListener("click", () => $("equipment-form-panel").classList.add("hidden"));
    $("cancel-equipment-form").addEventListener("click", () => { $("equipment-form-panel").classList.add("hidden"); resetEquipmentForm(); });
    $("equipment-form").addEventListener("submit", saveEquipment);

    $("equipment-table").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const item = state.equipment.find((record) => Number(record.id) === Number(button.dataset.id));
      if (button.dataset.action === "edit-equipment" && item) openEquipmentForm(item);
      if (button.dataset.action === "run-prediction") runManualPrediction(button.dataset.id);
    });

    $("telemetry-form").addEventListener("submit", submitTelemetry);
    $("refresh-predictions").addEventListener("click", () => loadPredictions().catch((error) => showToast(error.message, "error")));
    $("manual-prediction-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = Number($("prediction-equipment").value);
      if (!id) return setMessage("prediction-form-message", "Select an active equipment item.", true);
      setMessage("prediction-form-message", "Generating prediction…");
      await runManualPrediction(id);
      setMessage("prediction-form-message", "Prediction request completed.");
    });

    $("alerts-table").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='ack-alert']");
      if (button) acknowledgeAlert(button.dataset.id);
    });
    $("alert-filter").addEventListener("change", () => loadAlerts().catch((error) => showToast(error.message, "error")));
    $("refresh-alerts").addEventListener("click", () => loadAlerts().catch((error) => showToast(error.message, "error")));

    $("show-maintenance-form").addEventListener("click", () => {
      resetMaintenanceForm();
      $("maintenance-form-panel").classList.remove("hidden");
      $("maintenance-form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("close-maintenance-form").addEventListener("click", () => $("maintenance-form-panel").classList.add("hidden"));
    $("cancel-maintenance-form").addEventListener("click", () => { $("maintenance-form-panel").classList.add("hidden"); resetMaintenanceForm(); });
    $("maintenance-form").addEventListener("submit", submitMaintenance);

    $("user-form").addEventListener("submit", submitUser);
    $("users-table").addEventListener("change", (event) => {
      if (event.target.matches(".user-role-select")) updateUserRole(event.target.dataset.userId, event.target.value);
    });
    $("users-table").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='toggle-user']");
      if (button) toggleUserActive(button.dataset.id, button.dataset.active === "true");
    });

    ["trend-equipment", "trend-metric", "trend-limit"].forEach((id) => $(id).addEventListener("change", loadTrendData));
    $("refresh-trend").addEventListener("click", loadTrendData);
    $("refresh-model-monitoring").addEventListener("click", loadModelMonitoring);
    $("report-form").addEventListener("submit", (event) => {
      event.preventDefault();
      window.PM_REPORTS.generate().catch((error) => showToast(error.message, "error"));
    });
    $("export-report-csv").addEventListener("click", () => {
      try { window.PM_REPORTS.exportCsv(); }
      catch (error) { showToast(error.message, "error"); }
    });
    $("export-report-xlsx").addEventListener("click", () => {
      window.PM_REPORTS.exportExcel().catch((error) => showToast(error.message, "error"));
    });
  }

  async function initialize() {
    try {
      await loadCurrentUser();
      bindNavigation();
      bindEvents();
      $("maintenance-performed-at").value = localDateTimeValue();
      $("footer-current-time").textContent = new Date().toLocaleString();
      await loadAll();
      switchView(window.location.hash.replace("#", "") || "overview", false);
      connectEvents();
      state.refreshTimer = window.setInterval(() => {
        Promise.allSettled([loadSummary(), loadEquipment(), loadPredictions(), loadAlerts()]);
        if (state.activeView === "model-monitoring" && canWrite()) loadModelMonitoring();
      }, window.PM_CONFIG.REFRESH_INTERVAL_MS || 60000);
      window.addEventListener("beforeunload", () => {
        if (state.eventSource) state.eventSource.close();
        if (state.refreshTimer) window.clearInterval(state.refreshTimer);
      });
    } catch (error) {
      showToast(error.message, "error");
      if (/401|unauthorized/i.test(error.message)) window.location.href = "/login.html";
    }
  }

  initialize();
})();
