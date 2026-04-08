// API base URL — proxied in dev, fixed production fallback for cross-site auth.
const API_BASE =
  import.meta.env.VITE_API_URL ||
  'https://prep101-api.vercel.app';

export default API_BASE;
