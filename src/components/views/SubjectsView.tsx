import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  BookOpen,
  Filter,
  Download,
  Upload,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  GraduationCap,
  ShieldAlert,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Subject } from '../../types/database';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { PageHeader } from '../common/PageHeader';
import { Pagination } from '../common/Pagination';
import { SubjectImportModal } from '../subjects/SubjectImportModal';
import { exportToSpreadsheet } from '../../lib/excelHelper';

export const SubjectsView: React.FC = () => {
  const { subjects, examSchedules, addSubject, updateSubject, deleteSubject, loading, error: dataError } = useData();
  const { role } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = role === 'ADMIN';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gradeLevels, setGradeLevels] = useState<string[]>(['7', '8', '9']);
  const [defaultDuration, setDefaultDuration] = useState<number>(90);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtered
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      const sGrades = s.grade_levels && s.grade_levels.length > 0 
        ? s.grade_levels 
        : s.grade_level ? [String(s.grade_level)] : ['7', '8', '9'];

      const matchesGrade =
        gradeFilter === 'ALL' ||
        (gradeFilter === 'NONE'
          ? (!s.grade_levels || s.grade_levels.length === 0) && !s.grade_level
          : sGrades.includes(gradeFilter));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'active' ? s.active !== false : s.active === false);

      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [subjects, searchTerm, gradeFilter, statusFilter]);

  // Pagination
  const totalItems = filteredSubjects.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedSubjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSubjects.slice(start, start + pageSize);
  }, [filteredSubjects, currentPage, pageSize]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setGradeLevels(['7', '8', '9']);
    setDefaultDuration(90);
    setActive(true);
    setNotes('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (s: Subject) => {
    setEditingId(s.id);
    setCode(s.code);
    setName(s.name);
    const initialGrades = s.grade_levels && s.grade_levels.length > 0
      ? s.grade_levels
      : s.grade_level ? [String(s.grade_level)] : ['7', '8', '9'];
    setGradeLevels(initialGrades);
    setDefaultDuration(s.default_duration || 90);
    setActive(s.active !== false);
    setNotes(s.notes || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleToggleGrade = (grade: string) => {
    setGradeLevels((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade].sort()
    );
  };

  const handleSelectAllGrades = () => {
    setGradeLevels(['7', '8', '9']);
  };

  const handleOpenDetail = (s: Subject) => {
    setSelectedSubject(s);
    setIsDetailModalOpen(true);
  };

  const handleOpenDelete = (s: Subject) => {
    setSelectedSubject(s);
    setIsDeleteModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !code.trim()) {
      setFormError('Nama dan kode mata pelajaran wajib diisi');
      return;
    }

    // Check duplicate code
    const duplicate = subjects.find(
      (s) => s.code.toUpperCase() === code.trim().toUpperCase() && s.id !== editingId
    );
    if (duplicate) {
      setFormError(`Kode mata pelajaran "${code.toUpperCase()}" sudah digunakan oleh ${duplicate.name}`);
      return;
    }

    setSubmitting(true);
    try {
      const primaryGrade = gradeLevels.length > 0 ? parseInt(gradeLevels[0]) : null;
      if (editingId) {
        const res = await updateSubject(editingId, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          grade_level: primaryGrade,
          grade_levels: gradeLevels,
          default_duration: defaultDuration,
          active,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Mata Pelajaran Diperbarui', `${name} berhasil disimpan.`);
      } else {
        const res = await addSubject({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          grade_level: primaryGrade,
          grade_levels: gradeLevels,
          default_duration: defaultDuration,
          active,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Mata Pelajaran Ditambahkan', `${name} (${code.toUpperCase()}) berhasil didaftarkan.`);
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan mata pelajaran');
      toastError('Gagal Menyimpan Mapel', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedSubject) return;
    setSubmitting(true);
    try {
      const res = await deleteSubject(selectedSubject.id);
      if (!res.success) throw new Error(res.error);
      success('Mata Pelajaran Dihapus', `${selectedSubject.name} telah dihapus.`);
      setIsDeleteModalOpen(false);
      setSelectedSubject(null);
    } catch (err: any) {
      toastError('Gagal Menghapus Mapel', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportData = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (subjects.length === 0) {
      toastError('Tidak Ada Data', 'Belum ada data mata pelajaran untuk diekspor.');
      return;
    }
    const rows = filteredSubjects.map((s, idx) => ({
      No: idx + 1,
      'Kode Mapel': s.code,
      'Nama Mata Pelajaran': s.name,
      Tingkat: s.grade_level ? `Kelas ${s.grade_level}` : 'Semua Tingkat',
      'Durasi Ujian': `${s.default_duration || 90} Menit`,
      Status: s.active !== false ? 'Aktif' : 'Nonaktif',
      Catatan: s.notes || '-',
    }));
    exportToSpreadsheet(rows, 'Data_Mata_Pelajaran_SMP_Bhinneka_Tunggal_Ika', format, 'Mapel');
    success('Ekspor Berhasil', `Data ${rows.length} mata pelajaran berhasil diekspor.`);
  };

  const linkedExamCount = useMemo(() => {
    if (!selectedSubject) return 0;
    return examSchedules.filter((es) => es.subject_id === selectedSubject.id).length;
  }, [selectedSubject, examSchedules]);

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <PageHeader
        title="Mata Pelajaran"
        subtitle="Daftar mata uji ujian sekolah, kode mapel, tingkat kelas, durasi standar, dan status aktif."
        badge={`${subjects.length} Mapel`}
        badgeColor="purple"
        breadcrumbItems={[
          { label: 'Data Master' },
          { label: 'Mata Pelajaran' },
        ]}
        actions={[
          {
            label: 'Ekspor Data',
            icon: <Download className="w-4 h-4" />,
            onClick: () => handleExportData('xlsx'),
            variant: 'outline',
          },
          ...(isAdmin
            ? [
                {
                  id: 'btn-import-subject',
                  label: 'Import Mapel',
                  icon: <Upload className="w-4 h-4" />,
                  onClick: () => setIsImportModalOpen(true),
                  variant: 'outline' as const,
                },
                {
                  id: 'btn-add-subject',
                  label: 'Tambah Mapel',
                  icon: <Plus className="w-4 h-4" />,
                  onClick: handleOpenAdd,
                  variant: 'primary' as const,
                },
              ]
            : []),
        ]}
      />

      {dataError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Error Database: {dataError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama mapel, kode mapel, atau catatan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Tingkat:</span>
              <select
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Tingkat</option>
                <option value="7">Kelas 7</option>
                <option value="8">Kelas 8</option>
                <option value="9">Kelas 9</option>
                <option value="NONE">Tanpa Tingkat Spesifik</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
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

            {(searchTerm || gradeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setGradeFilter('ALL');
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

      {/* Main Subjects Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Memuat data mata pelajaran dari database...</p>
          </div>
        ) : paginatedSubjects.length === 0 ? (
          <EmptyState
            title="Tidak Ada Mata Pelajaran"
            description={
              searchTerm || gradeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Tidak ada mata pelajaran yang cocok dengan filter pencarian Anda.'
                : 'Belum ada mata pelajaran terdaftar. Tambahkan manual atau gunakan Import Mapel.'
            }
            icon={BookOpen}
            actionLabel="Tambah Mapel Baru"
            onAction={isAdmin ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-28">Kode Mapel</th>
                  <th className="py-3.5 px-4">Nama Mata Pelajaran</th>
                  <th className="py-3.5 px-4 w-28 text-center">Tingkat</th>
                  <th className="py-3.5 px-4 w-32 text-center">Durasi Default</th>
                  <th className="py-3.5 px-4 w-24 text-center">Status</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 w-28 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSubjects.map((s, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  const isActive = s.active !== false;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                        {itemNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 font-mono font-bold text-slate-800 rounded-lg border border-slate-200">
                          {s.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.name}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(() => {
                          const grades = s.grade_levels && s.grade_levels.length > 0
                            ? s.grade_levels
                            : s.grade_level ? [String(s.grade_level)] : ['7', '8', '9'];
                          if (grades.length >= 3) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-100">
                                <GraduationCap className="w-3 h-3" />
                                Kelas 7, 8, 9
                              </span>
                            );
                          }
                          return (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {grades.map((g) => (
                                <span
                                  key={g}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200"
                                >
                                  Kls {g}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {s.default_duration || 90} Menit
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {isActive ? (
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
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {s.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(s)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Detail Mapel"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(s)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Mapel"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(s)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Mapel"
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
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      {/* Form Modal (Add/Edit) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Kode Mapel <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: BIND, MTK, IPA"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono uppercase focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Tingkat Kelas (Multi-pilihan)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllGrades}
                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                >
                  Semua (7, 8, 9)
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {['7', '8', '9'].map((gr) => {
                  const isSel = gradeLevels.includes(gr);
                  return (
                    <button
                      key={gr}
                      type="button"
                      onClick={() => handleToggleGrade(gr)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        isSel
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Kelas {gr}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Bisa dipilih lebih dari 1 tingkat kelas sekaligus.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Nama Mata Pelajaran <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Bahasa Indonesia, Matematika, IPA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Durasi Ujian Standar (Menit) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={15}
                max={240}
                step={5}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 90)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Umumnya: 90 atau 120 menit</p>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">Status Aktif Mapel</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Catatan Mata Pelajaran (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Menggunakan lembar jawaban komputer (LJK) atau daring CBT"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

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
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Mapel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSubject(null);
        }}
        title="Detail Mata Pelajaran"
        maxWidth="md"
      >
        {selectedSubject && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">{selectedSubject.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-200 font-mono text-xs font-bold text-slate-800 rounded">
                    {selectedSubject.code}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      selectedSubject.active !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {selectedSubject.active !== false ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-600">
                    {selectedSubject.grade_level ? `Kelas ${selectedSubject.grade_level}` : 'Semua Tingkat'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Durasi Ujian Default:</span>
                <span className="font-semibold text-slate-800">
                  {selectedSubject.default_duration || 90} Menit
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Jadwal Ujian Terkait:</span>
                <span className="font-semibold text-blue-600">
                  {examSchedules.filter((es) => es.subject_id === selectedSubject.id).length} Sesi Ujian
                </span>
              </div>
              <div className="py-1">
                <span className="text-slate-500 block mb-1">Catatan:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {selectedSubject.notes || 'Tidak ada catatan.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEdit(selectedSubject);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Edit Mapel
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Import Modal */}
      <SubjectImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedSubject(null);
        }}
        title="Konfirmasi Hapus Mata Pelajaran"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Peringatan Penghapusan Mata Pelajaran!</span>
              <p className="mt-0.5">
                Mata pelajaran <strong>{selectedSubject?.name}</strong> akan dihapus dari sistem.
                {linkedExamCount > 0 && (
                  <span className="block mt-1 font-semibold text-rose-900">
                    Perhatian: {linkedExamCount} jadwal ujian terkait juga akan dibatalkan/dihapus.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
            >
              {submitting ? 'Menghapus...' : 'Ya, Hapus Mapel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
