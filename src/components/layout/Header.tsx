import React from 'react';
import { Menu, Shield, LogIn, LogOut, CheckCircle, AlertTriangle, RefreshCw, FolderKanban } from 'lucide-react';
import { MenuItemId } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

interface HeaderProps {
  currentMenu: MenuItemId;
  onOpenMobile: () => void;
  onOpenAuth: () => void;
  onSelectMenu: (menu: MenuItemId) => void;
}

const menuTitles: Record<MenuItemId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Utama',
    subtitle: 'Ringkasan operasional dan pemantauan pengawas ujian',
  },
  teachers: {
    title: 'Data Guru',
    subtitle: 'Pengelolaan daftar guru, jenis kelamin, NIP, dan pilihan hari mengawas',
  },
  buildings: {
    title: 'Data Gedung',
    subtitle: 'Pengelolaan fasilitas gedung sekolah dan lokasi ruang',
  },
  rooms: {
    title: 'Data Ruang Ujian',
    subtitle: 'Daftar ruang ujian, kapasitas siswa, dan status aktif',
  },
  subjects: {
    title: 'Mata Pelajaran',
    subtitle: 'Daftar mata pelajaran ujian dan kode mapel',
  },
  exam_schedules: {
    title: 'Jadwal Ujian',
    subtitle: 'Penetapan tanggal ujian, hari, sesi, jam, dan mata pelajaran',
  },
  invigilator_schedules: {
    title: 'Jadwal Pengawas Ujian',
    subtitle: 'Penugasan guru pengawas per ruang, peran, status kehadiran, dan validasi bentrok',
  },
  attendance: {
    title: 'Kehadiran Pengawas & Laporan Bendahara',
    subtitle: 'Konfirmasi kehadiran di ruang oleh admin, penanganan guru pengganti, dan rekap honor per mapel',
  },
  print_center: {
    title: 'Pusat Cetak Dokumen Ujian',
    subtitle: 'Cetak Daftar Hadir Harian (F4), Kartu Jadwal Guru (A5), dan Master Jadwal Kode Pengawas',
  },
  import_center: {
    title: 'Import Data (Import Center)',
    subtitle: 'Import terpusat Data Guru, Gedung, Ruang, Mata Pelajaran, dan Jadwal Ujian',
  },
  export_center: {
    title: 'Export Data (Export Center)',
    subtitle: 'Ekspor Data Guru, Ruang, Mapel, Jadwal Ujian, dan Jadwal Pengawas (CSV, Excel, Cetak)',
  },
  settings: {
    title: 'Pengaturan Sistem',
    subtitle: 'Konfigurasi sekolah, tahun ajaran, pengguna/admin, backup & reset data',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentMenu,
  onOpenMobile,
  onOpenAuth,
  onSelectMenu,
}) => {
  const { user, role, signOut, isConfigured, switchRoleForPreview } = useAuth();
  const { loading, refreshAll, projects, activeProjectId, switchProject } = useData();

  const currentInfo = menuTitles[currentMenu] || {
    title: 'Sistem Manajemen Ujian Sekolah',
    subtitle: 'SMP Bhinneka Tunggal Ika',
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <button
          id="header-mobile-toggle-btn"
          onClick={onOpenMobile}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {currentInfo.title}
            </h2>
            <span className="hidden md:inline-block text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              SMP Bhinneka Tunggal Ika
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block mt-0.5">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Project / Kegiatan Ujian Switcher */}
        {projects && projects.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/80 text-blue-900 rounded-lg px-2.5 py-1 text-xs">
            <FolderKanban className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] font-medium text-blue-600 hidden xl:inline">Kegiatan:</span>
            <select
              value={activeProjectId}
              onChange={(e) => switchProject(e.target.value)}
              className="bg-transparent font-bold text-xs text-blue-950 focus:outline-none cursor-pointer max-w-[200px] truncate"
              title="Pilih Kegiatan Ujian / Proyek Aktif"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-slate-800 bg-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={() => refreshAll()}
          title="Segarkan Data dari Supabase"
          disabled={loading}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Supabase Status Pill */}
        <button
          onClick={() => onSelectMenu('settings')}
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
            isConfigured
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
          title="Klik untuk melihat konfigurasi Supabase"
        >
          {isConfigured ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Supabase Terhubung</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Supabase Belum Dikonfigurasi</span>
            </>
          )}
        </button>

        {/* Role Simulator / Indicator */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <span className="hidden sm:inline px-2 py-0.5 text-[11px] font-medium text-slate-500">
            Peran:
          </span>
          <button
            onClick={() => {
              const nextRole = role === 'ADMIN' ? 'PANITIA' : role === 'PANITIA' ? 'VIEWER' : 'ADMIN';
              switchRoleForPreview(nextRole);
            }}
            title="Ganti peran simulasi (ADMIN / PANITIA / VIEWER)"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              role === 'ADMIN'
                ? 'bg-slate-900 text-white shadow-xs'
                : role === 'PANITIA'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
          >
            <Shield className={`w-3 h-3 ${role === 'ADMIN' ? 'text-amber-400' : role === 'PANITIA' ? 'text-blue-200' : 'text-slate-400'}`} />
            <span>{role}</span>
          </button>
        </div>

        {/* Auth User / Login Button */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                {user.email}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              title="Keluar dari Sistem"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Masuk</span>
          </button>
        )}
      </div>
    </header>
  );
};
