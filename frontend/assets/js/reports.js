(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const DATASETS = [
    { key: "equipment", label: "Equipment", path: null, time: "created_at" },
    { key: "telemetry", label: "Sensor readings", path: "telemetry", time: "recorded_at" },
    { key: "predictions", label: "Predictions", path: "/predictions?limit=500", time: "created_at" },
    { key: "alerts", label: "Alerts", path: "/alerts?limit=500", time: "created_at" },
    { key: "maintenance", label: "Maintenance", path: "/maintenance?limit=500", time: "performed_at" },
  ];

  const state = {
    equipment: [],
    report: null,
    generating: false,
  };

  function text(value) {
    return String(value ?? "");
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function setStatus(message, isError = false) {
    const element = $("report-status");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
  }

  function localDateString(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function prepareEquipment(equipment) {
    state.equipment = Array.isArray(equipment) ? equipment : [];
    const select = $("report-equipment-filter");
    if (!select) return;
    const previous = select.value || "all";
    select.innerHTML = '<option value="all">All equipment</option>' + state.equipment.map((item) =>
      `<option value="${Number(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.asset_tag)})</option>`
    ).join("");
    select.value = state.equipment.some((item) => String(item.id) === previous) ? previous : "all";

    const from = $("report-from-date");
    const to = $("report-to-date");
    if (from && !from.value) {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      from.value = localDateString(start);
    }
    if (to && !to.value) to.value = localDateString(new Date());
  }

  function parseLocalDate(value, isEnd = false) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    if (isEnd) date.setDate(date.getDate() + 1);
    return date;
  }

  function withinDateRange(record, dateField, from, to) {
    const raw = record?.[dateField];
    if (!raw) return !from && !to;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return false;
    if (from && date < from) return false;
    if (to && date >= to) return false;
    return true;
  }

  function equipmentMap() {
    return new Map(state.equipment.map((item) => [Number(item.id), item]));
  }

  function enrich(records, key) {
    const byId = equipmentMap();
    return (records || []).map((record) => {
      const equipment = byId.get(Number(record.equipment_id ?? record.id));
      if (key === "equipment") {
        return {
          ...record,
          equipment_name: record.name,
          asset_tag: record.asset_tag,
        };
      }
      return {
        ...record,
        equipment_name: equipment?.name || `Equipment #${record.equipment_id}`,
        asset_tag: equipment?.asset_tag || "",
      };
    });
  }

  async function fetchTelemetry(equipmentIds) {
    const results = await Promise.all(equipmentIds.map(async (id) => {
      try {
        const readings = await PM_API.get(`/telemetry/${id}/history?limit=1000`);
        return Array.isArray(readings) ? readings : [];
      } catch (error) {
        // Equipment without telemetry has no history yet; keep other assets in the export.
        if (/404|no readings found/i.test(error.message || "")) return [];
        throw error;
      }
    }));
    return results.flat();
  }

  function applyFilters(key, records, equipmentId, from, to) {
    const definition = DATASETS.find((item) => item.key === key);
    const enriched = enrich(records, key);
    return enriched.filter((record) => {
      const recordEquipmentId = key === "equipment" ? record.id : record.equipment_id;
      if (equipmentId !== "all" && Number(recordEquipmentId) !== Number(equipmentId)) return false;
      return withinDateRange(record, definition.time, from, to);
    });
  }

  async function fetchReportData(datasetKey, equipmentId, from, to) {
    const needed = datasetKey === "all" ? DATASETS.map((item) => item.key) : [datasetKey];
    const result = {};

    for (const key of needed) {
      let records = [];
      if (key === "equipment") {
        records = state.equipment;
      } else if (key === "telemetry") {
        const ids = state.equipment
          .filter((item) => equipmentId === "all" || Number(item.id) === Number(equipmentId))
          .map((item) => Number(item.id));
        records = await fetchTelemetry(ids);
      } else if (key === "predictions") {
        records = await PM_API.get("/predictions?limit=500");
      } else if (key === "alerts") {
        records = await PM_API.get("/alerts?limit=500");
      } else if (key === "maintenance") {
        records = await PM_API.get("/maintenance?limit=500");
      }
      result[key] = applyFilters(key, records, equipmentId, from, to);
    }

    return result;
  }

  function datasetLabel(key) {
    return DATASETS.find((item) => item.key === key)?.label || key;
  }

  function renderSummary(data) {
    const counts = {
      equipment: data.equipment?.length || 0,
      telemetry: data.telemetry?.length || 0,
      predictions: data.predictions?.length || 0,
      alerts: data.alerts?.length || 0,
      maintenance: data.maintenance?.length || 0,
    };
    const labels = [
      ["Equipment", counts.equipment],
      ["Sensor readings", counts.telemetry],
      ["Predictions", counts.predictions],
      ["Alerts", counts.alerts],
      ["Maintenance", counts.maintenance],
    ];
    $("report-summary").innerHTML = labels.map(([label, count]) =>
      `<article class="report-summary-card"><span>${label}</span><strong>${count.toLocaleString()}</strong></article>`
    ).join("");
  }

  function displayValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  function previewData(data, datasetKey) {
    const head = $("report-preview-head");
    const body = $("report-preview-body");
    const title = $("report-preview-title");
    const caption = $("report-preview-caption");

    if (datasetKey === "all") {
      title.textContent = "Dataset summary";
      caption.textContent = "The Excel export contains one worksheet per dataset. The combined CSV uses a common record structure.";
      head.innerHTML = "<tr><th>Dataset</th><th>Matching records</th><th>Export format</th></tr>";
      const rows = DATASETS.map((item) => `<tr><td><strong>${datasetLabel(item.key)}</strong></td><td>${(data[item.key] || []).length.toLocaleString()}</td><td>Separate Excel sheet / combined CSV rows</td></tr>`);
      body.innerHTML = rows.join("");
      return;
    }

    const rows = data[datasetKey] || [];
    title.textContent = `${datasetLabel(datasetKey)} preview`;
    caption.textContent = `${rows.length.toLocaleString()} matching record(s). Showing up to 15 rows; the download includes all records returned by the API.`;
    if (!rows.length) {
      head.innerHTML = "<tr><th>Preview</th></tr>";
      body.innerHTML = '<tr><td class="empty-cell">No records match the selected filters.</td></tr>';
      return;
    }

    const columns = Object.keys(rows[0]).filter((key) => key !== "feature_snapshot").slice(0, 8);
    head.innerHTML = `<tr>${columns.map((key) => `<th>${escapeHtml(key.replaceAll("_", " "))}</th>`).join("")}</tr>`;
    body.innerHTML = rows.slice(0, 15).map((record) => `<tr>${columns.map((key) => `<td title="${escapeHtml(displayValue(record[key]))}">${escapeHtml(displayValue(record[key]))}</td>`).join("")}</tr>`).join("");
  }

  function getFilters() {
    const datasetKey = $("report-dataset").value;
    const equipmentId = $("report-equipment-filter").value || "all";
    const from = parseLocalDate($("report-from-date").value, false);
    const to = parseLocalDate($("report-to-date").value, true);
    const toRaw = $("report-to-date").value;
    const fromRaw = $("report-from-date").value;
    if (!DATASETS.some((item) => item.key === datasetKey) && datasetKey !== "all") {
      throw new Error("Select a valid dataset.");
    }
    if (from && to && from >= to) throw new Error("The start date must be on or before the end date.");
    if (fromRaw && toRaw && fromRaw > toRaw) throw new Error("The start date must be on or before the end date.");
    return { datasetKey, equipmentId, from, to, fromRaw, toRaw };
  }

  async function generate() {
    if (state.generating) return;
    state.generating = true;
    const button = $("generate-report");
    button.disabled = true;
    button.textContent = "Generating…";
    $("export-report-csv").disabled = true;
    $("export-report-xlsx").disabled = true;
    setStatus("Retrieving records from the FastAPI backend…");

    try {
      const filters = getFilters();
      const data = await fetchReportData(filters.datasetKey, filters.equipmentId, filters.from, filters.to);
      state.report = { ...filters, data, generatedAt: new Date() };
      renderSummary(data);
      previewData(data, filters.datasetKey);
      $("report-generated-at").textContent = `Generated ${state.report.generatedAt.toLocaleString()}`;
      $("export-report-csv").disabled = false;
      $("export-report-xlsx").disabled = false;
      const total = Object.values(data).reduce((sum, records) => sum + records.length, 0);
      setStatus(`Report generated successfully. ${total.toLocaleString()} record(s) matched the selected filters.`);
    } catch (error) {
      state.report = null;
      setStatus(error.message || "Could not generate the report.", true);
      throw error;
    } finally {
      state.generating = false;
      button.disabled = false;
      button.textContent = "Generate report";
    }
  }

  function csvCell(value) {
    let output = value;
    if (output && typeof output === "object") output = JSON.stringify(output);
    if (typeof output === "boolean") output = output ? "true" : "false";
    let stringValue = output === null || output === undefined ? "" : String(output);
    // Prevent spreadsheet formula execution from untrusted text fields.
    if (/^[\s]*[=+\-@]/.test(stringValue)) stringValue = `'${stringValue}`;
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  function toCsv(records) {
    if (!records.length) return '"No matching records"\r\n';
    const keys = [...new Set(records.flatMap((record) => Object.keys(record)))];
    const lines = [keys.map(csvCell).join(",")];
    records.forEach((record) => lines.push(keys.map((key) => csvCell(record[key])).join(",")));
    return `\uFEFF${lines.join("\r\n")}`;
  }

  function downloadBlob(content, type, filename) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fileStamp() {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function allRowsForCsv(data) {
    const rows = [];
    for (const item of DATASETS) {
      for (const record of (data[item.key] || [])) {
        rows.push({
          record_type: item.label,
          record_id: record.id,
          equipment_id: item.key === "equipment" ? record.id : record.equipment_id,
          equipment_name: record.equipment_name || record.name || "",
          asset_tag: record.asset_tag || "",
          event_time: record.recorded_at || record.created_at || record.performed_at || "",
          state_or_risk: record.status || record.risk_level || record.severity || record.maintenance_type || "",
          details_json: JSON.stringify(record),
        });
      }
    }
    return rows;
  }

  function exportCsv() {
    if (!state.report) throw new Error("Generate a report before exporting.");
    const { datasetKey, data } = state.report;
    const records = datasetKey === "all" ? allRowsForCsv(data) : (data[datasetKey] || []);
    const label = datasetKey === "all" ? "all-data" : datasetKey;
    downloadBlob(toCsv(records), "text/csv;charset=utf-8", `predictive-maintenance-${label}-${fileStamp()}.csv`);
    setStatus(`CSV export prepared: ${records.length.toLocaleString()} record(s).`);
  }

  function workbookRows(records) {
    return records.map((record) => {
      const copy = { ...record };
      Object.keys(copy).forEach((key) => {
        if (copy[key] && typeof copy[key] === "object") copy[key] = JSON.stringify(copy[key]);
      });
      return copy;
    });
  }

  async function ensureXlsxLoaded() {
    if (window.XLSX) return window.XLSX;
    if (state.xlsxLoading) return state.xlsxLoading;
    state.xlsxLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("Excel library loaded but is unavailable."));
      script.onerror = () => reject(new Error("Excel export requires an internet connection to load SheetJS. CSV export is still available."));
      document.head.appendChild(script);
    }).finally(() => { state.xlsxLoading = null; });
    return state.xlsxLoading;
  }

  async function exportExcel() {
    if (!state.report) throw new Error("Generate a report before exporting.");
    await ensureXlsxLoaded();

    const { datasetKey, data, equipmentId, fromRaw, toRaw, generatedAt } = state.report;
    const workbook = window.XLSX.utils.book_new();
    const selected = datasetKey === "all" ? DATASETS : DATASETS.filter((item) => item.key === datasetKey);

    const info = [
      { Field: "Report generated", Value: generatedAt.toLocaleString() },
      { Field: "Dataset scope", Value: datasetKey === "all" ? "All datasets" : datasetLabel(datasetKey) },
      { Field: "Equipment filter", Value: equipmentId === "all" ? "All equipment" : equipmentId },
      { Field: "From date", Value: fromRaw || "Not set" },
      { Field: "To date", Value: toRaw || "Not set" },
      ...DATASETS.map((item) => ({ Field: `${datasetLabel(item.key)} records`, Value: (data[item.key] || []).length })),
      { Field: "Note", Value: "Date filters use the event timestamp for each record type." },
    ];
    const infoSheet = window.XLSX.utils.json_to_sheet(info);
    infoSheet["!cols"] = [{ wch: 27 }, { wch: 65 }];
    window.XLSX.utils.book_append_sheet(workbook, infoSheet, "Report_Info");

    selected.forEach((item) => {
      const rows = workbookRows(data[item.key] || []);
      const sheet = window.XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: "No records matched the selected filters." }]);
      if (rows.length) {
        sheet["!cols"] = Object.keys(rows[0]).map((key) => ({ wch: Math.min(Math.max(key.length + 3, 14), 36) }));
      }
      const sheetName = ({ telemetry: "Sensor_Readings", predictions: "Predictions", maintenance: "Maintenance" })[item.key] || item.label.replace(/\W+/g, "_");
      window.XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
    });

    window.XLSX.writeFile(workbook, `predictive-maintenance-${datasetKey}-${fileStamp()}.xlsx`);
    setStatus("Excel workbook generated successfully.");
  }

  window.PM_REPORTS = Object.freeze({ prepareEquipment, generate, exportCsv, exportExcel });
})();
