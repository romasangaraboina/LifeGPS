/* LifeGPS API bridge — talks to the Spring Boot backend.
   When you deploy the backend online, set the URL in js/config.js
   (window.LIFEGPS_API_URL = "https://your-backend.example.com/api"). */
const LIFE_GPS_API = (window.LIFEGPS_API_URL) || "http://localhost:8080/api";

const LifeGPS = {
  token() { return localStorage.getItem("lifegps_token"); },
  user() { try { return JSON.parse(localStorage.getItem("lifegps_user") || "null"); } catch { return null; } },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData) && options.body != null) headers["Content-Type"] = "application/json";
    if (this.token()) headers.Authorization = "Bearer " + this.token();
    let response;
    try {
      response = await fetch(LIFE_GPS_API + path, { ...options, headers });
    } catch (e) {
      throw new Error("Cannot reach the server at " + LIFE_GPS_API + ". Make sure the backend is running.");
    }
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      // Expired / invalid token on a protected page -> back to login
      if (response.status === 401 && this.token() && !path.startsWith("/auth/")) {
        this.clearSession();
        alert("Your session has expired. Please log in again.");
        location.href = "login.html";
        throw new Error("Session expired.");
      }
      const msg = (data && (data.message || data.error)) || (typeof data === "string" && data) || ("Request failed (" + response.status + ")");
      throw new Error(msg);
    }
    return data;
  },

  /* ---------- auth ---------- */
  async health() { return this.request("/health"); },
  async register(user) { return this.request("/auth/register", { method: "POST", body: JSON.stringify(user) }); },
  async login(email, password) {
    const result = await this.request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (result.token) localStorage.setItem("lifegps_token", result.token);
    if (result.user) localStorage.setItem("lifegps_user", JSON.stringify(result.user));
    return result;
  },
  clearSession() { localStorage.removeItem("lifegps_token"); localStorage.removeItem("lifegps_user"); },
  logout() { this.clearSession(); location.href = "login.html"; },

  /* Call at the top of every protected page. */
  requireLogin() {
    if (!this.token()) { location.replace("login.html"); return false; }
    this.addLogoutLink();
    return true;
  },
  addLogoutLink() {
    const bar = document.querySelector(".sidebar nav") || document.querySelector(".sidebar ul") || document.querySelector(".sidebar");
    if (!bar || document.getElementById("lifegpsLogout")) return;
    const a = document.createElement("a");
    a.id = "lifegpsLogout"; a.href = "#"; a.className = "nav-item"; a.textContent = "🚪 Logout";
    a.addEventListener("click", e => { e.preventDefault(); LifeGPS.logout(); });
    if (bar.tagName === "UL") { const li = document.createElement("li"); li.appendChild(a); bar.appendChild(li); }
    else bar.appendChild(a);
  },

  /* ---------- profile ---------- */
  getProfile() { return this.request("/profile"); },
  updateProfile(p) { return this.request("/profile", { method: "PUT", body: JSON.stringify(p) }); },

  /* ---------- documents ---------- */
  getDocuments() { return this.request("/documents"); },
  uploadDocument(formData) { return this.request("/documents/upload", { method: "POST", body: formData }); },
  addDocument(doc) { return this.request("/documents", { method: "POST", body: JSON.stringify(doc) }); },
  updateDocument(id, doc) { return this.request("/documents/" + id, { method: "PUT", body: JSON.stringify(doc) }); },
  deleteDocument(id) { return this.request("/documents/" + id, { method: "DELETE" }); },
  async downloadDocument(id, name) {
    let response;
    try { response = await fetch(LIFE_GPS_API + "/documents/" + id + "/file", { headers: { Authorization: "Bearer " + this.token() } }); }
    catch { throw new Error("Cannot reach the server."); }
    if (!response.ok) throw new Error(response.status === 404 ? "No file is attached to this document." : "Could not download the file.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name || "document"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /* ---------- life events ---------- */
  getLifeEvents() { return this.request("/life-events"); },
  createLifeEvent(e) { return this.request("/life-events", { method: "POST", body: JSON.stringify(e) }); },
  updateLifeEvent(id, e) { return this.request("/life-events/" + id, { method: "PUT", body: JSON.stringify(e) }); },
  deleteLifeEvent(id) { return this.request("/life-events/" + id, { method: "DELETE" }); },

  /* ---------- reminders ---------- */
  getReminders() { return this.request("/reminders"); },
  createReminder(r) { return this.request("/reminders", { method: "POST", body: JSON.stringify(r) }); },
  setReminderStatus(id, status) { return this.request("/reminders/" + id + "/status", { method: "PUT", body: JSON.stringify({ status }) }); },
  deleteReminder(id) { return this.request("/reminders/" + id, { method: "DELETE" }); },

  /* ---------- assistant ---------- */
  ask(question) { return this.request("/assistant/ask", { method: "POST", body: JSON.stringify({ question }) }); }
};
