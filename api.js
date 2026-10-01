// ============================================================
// Shared API client + auth helpers used by every page.
// Change API_BASE if your backend runs somewhere other than localhost:8000.
// ============================================================
const API_BASE = "http://localhost:8000/api/v1";

function getToken() { return localStorage.getItem("token"); }
function getRole() { return localStorage.getItem("role"); }
function getUsername() { return localStorage.getItem("username"); }

function saveSession({ access_token, role, username }) {
  localStorage.setItem("token", access_token);
  localStorage.setItem("role", role);
  localStorage.setItem("username", username);
}

function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

/**
 * Redirects to login if there's no session, or to login with an alert
 * if the logged-in role isn't allowed on this page.
 * Call this at the top of every protected page.
 */
function requireAuth(allowedRoles) {
  const token = getToken();
  const role = getRole();
  if (!token) {
    window.location.href = "login.html";
    return false;
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    alert("Your role (" + role + ") doesn't have access to this page.");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

/**
 * Beanie (the MongoDB ODM used by the backend) serializes each document's
 * primary key as "_id", not "id". This walks every API response and copies
 * "_id" onto "id" wherever it's missing, so the rest of the frontend can
 * consistently use ".id" without every call site needing a fallback.
 */
function normalizeIds(value) {
  if (Array.isArray(value)) {
    value.forEach(normalizeIds);
  } else if (value && typeof value === "object") {
    if (value._id !== undefined && value.id === undefined) {
      value.id = value._id;
    }
    Object.values(value).forEach((v) => {
      if (v && typeof v === "object") normalizeIds(v);
    });
  }
  return value;
}

/**
 * Core fetch wrapper. Adds the auth header, handles JSON encoding/decoding,
 * and redirects to login automatically if the token has expired.
 */
async function apiRequest(path, { method = "GET", body, auth = true, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (!token) {
      window.location.href = "login.html";
      throw new Error("Not authenticated");
    }
    headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401) {
    logout();
    throw new Error("Session expired, please log in again");
  }

  if (!res.ok) {
    let message = "Request failed (" + res.status + ")";
    try {
      const data = await res.json();
      if (data.detail) message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch (_) { /* response wasn't JSON */ }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const data = await res.json();
  return normalizeIds(data);
}

/** Fetches the logged-in user's account (includes employee_id) from /auth/me. */
async function getCurrentUser() {
  return apiRequest("/auth/me");
}

/** Shows a message in the page's #error-banner element, or alerts if none exists. */
function showError(message) {
  const banner = document.getElementById("error-banner");
  if (banner) {
    banner.textContent = message;
    banner.style.display = "block";
  } else {
    alert(message);
  }
}

function hideError() {
  const banner = document.getElementById("error-banner");
  if (banner) banner.style.display = "none";
}
