// API base URL — proxied in dev, real URL in production
const API_BASE = import.meta.env.VITE_API_URL || '';
export default API_BASE;
