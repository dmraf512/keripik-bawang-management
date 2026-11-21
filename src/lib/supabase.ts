import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string | null;
  errorMessage: string | null;
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawSupabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function validateSupabaseConfig(): SupabaseConfigStatus {
  const missing: string[] = [];

  if (!rawSupabaseUrl) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!rawSupabaseKey) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  if (missing.length > 0) {
    return {
      isConfigured: false,
      url: null,
      errorMessage: `Variabel lingkungan belum lengkap: ${missing.join(', ')}. Pastikan file .env.local tersedia dan server pengembangan sudah dimulai ulang.`,
    };
  }

  try {
    const parsed = new URL(rawSupabaseUrl!);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        isConfigured: false,
        url: null,
        errorMessage:
          'VITE_SUPABASE_URL harus menggunakan protokol http atau https yang valid.',
      };
    }
  } catch {
    return {
      isConfigured: false,
      url: null,
      errorMessage:
        'Format VITE_SUPABASE_URL tidak valid. Periksa kembali konfigurasi .env.local.',
    };
  }

  if (
    rawSupabaseKey!.startsWith('sb_secret_') ||
    rawSupabaseKey!.includes('service_role')
  ) {
    return {
      isConfigured: false,
      url: null,
      errorMessage:
        'Konfigurasi tidak aman: jangan gunakan secret key atau service role key di sisi klien.',
    };
  }

  return {
    isConfigured: true,
    url: rawSupabaseUrl!,
    errorMessage: null,
  };
}

export const supabaseConfig: SupabaseConfigStatus = validateSupabaseConfig();

export const supabase: SupabaseClient | null =
  supabaseConfig.isConfigured && rawSupabaseUrl && rawSupabaseKey
    ? createClient(rawSupabaseUrl, rawSupabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function mapSupabaseAuthError(error: unknown): string {
  if (!error) {
    return 'Terjadi kesalahan autentikasi yang tidak diketahui.';
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const lower = message.toLowerCase();

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials')
  ) {
    return 'Email atau kata sandi salah. Silakan periksa kembali kredensial Anda.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Akun email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.';
  }

  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Terlalu banyak percobaan masuk. Tunggu beberapa saat sebelum mencoba lagi.';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('fetch')
  ) {
    return 'Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda lalu coba lagi.';
  }

  if (lower.includes('invalid api key') || lower.includes('apikey')) {
    return 'Kunci API Supabase tidak valid. Periksa VITE_SUPABASE_PUBLISHABLE_KEY pada .env.local.';
  }

  return message || 'Gagal memproses autentikasi. Silakan coba kembali.';
}

export function mapSupabaseDatabaseError(error: unknown): string {
  if (!error) {
    return 'Terjadi kesalahan basis data yang tidak diketahui.';
  }

  const errObj =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown })
      : null;

  const code = errObj?.code ? String(errObj.code) : '';
  const message = errObj?.message ? String(errObj.message) : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  ) {
    return 'Gagal terhubung ke basis data Supabase. Periksa koneksi internet Anda lalu coba lagi.';
  }

  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Akses ditolak oleh kebijakan keamanan database (RLS). Pastikan Anda masuk dengan akun administrator yang berwenang.';
  }

  if (code === '23505' || lower.includes('duplicate key')) {
    return 'Data dengan kode atau identitas yang sama sudah terdaftar di database.';
  }

  if (code === '23503' || lower.includes('foreign key')) {
    return 'Data tidak dapat disimpan atau dihapus karena masih terhubung dengan data lain.';
  }

  if (code === '23514' || lower.includes('check constraint')) {
    return `Nilai input tidak sesuai aturan validasi database: ${message}`;
  }

  if (code === 'PGRST202') {
    return `Fungsi database tidak ditemukan atau parameter tidak sesuai: ${message}`;
  }

  if (code === 'P0001') {
    return message;
  }

  return message || 'Terjadi kesalahan saat memproses permintaan database.';
}

export interface DatabaseConnectionResult {
  connected: boolean;
  checkedAt: string;
  message: string;
}

/**
 * Memeriksa keterhubungan ke tabel Supabase PostgreSQL secara read-only
 * menggunakan sesi pengguna yang terautentikasi tanpa mengubah skema atau data.
 */
export async function verifyDatabaseConnection(): Promise<DatabaseConnectionResult> {
  const checkedAt = new Date().toISOString();

  if (!supabaseConfig.isConfigured || !supabase) {
    return {
      connected: false,
      checkedAt,
      message:
        supabaseConfig.errorMessage ??
        'Konfigurasi variabel lingkungan Supabase belum lengkap.',
    };
  }

  try {
    const { error } = await supabase
      .from('business_profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return {
        connected: false,
        checkedAt,
        message: mapSupabaseDatabaseError(error),
      };
    }

    return {
      connected: true,
      checkedAt,
      message: 'Terhubung ke Supabase PostgreSQL dan kebijakan RLS aktif.',
    };
  } catch (err) {
    return {
      connected: false,
      checkedAt,
      message: mapSupabaseDatabaseError(err),
    };
  }
}
