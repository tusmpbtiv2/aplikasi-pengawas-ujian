import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, initialRole?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchRoleForPreview: (newRole: UserRole) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>('ADMIN'); // Default to ADMIN in fresh applet preview so user can explore admin actions
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(isSupabaseConfigured());

  const fetchProfile = async (userId: string, userEmail?: string): Promise<Profile | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
        return null;
      }

      if (data) {
        setProfile(data as Profile);
        setRole(data.role || 'VIEWER');
        return data as Profile;
      } else {
        // Fallback profile if record not yet populated
        const fallback: Profile = {
          id: userId,
          email: userEmail || '',
          full_name: userEmail?.split('@')[0] || 'Pengguna',
          role: 'VIEWER',
        };
        setProfile(fallback);
        setRole('VIEWER');
        return fallback;
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
      return null;
    }
  };

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setProfile(null);
        setRole('VIEWER');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: new Error('Koneksi Supabase belum dikonfigurasi. Masukkan URL & Anon Key di menu Pengaturan.') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, initialRole: UserRole = 'VIEWER') => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: new Error('Koneksi Supabase belum dikonfigurasi. Masukkan URL & Anon Key di menu Pengaturan.') };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: initialRole,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setRole('VIEWER');
  };

  const switchRoleForPreview = (newRole: UserRole) => {
    setRole(newRole);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        switchRoleForPreview,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
