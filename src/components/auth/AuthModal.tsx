import React, { useState } from 'react';
import { LogIn, UserPlus, AlertCircle, CheckCircle2, Shield, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { UserRole } from '../../types/database';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToSettings?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onGoToSettings }) => {
  const { signIn, signUp, isConfigured } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('VIEWER');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!isConfigured) {
      setLoading(false);
      setErrorMsg('Koneksi Supabase belum dikonfigurasi. Silakan isi URL dan Anon Key di menu Pengaturan.');
      return;
    }

    try {
      if (isRegister) {
        if (!fullName.trim()) {
          setErrorMsg('Nama lengkap wajib diisi');
          setLoading(false);
          return;
        }
        const res = await signUp(email, password, fullName, role);
        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          setSuccessMsg('Registrasi berhasil! Silakan periksa email untuk konfirmasi (jika email confirmation aktif) atau langsung masuk.');
          setTimeout(() => {
            setIsRegister(false);
            setSuccessMsg(null);
          }, 2500);
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan autentikasi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRegister ? 'Daftar Akun Baru' : 'Masuk ke Sistem Pengawas'}
      maxWidth="md"
    >
      <div>
        {!isConfigured && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Koneksi Supabase Belum Aktif</p>
              <p className="mt-0.5 text-amber-700">
                Supabase Auth membutuhkan Project URL & Anon Key yang valid. Anda dapat mengaturnya di menu Pengaturan atau melalui file <code>.env</code>.
              </p>
              {onGoToSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToSettings();
                  }}
                  className="mt-2 text-xs font-semibold text-blue-800 underline hover:text-blue-900"
                >
                  Buka Pengaturan Supabase &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Dra. Hj. Siti Nurjanah, M.Pd."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sekolah.sch.id"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Peran Pengguna (Role)
              </label>
              <div className="relative">
                <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="VIEWER">VIEWER (Hanya Lihat Jadwal)</option>
                  <option value="ADMIN">ADMIN (Kelola Data & Jadwal Penuh)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Catatan: Dalam arsitektur RLS produksi, peran Admin dapat dibatasi melalui SQL Editor.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <span className="text-xs">Memproses...</span>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                Daftar Akun
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Masuk
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-200 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            {isRegister
              ? 'Sudah punya akun? Masuk di sini'
              : 'Belum memiliki akun? Buat akun baru'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
