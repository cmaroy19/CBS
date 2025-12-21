import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nom_complet: string, role: User['role']) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setSupabaseUser: (user: SupabaseUser | null) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  supabaseUser: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        set({
          user: userData,
          supabaseUser: session.user,
          loading: false
        });
      } else {
        set({ loading: false });
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        (async () => {
          if (session?.user) {
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            const currentUser = get().user;
            if (JSON.stringify(currentUser) !== JSON.stringify(userData)) {
              set({
                user: userData,
                supabaseUser: session.user
              });
            }
          } else {
            const currentUser = get().user;
            if (currentUser !== null) {
              set({
                user: null,
                supabaseUser: null
              });
            }
          }
        })();
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      set({
        user: userData,
        supabaseUser: data.user
      });
    }
  },

  signUp: async (email: string, password: string, nom_complet: string, role: User['role']) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          nom_complet,
          role,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      set({
        user: userData,
        supabaseUser: data.user
      });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, supabaseUser: null });
  },

  setUser: (user) => set({ user }),
  setSupabaseUser: (user) => set({ supabaseUser: user }),
}));
