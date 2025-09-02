// API Configuration
const API_BASE = 
  (import.meta?.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'https://prep101-backend.onrender.com'; // Production Render backend

export default API_BASE;
