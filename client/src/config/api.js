// API Configuration
const API_BASE = 
  (import.meta?.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'https://childactor101.sbs'; // Production backend - Updated for public use

export default API_BASE;
