// API Configuration
const API_BASE = 
  (import.meta?.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:3001'; // Default to local server for development

export default API_BASE;
