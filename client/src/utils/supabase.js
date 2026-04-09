import { createClient } from '@supabase/supabase-js'
import API_BASE from '../config/api'

const supabaseUrl = 'https://eokqyijxubrmompozguh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0'

// Disable auto session refresh to prevent errors when using backend-based auth
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})

// Auth functions - use backend API for registration/login to ensure users are created in our database
export const signUp = async (email, password, name) => {
  console.log('🔍 signUp called with:', { email, password: '***', name });

  // Clean the email
  const cleanEmail = email.trim().toLowerCase();
  console.log('🔍 Cleaned email:', cleanEmail);

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
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

    const result = await response.json();
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
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
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
    await fetch(`${API_BASE}/api/auth/logout`, {
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
    const response = await fetch(`${API_BASE}/api/auth/verify`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return { user: null, error: null };
    }

    const result = await response.json();
    if (result.valid && result.user) {
      return {
        user: result.user,
        error: null
      };
    }

    return { user: null, error: null };
  } catch (error) {
    console.error('Error verifying user:', error);
    return { user: null, error };
  }
}
