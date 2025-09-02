// API Configuration
const API_BASE = 
  (import.meta?.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  'https://childactor101.sbs'; // Production backend - Updated for public use

// Debug: Log the API URL being used
console.log('🔧 API_BASE URL:', API_BASE);
console.log('🔧 VITE_API_BASE_URL:', import.meta?.env?.VITE_API_BASE_URL);
console.log('🔧 REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);

export default API_BASE;
