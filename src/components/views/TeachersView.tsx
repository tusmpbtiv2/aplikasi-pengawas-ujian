import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Calendar,
  Filter,
  Download,
  Upload,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Teacher } from '../../types/database';
import { isPanitiaTeacher } from '../../lib/invigilatorHelper';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { PageHeader } from '../common/PageHeader';
import { Pagination } from '../common/Pagination';
import { TeacherDetailModal } from '../teachers/TeacherDetailModal';
import { TeacherImportModal } from '../teachers/TeacherImportModal';
import { exportToSpreadsheet } from '../../lib/excelHelper';

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const TeachersView: React.FC = () => {
  const { teachers, addTeacher, updateTeacher, deleteTeacher, loading, error: dataError } = useData();
  const { role } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = role === 'ADMIN';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Laki-laki' | 'Perempuan'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [invigilatorCode, setInvigilatorCode] = useState('');
  const [active, setActive] = useState(true);
  const [availableDays, setAvailableDays] = useState<string[]>(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const q = searchTerm.toLowerCase();
      const code = (t.invigilator_code || t.employee_number || '').toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(q) ||
        code.includes(q) ||
        (t.employee_number && t.employee_number.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q));

      const matchesGender = genderFilter === 'ALL' || t.gender === genderFilter;
      const matchesStatus =
        statusFilter === 'ALL' || (statusFilter === 'active' ? t.active : !t.active);

      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [teachers, searchTerm, genderFilter, statusFilter]);

  // Pagination calculations
  const totalItems = filteredTeachers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTeachers.slice(start, start + pageSize);
  }, [filteredTeachers, currentPage, pageSize]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setGender('Laki-laki');
    // Auto-generate next code suggestion (e.g. P07)
    const nextNum = teachers.length + 1;
    const suggestedCode = `P${String(nextNum).padStart(2, '0')}`;
    setInvigilatorCode(suggestedCode);
    setActive(true);
    setAvailableDays(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);
    setNotes('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (t: Teacher) => {
    setEditingId(t.id);
    setName(t.name);
    setGender(t.gender);
    setInvigilatorCode(t.invigilator_code || t.employee_number || '');
    setActive(t.active);
    setAvailableDays(t.available_days || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);
    setNotes(t.notes || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (t: Teacher) => {
    setSelectedTeacher(t);
    setIsDetailModalOpen(true);
  };

  const handleOpenDelete = (t: Teacher) => {
    setSelectedTeacher(t);
    setIsDeleteModalOpen(true);
  };

  const handleToggleDay = (day: string) => {
    if (availableDays.includes(day)) {
      setAvailableDays(availableDays.filter((d) => d !== day));
    } else {
      setAvailableDays([...availableDays, day]);
    }
  };

  const handleSelectAllDays = () => {
    setAvailableDays([...ALL_DAYS]);
  };

  const handleClearDays = () => {
    setAvailableDays([]);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation: Nama wajib diisi
    if (!name.trim()) {
      setFormError('Nama lengkap guru wajib diisi');
      return;
    }

    // Validation: Minimal memilih 1 hari jika guru aktif sebagai pengawas
    if (active && availableDays.length === 0) {
      setFormError('Minimal memilih 1 hari ketersediaan jika status aktif sebagai pengawas ujian');
      return;
    }

    setSubmitting(true);
    try {
      const codeVal = invigilatorCode.trim() || null;
      if (editingId) {
        const res = await updateTeacher(editingId, {
          name: name.trim(),
          gender,
          employee_number: codeVal,
          invigilator_code: codeVal,
          active,
          available_days: availableDays,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Data Guru Diperbarui', `Informasi ${name} berhasil disimpan ke Supabase.`);
      } else {
        const res = await addTeacher({
          name: name.trim(),
          gender,
          employee_number: codeVal,
          invigilator_code: codeVal,
          active,
          available_days: availableDays,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Guru Baru Ditambahkan', `Guru ${name} berhasil didaftarkan ke Supabase.`);
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan data guru');
      toastError('Gagal Menyimpan Data Guru', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedTeacher) return;
    setSubmitting(true);
    try {
      const res = await deleteTeacher(selectedTeacher.id);
      if (!res.success) throw new Error(res.error);
      success('Guru Dihapus', `${selectedTeacher.name} telah dihapus dari database.`);
      setIsDeleteModalOpen(false);
      setSelectedTeacher(null);
    } catch (err: any) {
      toastError('Gagal Menghapus Guru', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportData = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (teachers.length === 0) {
      toastError('Tidak Ada Data', 'Belum ada data guru untuk diekspor.');
      return;
    }
    const exportRows = filteredTeachers.map((t, idx) => ({
      No: idx + 1,
      'Nama Lengkap': t.name,
      'NIP / Pegawai': t.employee_number || '-',
      'Jenis Kelamin': t.gender,
      'Hari Ketersediaan': (t.available_days || []).join(', '),
      Status: t.active ? 'Aktif' : 'Nonaktif',
      Catatan: t.notes || '-',
    }));
    exportToSpreadsheet(exportRows, 'Data_Guru_SMP_Bhinneka_Tunggal_Ika', format, 'Guru');
    success('Ekspor Berhasil', `Data ${exportRows.length} guru berhasil diekspor ke format ${format.toUpperCase()}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <PageHeader
        title="Data Guru & Pengawas"
        subtitle="Kelola master data dewan guru, nomor pegawai, jenis kelamin, dan hari ketersediaan menjaga ujian."
        badge={`${teachers.length} Guru`}
        badgeColor="blue"
        breadcrumbItems={[
          { label: 'Data Master' },
          { label: 'Data Guru' },
        ]}
        actions={[
          {
            label: 'Ekspor Excel',
            icon: <Download className="w-4 h-4" />,
            onClick: () => handleExportData('xlsx'),
            variant: 'outline',
          },
          ...(isAdmin
            ? [
                {
                  id: 'btn-import-teacher',
                  label: 'Import Data',
                  icon: <Upload className="w-4 h-4" />,
                  onClick: () => setIsImportModalOpen(true),
                  variant: 'outline' as const,
                },
                {
                  id: 'btn-add-teacher',
                  label: 'Tambah Guru',
                  icon: <Plus className="w-4 h-4" />,
                  onClick: handleOpenAdd,
                  variant: 'primary' as const,
                },
              ]
            : []),
        ]}
      />

      {/* Error state if data load fails */}
      {dataError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Error Database Supabase: {dataError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-teacher-input"
              type="text"
              placeholder="Cari nama guru, NIP, atau catatan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">JK:</span>
              <select
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Gender</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <span className="text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>

            {(searchTerm || genderFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setGenderFilter('ALL');
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Memuat data guru dari Supabase...</p>
          </div>
        ) : paginatedTeachers.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Guru"
            description={
              searchTerm || genderFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Tidak ditemukan guru yang cocok dengan kata kunci atau filter pencarian Anda.'
                : 'Belum ada guru yang terdaftar. Tambahkan guru baru atau impor dari file spreadsheet.'
            }
            icon={Users}
            actionLabel="Tambah Guru Baru"
            onAction={isAdmin ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Lengkap & Kode Pengawas</th>
                  <th className="py-3.5 px-4 w-28">Jenis Kelamin</th>
                  <th className="py-3.5 px-4 w-24">Status</th>
                  <th className="py-3.5 px-4">Hari Ketersediaan Pengawas</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 w-28 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTeachers.map((t, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                        {itemNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{t.name}</span>
                          {isPanitiaTeacher(t) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-md text-[10px] font-bold">
                              ⭐ Panitia (Standby)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-mono font-bold">
                            Kode: {t.invigilator_code || t.employee_number || `P${String(idx + 1).padStart(2, '0')}`}
                          </span>
                          {t.employee_number && t.employee_number !== t.invigilator_code && (
                            <span className="text-[10px] text-slate-400 font-mono">({t.employee_number})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            t.gender === 'Perempuan'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}
                        >
                          {t.gender}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            t.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {t.active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Aktif
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              Nonaktif
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isPanitiaTeacher(t) ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Tersedia Setiap Hari
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Siaga pengganti darurat
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {t.available_days && t.available_days.length > 0 ? (
                              t.available_days.map((day) => (
                                <span
                                  key={day}
                                  className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-medium"
                                >
                                  {day}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">-</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] max-w-xs truncate">
                        {isPanitiaTeacher(t) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-medium">
                            {t.notes}
                          </span>
                        ) : (
                          <span className="text-slate-500">{t.notes || '-'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(t)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Lihat Detail Profil & Jadwal"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(t)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Data Guru"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(t)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Guru"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>

      {/* Form Modal (Add / Edit Guru) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? 'Edit Data Guru' : 'Tambah Data Guru Baru'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Nama Lengkap */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Nama Lengkap & Gelar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Drs. H. Ahmad Sudrajat, M.Pd."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Kode Pengawas & Jenis Kelamin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Kode Pengawas
                </label>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                  Pengganti NIP
                </span>
              </div>
              <input
                type="text"
                placeholder="Contoh: P01, P02, P15"
                value={invigilatorCode}
                onChange={(e) => setInvigilatorCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Kode pengawas dicetak pada kartu pengawas & master jadwal.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Jenis Kelamin <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('Laki-laki')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    gender === 'Laki-laki'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Laki-laki
                </button>
                <button
                  type="button"
                  onClick={() => setGender('Perempuan')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    gender === 'Perempuan'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Perempuan
                </button>
              </div>
            </div>
          </div>

          {/* Status Aktif Switch */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800">Status Aktif Pengawas</span>
              <p className="text-[11px] text-slate-500">
                Apakah guru aktif bertugas dan dapat dijadwalkan mengawas ujian?
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Hari yang Bisa Menjadi Pengawas (MULTIPLE DAYS) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                Hari yang Bisa Menjadi Pengawas <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAllDays}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Pilih Semua
                </button>
                <span>&bull;</span>
                <button
                  type="button"
                  onClick={handleClearDays}
                  className="text-slate-500 hover:underline"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_DAYS.map((day) => {
                const isSelected = availableDays.includes(day);
                return (
                  <label
                    key={day}
                    onClick={() => handleToggleDay(day)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Data disimpan sebagai array PostgreSQL di Supabase. Minimal pilih 1 hari jika aktif.
            </p>
          </div>

          {/* Catatan & Penanda Panitia */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Catatan Khusus (Opsional)
              </label>
              <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Ketik &apos;Panitia&apos; untuk status siaga
              </span>
            </div>

            {/* Checkbox cepat status Panitia */}
            <label className="flex items-start gap-2.5 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors">
              <input
                type="checkbox"
                checked={notes.toLowerCase().includes('panitia')}
                onChange={(e) => {
                  if (e.target.checked) {
                    if (!notes.toLowerCase().includes('panitia')) {
                      setNotes(notes.trim() ? `${notes.trim()}, Panitia Ujian` : 'Panitia Ujian');
                    }
                  } else {
                    const cleaned = notes
                      .replace(/panitia ujian/gi, '')
                      .replace(/panitia/gi, '')
                      .replace(/^[,\s]+|[,\s]+$/g, '')
                      .trim();
                    setNotes(cleaned);
                  }
                }}
                className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="text-xs">
                <span className="font-bold text-amber-900 block">
                  ⭐ Tetapkan sebagai Panitia Ujian (Standby Pengganti Darurat)
                </span>
                <span className="text-[11px] text-amber-700 leading-relaxed block mt-0.5">
                  Jika catatan berisi kata <strong>&apos;Panitia&apos;</strong>, guru otomatis disiagakan setiap hari sebagai opsi guru pengganti jika ada pengawas yang mendadak izin, dan tidak akan mendapat jadwal pengawas rutin pasti.
                </span>
              </div>
            </label>

            <textarea
              rows={2}
              placeholder="Contoh: Panitia Ujian, Koordinator ruang, dll."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Guru'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <TeacherDetailModal
        teacher={selectedTeacher}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedTeacher(null);
        }}
        onEdit={isAdmin ? handleOpenEdit : undefined}
      />

      {/* Import Modal */}
      <TeacherImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedTeacher(null);
        }}
        title="Konfirmasi Hapus Guru"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Peringatan: Tindakan ini permanen!</span>
              <p className="mt-0.5">
                Guru <strong>{selectedTeacher?.name}</strong> akan dihapus dari sistem Supabase dan seluruh penugasan pengawas terkait akan dikosongkan.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Menghapus...' : 'Ya, Hapus Guru'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
