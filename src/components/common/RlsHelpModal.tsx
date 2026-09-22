import React, { useState } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Terminal,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { Modal } from './Modal';
import { SUPABASE_RLS_FIX_SQL, SUPABASE_DISABLE_RLS_SQL } from '../../lib/sqlSchemaCode';
import { useToast } from '../../context/ToastContext';

interface RlsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName?: string;
  onRetry?: () => void;
}

export const RlsHelpModal: React.FC<RlsHelpModalProps> = ({
  isOpen,
  onClose,
  tableName = 'teachers',
  onRetry,
}) => {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<'policy' | 'disable'>('policy');
  const [copied, setCopied] = useState(false);

  const selectedSql = activeTab === 'policy' ? SUPABASE_RLS_FIX_SQL : SUPABASE_DISABLE_RLS_SQL;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedSql);
      setCopied(true);
      success(
        'SQL Perbaikan Berhasil Disalin!',
        'Tempelkan ke menu SQL Editor di Supabase Dashboard, lalu klik Run.'
      );
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Solusi Error Row-Level Security (RLS) Supabase"
      maxWidth="3xl"
    >
      <div className="space-y-5 text-slate-700">
        {/* Error Explanation Card */}
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-3">
          <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="text-xs leading-relaxed space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-rose-900 text-sm">
                Penyebab Terjadinya Error RLS:
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-200/60 text-rose-800 font-bold">
                Tabel: {tableName}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-200/60 text-rose-800 font-bold">
                PostgreSQL Code 42501
              </span>
            </div>
            <p className="text-rose-800">
              Supabase secara default mengaktifkan fitur <strong>Row Level Security (RLS)</strong> untuk melindungi database.
              Karena aplikasi ini terhubung menggunakan <strong>Anon Key (koneksi tanpa login email akun Supabase)</strong>,
              database menolak perintah <code>INSERT</code> untuk menambah baris data baru ke tabel <code>{tableName}</code>.
            </p>
          </div>
        </div>

        {/* Step-by-step Solution */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            Langkah Cepat Memperbaiki (Hanya Butuh 30 Detik):
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                1
              </div>
              <p className="font-semibold text-slate-800">Buka Supabase</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Masuk ke dashboard proyek Supabase Anda, lalu klik menu <strong>SQL Editor</strong> di bilah navigasi kiri.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                2
              </div>
              <p className="font-semibold text-slate-800">Paste & Run Skrip</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Salin skrip SQL di bawah ini, tempelkan ke <strong>+ New Query</strong>, lalu klik tombol hijau <strong>Run</strong>.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">
                3
              </div>
              <p className="font-semibold text-slate-800">Impor Ulang</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Kembali ke aplikasi ini dan klik tombol <strong>Coba Impor Ulang</strong>. Data akan langsung tersimpan aman!
              </p>
            </div>
          </div>
        </div>

        {/* Script Selection & Code Viewer */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-950">
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('policy')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'policy'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Opsi 1: Pasang Policy Izin Public (Direkomendasikan)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('disable')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'disable'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Opsi 2: Nonaktifkan RLS
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Skrip SQL'}</span>
            </button>
          </div>

          <div className="p-4 max-h-56 overflow-y-auto font-mono text-[11px] text-emerald-300 leading-relaxed select-all">
            <pre className="whitespace-pre overflow-x-auto">{selectedSql}</pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Skrip ini aman &bull; Mengizinkan semua tabel (guru, ruang, jadwal) diakses lancar.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Tutup
            </button>
            {onRetry && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetry();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs"
              >
                Saya Sudah Run Skrip &bull; Coba Impor Lagi
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
