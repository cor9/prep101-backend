// API Configuration
// On prep101.site use same-origin /api (Netlify proxy via _redirects)
// to avoid browser CORS blocks on large multipart uploads.
const host =
  typeof window !== "undefined" ? String(window.location.hostname || "") : "";
const isPrep101Host = /(^|\.)prep101\.site$/i.test(host);

const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  (isPrep101Host ? "" : "https://prep101-api.vercel.app");

// Debug: Log the API URL being used
console.log("🔧 API_BASE URL:", API_BASE || "(same-origin /api)");
console.log("🔧 REACT_APP_API_BASE_URL:", process.env.REACT_APP_API_BASE_URL);

export default API_BASE;
