import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Shield,
  Download,
  School,
  Save,
  CheckCircle2,
  Users,
  Clock,
  Palette,
  Calendar,
  AlertTriangle,
  Trash2,
  UserPlus,
  RefreshCw,
  FileCheck,
  Check,
  X,
  Lock,
  Eye,
  FileCode,
  Copy,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { AppUser, UserRole } from '../../types/database';
import { SUPABASE_SQL_SCHEMA } from '../../lib/sqlSchemaCode';

export const SettingsView: React.FC = () => {
  const { user: authUser, role, isConfigured, switchRoleForPreview } = useAuth();
  const {
    settings,
    updateSettings,
    teachers,
    buildings,
    rooms,
    subjects,
    examSchedules,
    invigilatorSchedules,
    users,
    addUser,
    updateUser,
    deleteUser,
    backupData,
    resetData,
  } = useData();

  const isAdmin = role === 'ADMIN';

  // Section A: Identitas Sekolah
  const [schoolName, setSchoolName] = useState(settings.school_name || 'SMP BHINNEKA TUNGGAL IKA');
  const [schoolAddress, setSchoolAddress] = useState(settings.school_address || 'Jl. Pendidikan No. 45, Jakarta');
  const [schoolLogo, setSchoolLogo] = useState(settings.school_logo || '');
  const [academicYear, setAcademicYear] = useState(settings.academic_year || '2024/2025');
  const [semester, setSemester] = useState(settings.semester || 'Genap');

  // Section B: Pengaturan Ujian
  const [examName, setExamName] = useState(settings.exam_name || 'Penilaian Akhir Semester (PAS) Genap');
  const [defaultInvigilators, setDefaultInvigilators] = useState(settings.default_invigilators_per_room || 2);
  const [defaultStartTime, setDefaultStartTime] = useState(settings.default_start_time || '07:30');
  const [defaultDuration, setDefaultDuration] = useState(settings.default_duration || 90);
  const [breakDuration, setBreakDuration] = useState(settings.break_duration || 30);

  // Section C: Pengaturan Sistem
  const [appName, setAppName] = useState(settings.app_name || 'Sistem Manajemen Ujian Sekolah');
  const [theme, setTheme] = useState<'light' | 'slate' | 'blue'>(settings.theme || 'blue');
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'D MMMM YYYY'>(settings.date_format || 'DD/MM/YYYY');

  // State Notifications
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User Management Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('PANITIA');

  // Reset Confirmation Modal
  const [resetModalMode, setResetModalMode] = useState<
    'INVIGILATORS_ONLY' | 'EXAMS_AND_INVIGILATORS' | 'RESET_TO_DEFAULT' | 'ALL_DATA' | null
  >(null);
  const [confirmResetText, setConfirmResetText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // SQL Schema Modal & Copy
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema_smp_bhinneka.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (settings) {
      setSchoolName(settings.school_name || 'SMP BHINNEKA TUNGGAL IKA');
      setSchoolAddress(settings.school_address || 'Jl. Pendidikan No. 45, Jakarta');
      setSchoolLogo(settings.school_logo || '');
      setAcademicYear(settings.academic_year || '2024/2025');
      setSemester(settings.semester || 'Genap');
      setExamName(settings.exam_name || 'Penilaian Akhir Semester (PAS) Genap');
      setDefaultInvigilators(settings.default_invigilators_per_room || 2);
      setDefaultStartTime(settings.default_start_time || '07:30');
      setDefaultDuration(settings.default_duration || 90);
      setBreakDuration(settings.break_duration || 30);
      setAppName(settings.app_name || 'Sistem Manajemen Ujian Sekolah');
      setTheme(settings.theme || 'blue');
      setDateFormat(settings.date_format || 'DD/MM/YYYY');
    }
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setActionMessage({ type: 'error', text: 'Hanya Admin yang berwenang mengubah pengaturan sistem.' });
      return;
    }

    setIsSaving(true);
    const res = await updateSettings({
      school_name: schoolName.trim(),
      school_address: schoolAddress.trim(),
      school_logo: schoolLogo.trim(),
      academic_year: academicYear.trim(),
      semester: semester.trim(),
      exam_name: examName.trim(),
      default_invigilators_per_room: Number(defaultInvigilators),
      default_start_time: defaultStartTime,
      default_duration: Number(defaultDuration),
      break_duration: Number(breakDuration),
      app_name: appName.trim(),
      theme,
      date_format: dateFormat,
    });
    setIsSaving(false);

    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } else {
      setActionMessage({ type: 'error', text: res.error || 'Gagal menyimpan pengaturan.' });
    }
  };

  const handleBackup = () => {
    const data = backupData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_ujian_${schoolName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setActionMessage({ type: 'success', text: 'Cadangan data sistem berhasil diekspor ke file JSON.' });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleOpenResetModal = (mode: 'INVIGILATORS_ONLY' | 'EXAMS_AND_INVIGILATORS' | 'RESET_TO_DEFAULT' | 'ALL_DATA') => {
    setResetModalMode(mode);
    setConfirmResetText('');
  };

  const handleConfirmReset = async () => {
    if (!resetModalMode) return;
    if (confirmResetText !== 'KONFIRMASI') {
      setActionMessage({ type: 'error', text: 'Ketik kata "KONFIRMASI" dengan huruf besar untuk melanjutkan.' });
      return;
    }

    setIsResetting(true);
    const res = await resetData(resetModalMode);
    setIsResetting(false);
    setResetModalMode(null);

    if (res.success) {
      setActionMessage({ type: 'success', text: res.message });
    } else {
      setActionMessage({ type: 'error', text: res.message });
    }
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFullName.trim() || !newUserEmail.trim()) return;

    await addUser({
      full_name: newUserFullName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      active: true,
    });

    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserRole('PANITIA');
    setIsUserModalOpen(false);
    setActionMessage({ type: 'success', text: 'Pengguna baru berhasil ditambahkan.' });
    setTimeout(() => setActionMessage(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Top Banner & Quick Role Info */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-semibold mb-2">
            <School className="w-3.5 h-3.5" />
            <span>{schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">{appName}</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Konfigurasi Terpusat Identitas Sekolah, Pola Penjadwalan, Hak Akses Pengguna, dan Pencadangan Data
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs p-2 rounded-xl border border-white/15 text-xs">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-slate-300 text-[11px] block">Peran Aktif:</span>
            <span className="font-bold text-white uppercase">{role}</span>
          </div>
          {!isAdmin && (
            <button
              onClick={() => switchRoleForPreview('ADMIN')}
              className="ml-2 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg transition-colors text-[11px]"
            >
              Ubah ke Admin
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* SECTION A: IDENTITAS SEKOLAH */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-100">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">A. Identitas Sekolah</h2>
              <p className="text-xs text-slate-500">Nama resmi instansi, alamat, tahun pelajaran, dan logo satuan pendidikan</p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tahun Pelajaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  required
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2024/2025"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Alamat Lengkap Sekolah</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Semester Aktif</label>
                <select
                  disabled={!isAdmin}
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 font-medium"
                >
                  <option value="Ganjil">Semester Ganjil</option>
                  <option value="Genap">Semester Genap</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">URL Logo Sekolah (Opsional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="url"
                  disabled={!isAdmin}
                  value={schoolLogo}
                  onChange={(e) => setSchoolLogo(e.target.value)}
                  placeholder="https://contoh.com/logo-smp-bhinneka.png"
                  className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
                {schoolLogo && (
                  <div className="w-9 h-9 rounded-xl border border-slate-200 p-1 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={schoolLogo}
                      alt="Logo Sekolah"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION B: PENGATURAN UJIAN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">B. Pengaturan Ujian</h2>
              <p className="text-xs text-slate-500">
                Parameter baku untuk penjadwalan ruang, rasio pengawas per ruang, waktu dan jeda istirahat
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Kegiatan Ujian <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  required
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="Penilaian Akhir Semester (PAS) Genap"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Jumlah Pengawas Default per Ruang <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <select
                    disabled={!isAdmin}
                    value={defaultInvigilators}
                    onChange={(e) => setDefaultInvigilators(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 font-medium"
                  >
                    <option value={1}>1 Pengawas per Ruang</option>
                    <option value={2}>2 Pengawas per Ruang (Standar Nasional)</option>
                    <option value={3}>3 Pengawas per Ruang (Khusus)</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Untuk 45 ruang, kebutuhan pengawas adalah{' '}
                  <span className="font-bold text-slate-700">{45 * defaultInvigilators} slot penugasan</span> per sesi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Jam Mulai Default (Sesi 1)</label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Durasi Pengerjaan Default (Menit)</label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  step={5}
                  disabled={!isAdmin}
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Jeda Antar Sesi (Menit)</label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  step={5}
                  disabled={!isAdmin}
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION C: PENGATURAN SISTEM */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-100">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">C. Pengaturan Sistem</h2>
              <p className="text-xs text-slate-500">Nama aplikasi, preferensi tema antarmuka, dan format tanggal</p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Aplikasi</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Aksen Tema</label>
                <select
                  disabled={!isAdmin}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 font-medium"
                >
                  <option value="blue">Biru Korporat (Default)</option>
                  <option value="slate">Slate Elegan</option>
                  <option value="light">Klasik Netral</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Format Tanggal</label>
                <select
                  disabled={!isAdmin}
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 font-medium"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (Contoh: 25/05/2025)</option>
                  <option value="D MMMM YYYY">D MMMM YYYY (Contoh: 25 Mei 2025)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar for Sections A, B, C */}
        {isAdmin && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500">
              Perubahan pada identitas, pengaturan ujian, dan sistem akan langsung diterapkan.
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
            </button>
          </div>
        )}
      </form>

      {/* SECTION D: MANAJEMEN USER & ROLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">D. Manajemen User & Role (Hak Akses)</h2>
              <p className="text-xs text-slate-500">Daftar pengguna terdaftar, tingkat wewenang (Role), dan status aktif</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah User</span>
            </button>
          )}
        </div>

        {/* Permissions Explainer Box */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Matriks Hak Akses & Wewenang:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                <span className="font-bold text-slate-900">Admin</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                <strong>Akses Penuh:</strong> Mengubah pengaturan, kelola user, master data, jadwal, import/export, dan reset sistem.
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="font-bold text-blue-900">Panitia</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                <strong>Kelola Data Ujian:</strong> Input/edit guru, ruang, jadwal ujian, susun jadwal pengawas otomatis & cetak laporan.
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span className="font-bold text-emerald-900">Viewer</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                <strong>Hanya Baca (Read-Only):</strong> Memantau dashboard, melihat jadwal pengawas, mencari jadwal pribadi tanpa hak edit.
              </p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Nama Lengkap & Email</th>
                <th className="px-4 py-3">Peran (Role)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Simulasi Cepat</th>
                {isAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isCurrentSimulated = role === u.role;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{u.full_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-slate-900 text-white'
                            : u.role === 'PANITIA'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        disabled={!isAdmin}
                        onClick={() => updateUser(u.id, { active: !u.active })}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                          u.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{u.active ? 'Aktif' : 'Non-Aktif'}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => switchRoleForPreview(u.role)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          isCurrentSimulated
                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                        title="Simulasikan aplikasi dengan peran user ini"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isCurrentSimulated ? 'Sedang Aktif' : 'Gunakan'}</span>
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {users.length > 1 && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION E: CADANGAN (BACKUP) & RESET SISTEM */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-900 border border-red-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">E. Pencadangan (Backup) & Pemulihan (Reset)</h2>
              <p className="text-xs text-slate-500">
                Ekspor seluruh data operasional ujian atau lakukan pembersihan data bertingkat secara aman
              </p>
            </div>
          </div>

          <button
            onClick={handleBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-blue-300" />
            <span>Unduh Backup JSON</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 text-xs">
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-950">Kebijakan Keamanan Reset Data:</div>
              <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                Data tidak akan pernah dihapus secara langsung tanpa konfirmasi modal. Selalu unduh backup JSON sebelum
                menjalankan tindakan pembersihan jadwal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Reset Option 1 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 text-xs mb-1">Reset Penugasan Pengawas Saja</div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Menghapus semua guru yang ditugaskan ke ruang ujian. Data Guru, Gedung, 45 Ruang, dan Jadwal Ujian tetap
                  utuh.
                </p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleOpenResetModal('INVIGILATORS_ONLY')}
                className="w-full py-2 px-3 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                Reset Jadwal Pengawas
              </button>
            </div>

            {/* Reset Option 2 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 text-xs mb-1">Reset Jadwal Ujian & Pengawas</div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Menghapus jadwal sesi ujian dan penugasan pengawasnya. Master Guru, Gedung, Ruang, dan Mapel tetap
                  tersimpan.
                </p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleOpenResetModal('EXAMS_AND_INVIGILATORS')}
                className="w-full py-2 px-3 bg-white hover:bg-red-50 text-red-700 border border-red-300 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                Reset Jadwal Ujian
              </button>
            </div>

            {/* Reset Option 3 */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
              <div>
                <div className="font-bold text-blue-950 text-xs mb-1">Pulihkan ke Dataset Standar Sekolah</div>
                <p className="text-[11px] text-blue-800/80 leading-relaxed mb-3">
                  Mengembalikan sistem ke kondisi siap pakai SMP Bhinneka Tunggal Ika (2 Gedung, 45 Ruang aktif, dan 50+
                  Guru).
                </p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleOpenResetModal('RESET_TO_DEFAULT')}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-2xs transition-colors disabled:opacity-50"
              >
                Pulihkan Dataset Bawaan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION F: SUPABASE STATUS & RLS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">F. Infrastruktur Cloud & Keamanan Database</h2>
            <p className="text-xs text-slate-500">Supabase PostgreSQL terenkripsi dengan Row Level Security (RLS) terisolasi</p>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-800 mb-1">Status Koneksi Supabase</div>
              <div className="flex items-center gap-2 font-bold mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className={isConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                  {isConfigured ? 'Terkoneksi ke Supabase Cloud (Live Sync)' : 'Mode Lokal Berjalan / Offline Memory'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Data tetap tersinkronisasi dan aman saat mode preview maupun saat terhubung ke database cloud.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-bold text-slate-800 mb-1">Row Level Security (RLS)</div>
              <div className="flex items-center gap-2 font-bold text-emerald-700 mt-1">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Aktif & Terproteksi Penuh</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tabel master data dan jadwal dilindungi aturan RBAC Supabase untuk Admin, Panitia, dan Viewer.
              </p>
            </div>
          </div>

          {/* SQL Editor Code Section */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Skrip Schema Database (SQL Editor)</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                      PostgreSQL
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    File lokasi: <code className="font-mono text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded">/supabase/schema.sql</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                    copiedSql
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Tersalin!' : 'Salin Kode SQL'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Buka & Unduh</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1.5">
              <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                Langkah Cepat Paste di Supabase:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Buka Dashboard proyek Anda di <span className="text-emerald-400 font-bold">Supabase</span>.</li>
                <li>Klik tab menu <strong className="text-white">SQL Editor</strong> di sidebar sebelah kiri.</li>
                <li>Klik tombol <strong className="text-white">+ New Query</strong>.</li>
                <li>Klik tombol <span className="text-blue-300 font-bold">"Salin Kode SQL"</span> di atas, lalu tempelkan (Ctrl+V) di editor.</li>
                <li>Klik tombol hijau <strong className="text-emerald-400">Run</strong> (atau tekan Ctrl + Enter).</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: TAMBAH USER BARU */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Tambah Pengguna Baru</h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap & Gelar <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  placeholder="Dra. Hj. Nurhidayah, M.Pd."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Satuan Pendidikan <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="guru@smpbhinneka.sch.id"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Peran & Wewenang (Role)</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                >
                  <option value="ADMIN">Admin (Akses Penuh)</option>
                  <option value="PANITIA">Panitia (Kelola Data Ujian & Jadwal)</option>
                  <option value="VIEWER">Viewer (Hanya Melihat Dashboard & Jadwal)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI RESET AMAN */}
      {resetModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-950">Konfirmasi Tindakan Reset</h3>
                <p className="text-[11px] text-red-700">Tindakan ini memerlukan verifikasi ganda untuk keamanan data</p>
              </div>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Anda akan melakukan reset:{' '}
                <strong className="text-slate-900 font-bold">
                  {resetModalMode === 'INVIGILATORS_ONLY'
                    ? 'Penugasan Pengawas Ujian'
                    : resetModalMode === 'EXAMS_AND_INVIGILATORS'
                    ? 'Jadwal Ujian & Pengawas'
                    : 'Pemulihan ke Dataset Standar Sekolah'}
                </strong>
                .
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px]">
                Ketik kata <strong className="text-red-600 font-bold">KONFIRMASI</strong> pada kotak di bawah ini untuk
                menyetujui eksekusi reset:
              </div>

              <input
                type="text"
                placeholder="Ketik KONFIRMASI"
                value={confirmResetText}
                onChange={(e) => setConfirmResetText(e.target.value)}
                className="w-full px-3.5 py-2 border-2 border-slate-300 rounded-xl focus:border-red-500 focus:outline-hidden font-bold tracking-wide"
              />

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalMode(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={confirmResetText !== 'KONFIRMASI' || isResetting}
                  onClick={handleConfirmReset}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-40 transition-colors"
                >
                  {isResetting ? 'Memproses...' : 'Eksekusi Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: LIHAT & SALIN SQL SCHEMA */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <span>Skrip Schema Database (Supabase PostgreSQL)</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-700 text-[10px] font-mono">
                      DDL + RLS + SEED
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    File path: <code className="text-amber-300 font-mono">/supabase/schema.sql</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    copiedSql
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSql ? 'Tersalin!' : 'Salin Semua SQL'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  title="Unduh berkas schema.sql"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Unduh .sql</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Instruction Banner */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Cara Pakai:</span>
                <span>Buka <strong>Supabase Dashboard</strong> &rarr; Pilih Proyek &rarr; Menu <strong>SQL Editor</strong> &rarr; <strong>+ New Query</strong> &rarr; Paste & <strong>Run</strong>.</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                8 Tabel &bull; Row Level Security &bull; Trigger Auth &bull; Seed Data
              </span>
            </div>

            {/* Code Block Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed select-all">
              <pre className="whitespace-pre overflow-x-auto text-[11px] sm:text-xs text-emerald-300/90 font-mono">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                Skrip ini membuat tabel <code>profiles</code>, <code>teachers</code>, <code>buildings</code>, <code>rooms</code>, <code>subjects</code>, <code>exam_schedules</code>, <code>invigilator_schedules</code>, <code>settings</code>.
              </span>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
