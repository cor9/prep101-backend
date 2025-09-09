import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eokqyijxubrmompozguh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVva3F5aWp4dWJybW9tcG96Z3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTQxNjUsImV4cCI6MjA3Mjk5MDE2NX0.T6xlKoYDXO-iVvbrjFV5QIOg7FCFC3YVjdrjqgy7Vy0'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth functions
export const signUp = async (email, password, name) => {
  console.log('�� signUp called with:', { email, password: '***', name });
  
  // Clean the email
  const cleanEmail = email.trim().toLowerCase();
  console.log('🔍 Cleaned email:', cleanEmail);
  
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        name: name || ''
      }
    }
  })
  
  console.log('🔍 Supabase response:', { data, error });
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}
