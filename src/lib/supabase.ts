import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'sim_supabase_url';
const STORAGE_ANON_KEY = 'sim_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const localUrl = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '').trim();
  const localKey = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) || '' : '').trim();

  return {
    url: envUrl || localUrl,
    anonKey: envKey || localKey,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey && url.startsWith('http') && anonKey.length > 10);
}

export function saveLocalSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_URL_KEY, url.trim());
    else localStorage.removeItem(STORAGE_URL_KEY);

    if (anonKey) localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
    else localStorage.removeItem(STORAGE_ANON_KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (cachedClient && currentUrl === url && currentKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentUrl = url;
    currentKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabase();
  if (!client) {
    return {
      success: false,
      message: 'Kredensial Supabase (URL / Anon Key) belum diisi.',
    };
  }

  try {
    // Attempt a light ping on profiles or auth session
    const { error } = await client.from('profiles').select('id', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116' && !error.message.includes('relation') && !error.message.includes('permission')) {
      return {
        success: false,
        message: `Koneksi gagal: ${error.message}`,
      };
    }
    return {
      success: true,
      message: 'Koneksi ke database Supabase berhasil terhubung!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menghubungi server Supabase.',
    };
  }
}
