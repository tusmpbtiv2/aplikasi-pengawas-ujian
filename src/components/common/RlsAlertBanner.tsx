import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, ExternalLink, HelpCircle, RefreshCw } from 'lucide-react';
import { SUPABASE_RLS_FIX_SQL } from '../../lib/sqlSchemaCode';
import { useToast } from '../../context/ToastContext';
import { RlsHelpModal } from './RlsHelpModal';

interface RlsAlertBannerProps {
  tableName?: string;
  onRetry?: () => void;
  onSaveLocally?: () => void;
  className?: string;
}

export const RlsAlertBanner: React.FC<RlsAlertBannerProps> = ({
  tableName = 'teachers',
  onRetry,
  onSaveLocally,
  className = '',
}) => {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_RLS_FIX_SQL);
      setCopied(true);
      success(
        'SQL Perbaikan RLS Disalin!',
        'Buka Supabase > SQL Editor > Paste skrip ini > Klik Run, lalu coba impor ulang.'
      );
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <>
      <div
        className={`p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs shadow-xs space-y-3 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-200/80 rounded-lg text-amber-900 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-amber-950">
                Penyebab Gagal Simpan: Row-Level Security (RLS) Supabase Aktif
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-200 text-amber-900 font-bold">
                Tabel: {tableName}
              </span>
            </div>
            <p className="text-amber-900 leading-relaxed text-[11px] sm:text-xs">
              Supabase menolak perintah <code>INSERT</code> karena kebijakan izin (Policy) tabel <strong>{tableName}</strong> belum
              mengizinkan koneksi menggunakan Anon Key untuk menambah data.
              Silakan jalankan skrip SQL perbaikan sekali saja di SQL Editor Supabase.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/80">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'SQL Perbaikan Disalin!' : 'Salin SQL Perbaikan (1-Klik)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 font-semibold rounded-lg text-xs transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
            <span>Lihat Panduan & Skrip Lengkap</span>
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Impor Ulang</span>
            </button>
          )}

          {onSaveLocally && (
            <button
              type="button"
              onClick={onSaveLocally}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
              title="Simpan data ke memori aplikasi tanpa menyinkronkan ke Supabase sekarang"
            >
              <span>Tetap Simpan Sementara di Memori</span>
            </button>
          )}
        </div>
      </div>

      <RlsHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        tableName={tableName}
        onRetry={onRetry}
      />
    </>
  );
};
