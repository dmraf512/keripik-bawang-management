import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { signIn, isSubmitting, authError, configError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(email, password);
  };

  const activeError = configError || authError;

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2E1A11] text-[#D8B25C] mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-[#2B1B12]">
            Keripik Bawang
          </h1>
          <p className="text-sm text-[#6F574A]">
            Sistem Manajemen Bisnis Internal · Akses Administrator
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-[#E5D9C8] rounded-xl p-6 sm:p-8 shadow-2xs space-y-5">
          <div>
            <h2 className="text-base font-display font-semibold text-[#2B1B12]">
              Masuk ke Sistem
            </h2>
            <p className="mt-1 text-xs text-[#7A6154]">
              Gunakan akun administrator terdaftar untuk mengakses dasbor operasional dan laporan.
            </p>
          </div>

          {activeError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#FDF2F0] border border-[#F2C6BF] text-xs text-[#9E2A1E]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{activeError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-[#2B1B12] mb-1.5"
              >
                Email Administrator
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8A7163] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={Boolean(configError) || isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="nama@domain.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg text-[#2B1B12] placeholder-[#9C8578] focus:outline-none focus:border-[#C59B43] disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-[#2B1B12] mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8A7163] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={Boolean(configError) || isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-[#FAF6F0] border border-[#E5D9C8] rounded-lg text-[#2B1B12] placeholder-[#9C8578] focus:outline-none focus:border-[#C59B43] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#8A7163] hover:text-[#2B1B12] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={Boolean(configError) || isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#362015] text-[#FDFBF7] hover:bg-[#4A2C1D] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <span>Masuk</span>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#EFE6DA] text-[11px] text-[#8A7163] text-center leading-relaxed">
            Akses internal khusus satu administrator. Pendaftaran akun publik tidak tersedia.
          </div>
        </div>
      </div>
    </div>
  );
};
