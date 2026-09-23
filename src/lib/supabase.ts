import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'sim_supabase_url';
const STORAGE_ANON_KEY = 'sim_supabase_anon_key';

const DEFAULT_SUPABASE_URL = 'https://hruenqwrztbmsxntpclz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWVucXdyenRibXN4bnRwY2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc3NDYsImV4cCI6MjEwNTUzMzc0Nn0.EebQK3Y5LSFBL-KfUMAHCv1HjGuTL9aQPLHu4z-wwrc';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const globalConfig = typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ : null;
  const globalUrl = (globalConfig?.supabaseUrl || '').trim();
  const globalKey = (globalConfig?.supabaseAnonKey || '').trim();

  const localUrl = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '').trim();
  const localKey = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) || '' : '').trim();

  const finalUrl = envUrl || globalUrl || localUrl || DEFAULT_SUPABASE_URL;
  const finalKey = envKey || globalKey || localKey || DEFAULT_SUPABASE_ANON_KEY;

  if (typeof window !== 'undefined' && !localUrl && finalUrl) {
    try {
      localStorage.setItem(STORAGE_URL_KEY, finalUrl);
      localStorage.setItem(STORAGE_ANON_KEY, finalKey);
    } catch (_) {}
  }

  return {
    url: finalUrl,
    anonKey: finalKey,
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
