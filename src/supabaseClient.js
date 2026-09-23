import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
// Membersihkan URL jika pengguna menyertakan '/rest/v1' atau trailing slash
const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [Namoo Snap] Supabase URL atau Anon Key belum dikonfigurasi secara lengkap di file .env!\n' +
    'Silakan buat file .env dari .env.example dan isi dengan kredensial Supabase Anda.'
  );
}

// Inisialisasi Supabase Client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export default supabase;
