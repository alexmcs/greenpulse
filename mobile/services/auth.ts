import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createClient(
  Constants.expoConfig?.extra?.supabaseUrl ?? '',
  Constants.expoConfig?.extra?.supabaseAnonKey ?? '',
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true } },
);

export const authService = {
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signUp: async (email: string, password: string, displayName: string) => {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return result;
  },

  signOut: () => supabase.auth.signOut(),

  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  deleteAccount: async () => {
    // Calls DELETE /api/v1/users/me on backend (GDPR)
    const { apiClient } = await import('./api');
    await apiClient.delete('/users/me');
    await supabase.auth.signOut();
  },

  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  isAdmin: async () => {
    const { data } = await supabase.auth.getUser();
    const role = data.user?.user_metadata?.role;
    return role === 'admin' || role === 'moderator';
  },
};
