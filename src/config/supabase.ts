// Supabase Configuration for Deadly Duel
import { createClient } from '@supabase/supabase-js';

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing REACT_APP_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing REACT_APP_SUPABASE_ANON_KEY environment variable');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic token refresh
    autoRefreshToken: true,
    // Persist auth session in localStorage
    persistSession: true,
    // Detect auth session from URL
    detectSessionInUrl: true,
    // Storage key for auth session
    storageKey: 'deadly-duel-auth'
  },
  // Database settings
  db: {
    schema: 'public'
  },
  // Real-time settings
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export default supabase;