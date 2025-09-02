// API Configuration
const API_BASE = 
  (import.meta?.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:5001'; // Temporary: use local backend while Railway is down

export default API_BASE;
