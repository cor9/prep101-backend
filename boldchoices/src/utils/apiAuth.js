import API_BASE from "../config/api.js";

export function buildAuthHeaders(user, extraHeaders = {}) {
  const token = user?.accessToken || user?.token;
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function withApiCredentials(init = {}, user = null) {
  return {
    credentials: "include",
    ...init,
    headers: buildAuthHeaders(user, init.headers || {}),
  };
}

export async function apiFetch(path, init = {}, user = null) {
  return fetch(`${API_BASE}${path}`, withApiCredentials(init, user));
}
