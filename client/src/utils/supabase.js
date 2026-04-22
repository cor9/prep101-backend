import { createClient } from '@supabase/supabase-js'
import API_BASE from '../config/api'

const supabaseUrl = 'https://eokqyijxubrmompozguh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0'
const DIRECT_API_BASE = 'https://prep101-api.vercel.app'

// Disable auto session refresh to prevent errors when using backend-based auth
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

const looksLikeHtmlContentType = (response) =>
  String(response?.headers?.get('content-type') || '')
    .toLowerCase()
    .includes('text/html');

const looksLikeHtmlBody = (text = '') => {
  const snippet = String(text || '').trim().slice(0, 32).toLowerCase();
  return (
    snippet.startsWith('<!doctype') ||
    snippet.startsWith('<html') ||
    snippet.startsWith('<head') ||
    snippet.startsWith('<body')
  );
};

const responseLooksLikeHtml = async (response) => {
  if (!response) return false;
  if (looksLikeHtmlContentType(response)) return true;
  try {
    const bodyPreview = await response.clone().text();
    return looksLikeHtmlBody(bodyPreview);
  } catch (_) {
    return false;
  }
};

async function authFetch(path, init = {}) {
  const primaryBase = API_BASE || '';
  const primaryUrl = `${primaryBase}${path}`;
  const fallbackUrl = `${DIRECT_API_BASE}${path}`;
  const canFallback = primaryUrl !== fallbackUrl;

  const run = async (url) => fetch(url, init);

  try {
    const primaryResponse = await run(primaryUrl);
    // If proxy returned HTML (usually SPA fallback), retry direct API.
    if (canFallback && await responseLooksLikeHtml(primaryResponse)) {
      return run(fallbackUrl);
    }
    return primaryResponse;
  } catch (error) {
    if (canFallback) {
      return run(fallbackUrl);
    }
    throw error;
  }
}

async function parseJsonResponse(response, fallbackMessage = 'Request failed') {
  const raw = await response.text();
  try {
    return JSON.parse(raw || '{}');
  } catch (error) {
    if (looksLikeHtmlBody(raw)) {
      throw new Error('Unexpected HTML response from auth service. Please retry.');
    }
    
    // If it's a simple string, it might be a plain-text error from a proxy or rate-limiter
    if (raw && raw.length > 0 && raw.length < 200) {
      return { message: raw };
    }
    
    console.error('🔍 JSON Parse failed. Raw response:', raw.substring(0, 500));
    throw new Error(fallbackMessage);
  }
}

// Auth functions - use backend API for registration/login to ensure users are created in our database
export const signUp = async (email, password, name) => {
  console.log('🔍 signUp called with:', { email, password: '***', name });

  // Clean the email
  const cleanEmail = email.trim().toLowerCase();
  console.log('🔍 Cleaned email:', cleanEmail);

  try {
    const response = await authFetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        name: name || cleanEmail.split('@')[0]
      })
    });

    const result = await parseJsonResponse(response, 'Registration failed');
    console.log('🔍 Backend response:', result);

    if (!response.ok) {
      // Handle validation errors
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => e.msg || e.message).join(', ');
        return { data: null, error: { message: errorMessages } };
      }
      return { data: null, error: { message: result.message || 'Registration failed' } };
    }

    return {
      data: {
        user: result.user,
        session: {
          access_token: result.token,
          user: result.user
        }
      },
      error: null
    };
  } catch (error) {
    console.error('🔍 Registration error:', error);
    return { data: null, error: { message: error.message || 'Registration failed' } };
  }
}

export const signIn = async (email, password) => {
  console.log('🔍 signIn called with:', { email });

  try {
    const response = await authFetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const result = await parseJsonResponse(response, 'Login failed');
    console.log('🔍 Backend login response:', result);

    if (!response.ok) {
      return { data: null, error: { message: result.message || 'Login failed' } };
    }

    return {
      data: {
        user: result.user,
        session: {
          access_token: result.token,
          user: result.user
        }
      },
      error: null
    };
  } catch (error) {
    console.error('🔍 Login error:', error);
    return { data: null, error: { message: error.message || 'Login failed' } };
  }
}

export const signOut = async () => {
  try {
    await authFetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    }).catch(() => {});
  } catch (e) {
    console.log('Logout cleanup error:', e);
  }

  return { error: null }
}

export const getCurrentUser = async () => {
  try {
    // Read stored token to use as Bearer auth (cookies may not be forwarded by the proxy)
    let storedToken = null;
    try { storedToken = localStorage.getItem('ca101_token') || null; } catch (_) {}

    const verifyInit = {
      credentials: 'include',
      ...(storedToken ? { headers: { Authorization: `Bearer ${storedToken}` } } : {}),
    };

    const response = await authFetch('/api/auth/verify', verifyInit);

    if (!response.ok) {
      return { user: null, error: null };
    }

    const result = await parseJsonResponse(response, 'Verification failed');
    if (result.valid && result.user) {
      return {
        user: {
          ...result.user,
          // Attach the token to the user object so AuthContext can embed it
          // without relying on the cookie round-trip.
          accessToken: storedToken || result.user.accessToken || result.user.token || null,
          token: storedToken || result.user.token || result.user.accessToken || null,
        },
        error: null
      };
    }

    return { user: null, error: null };
  } catch (error) {
    console.error('Error verifying user:', error);
    return { user: null, error };
  }
}
