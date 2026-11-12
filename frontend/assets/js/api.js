(function () {
  "use strict";

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      window.PM_CONFIG.REQUEST_TIMEOUT_MS || 20000
    );

    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");

    let response;
    try {
      response = await fetch(`${window.PM_CONFIG.API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("The request timed out. Check that the backend is running.");
      }
      throw new Error("Cannot connect to the backend. Check the API URL and FastAPI server.");
    } finally {
      window.clearTimeout(timeout);
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      data = text ? { detail: text } : null;
    }

    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
        const onAuthPage = /\/login\.html$|\/pages\/register\.html$/.test(window.location.pathname);
        if (!onAuthPage) window.location.href = "/login.html";
      }
      const detail = data && (data.detail || data.message);
      const message = Array.isArray(detail)
        ? detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
        : detail;
      throw new Error(message || `Request failed with HTTP ${response.status}`);
    }
    return data;
  }

  window.PM_API = Object.freeze({
    get: (path) => request(path, { method: "GET" }),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: "DELETE" }),
  });
})();
