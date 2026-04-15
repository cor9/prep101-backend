import API_BASE from "../config/api";

export function buildAuthHeaders(user, extraHeaders = {}) {
  const token = user?.accessToken || user?.token;
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function withApiCredentials(init = {}, user = null) {
  return {
    // Use same-origin credentials so cookies work on same-origin paths (prep101.site/api/*)
    // but cross-origin requests to Vercel can proceed without the stricter credentialed-preflight
    // constraints. Auth is propagated via the Authorization header (Bearer token), not cookies.
    credentials: "same-origin",
    ...init,
    headers: buildAuthHeaders(user, init.headers || {}),
  };
}

export async function apiFetch(path, init = {}, user = null) {
  return fetch(`${API_BASE}${path}`, withApiCredentials(init, user));
}
