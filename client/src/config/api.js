// API Configuration
// In production on prep101.site, prefer same-origin /api via Netlify proxy
// to avoid browser CORS/preflight instability on large multipart requests.
const host =
  typeof window !== "undefined" ? String(window.location.hostname || "") : "";
const isPrep101Host = /(^|\.)prep101\.site$/i.test(host);

const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  (isPrep101Host ? "" : "https://prep101-api.vercel.app");

// Debug: Log the API URL being used
console.log("🔧 API_BASE URL:", API_BASE || "(same-origin)");
console.log("🔧 REACT_APP_API_BASE_URL:", process.env.REACT_APP_API_BASE_URL);

export default API_BASE;
