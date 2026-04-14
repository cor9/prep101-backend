// API Configuration
// Use direct API domain by default. Some prep101.site edge routes can return
// HTML 404 for /api/*, which breaks JSON parsing in auth flows.
const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  "https://prep101-api.vercel.app";

// Debug: Log the API URL being used
console.log("🔧 API_BASE URL:", API_BASE);
console.log("🔧 REACT_APP_API_BASE_URL:", process.env.REACT_APP_API_BASE_URL);

export default API_BASE;
