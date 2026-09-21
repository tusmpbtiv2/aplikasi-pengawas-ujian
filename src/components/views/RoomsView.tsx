import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  DoorOpen,
  Filter,
  Sparkles,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Room } from '../../types/database';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { PageHeader } from '../common/PageHeader';
import { Pagination } from '../common/Pagination';
import { RoomGenerateModal } from '../rooms/RoomGenerateModal';
import { RoomImportModal } from '../rooms/RoomImportModal';
import { exportToSpreadsheet } from '../../lib/excelHelper';

export const RoomsView: React.FC = () => {
  const { rooms, buildings, addRoom, updateRoom, deleteRoom, loading, error: dataError } = useData();
  const { role } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = role === 'ADMIN';

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [buildingId, setBuildingId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const q = searchTerm.toLowerCase();
      const bName = buildings.find((b) => b.id === r.building_id)?.name.toLowerCase() || '';

      const matchesSearch =
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        bName.includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      const matchesBuilding = buildingFilter === 'ALL' || r.building_id === buildingFilter;
      const matchesStatus =
        statusFilter === 'ALL' || (statusFilter === 'active' ? r.active : !r.active);

      return matchesSearch && matchesBuilding && matchesStatus;
    });
  }, [rooms, buildings, searchTerm, buildingFilter, statusFilter]);

  // Pagination calculations
  const totalItems = filteredRooms.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, currentPage, pageSize]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setBuildingId(buildings[0]?.id || '');
    setCode('');
    setName('');
    setCapacity(30);
    setActive(true);
    setNotes('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (r: Room) => {
    setEditingId(r.id);
    setBuildingId(r.building_id);
    setCode(r.code);
    setName(r.name);
    setCapacity(r.capacity);
    setActive(r.active);
    setNotes(r.notes || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (r: Room) => {
    setSelectedRoom(r);
    setIsDetailModalOpen(true);
  };

  const handleOpenDelete = (r: Room) => {
    setSelectedRoom(r);
    setIsDeleteModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!buildingId) {
      setFormError('Pilih gedung terlebih dahulu');
      return;
    }
    if (!name.trim() || !code.trim()) {
      setFormError('Nama dan kode ruang wajib diisi');
      return;
    }

    // Check duplicate code
    const duplicate = rooms.find(
      (r) => r.code.toUpperCase() === code.trim().toUpperCase() && r.id !== editingId
    );
    if (duplicate) {
      setFormError(`Kode ruang "${code.toUpperCase()}" sudah digunakan oleh ${duplicate.name}`);
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const res = await updateRoom(editingId, {
          building_id: buildingId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          capacity,
          active,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Ruang Diperbarui', `Informasi ${name} berhasil disimpan.`);
      } else {
        const res = await addRoom({
          building_id: buildingId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          capacity,
          active,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Ruang Baru Ditambahkan', `${name} (${code.toUpperCase()}) berhasil didaftarkan.`);
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan ruang');
      toastError('Gagal Menyimpan Ruang', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return;
    setSubmitting(true);
    try {
      const res = await deleteRoom(selectedRoom.id);
      if (!res.success) throw new Error(res.error);
      success('Ruang Dihapus', `Ruang ${selectedRoom.name} telah dihapus.`);
      setIsDeleteModalOpen(false);
      setSelectedRoom(null);
    } catch (err: any) {
      toastError('Gagal Menghapus Ruang', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportData = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (rooms.length === 0) {
      toastError('Tidak Ada Data', 'Belum ada data ruang untuk diekspor.');
      return;
    }
    const rows = filteredRooms.map((r, idx) => {
      const b = buildings.find((x) => x.id === r.building_id);
      return {
        No: idx + 1,
        'Kode Ruang': r.code,
        'Nama Ruang': r.name,
        Gedung: b ? `${b.name} (${b.code})` : '-',
        Kapasitas: r.capacity,
        Status: r.active ? 'Aktif' : 'Nonaktif',
        Catatan: r.notes || '-',
      };
    });
    exportToSpreadsheet(rows, 'Data_Ruang_Ujian_SMP_Bhinneka_Tunggal_Ika', format, 'Ruang');
    success('Ekspor Berhasil', `Data ${rows.length} ruang berhasil diekspor ke format ${format.toUpperCase()}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
      <PageHeader
        title="Data Ruang Ujian"
        subtitle="Kelola master data ruang ujian, kode, gedung alokasi, kapasitas kursi, serta batch generator ruang."
        badge={`${rooms.length} Ruang`}
        badgeColor="emerald"
        breadcrumbItems={[
          { label: 'Data Master' },
          { label: 'Ruang' },
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
                  id: 'btn-import-room',
                  label: 'Import Ruang',
                  icon: <Upload className="w-4 h-4" />,
                  onClick: () => setIsImportModalOpen(true),
                  variant: 'outline' as const,
                },
                {
                  id: 'btn-generate-room',
                  label: 'Generate Ruang',
                  icon: <Sparkles className="w-4 h-4" />,
                  onClick: () => setIsGenerateModalOpen(true),
                  variant: 'outline' as const,
                },
                {
                  id: 'btn-add-room',
                  label: 'Tambah Ruang',
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
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama ruang, kode ruang, gedung, atau catatan..."
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
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Gedung:</span>
              <select
                value={buildingFilter}
                onChange={(e) => {
                  setBuildingFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Gedung</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
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

            {(searchTerm || buildingFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setBuildingFilter('ALL');
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

      {/* Main Rooms Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Memuat data ruang ujian dari database...</p>
          </div>
        ) : paginatedRooms.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Ruang"
            description={
              searchTerm || buildingFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Tidak ada ruang ujian yang sesuai dengan kriteria filter Anda.'
                : 'Belum ada ruang ujian yang terdaftar. Tambahkan manual atau gunakan fitur Generate Ruang.'
            }
            icon={DoorOpen}
            actionLabel="Tambah Ruang Baru"
            onAction={isAdmin ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-28">Kode Ruang</th>
                  <th className="py-3.5 px-4">Nama Ruang</th>
                  <th className="py-3.5 px-4">Gedung Lokasi</th>
                  <th className="py-3.5 px-4 w-28 text-center">Kapasitas</th>
                  <th className="py-3.5 px-4 w-24 text-center">Status</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 w-28 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRooms.map((r, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  const b = buildings.find((x) => x.id === r.building_id);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                        {itemNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 font-mono font-bold text-slate-800 rounded-lg border border-slate-200">
                          {r.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-[11px]">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {b ? b.name : 'Gedung tidak ditemukan'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-100">
                          <Users className="w-3 h-3" />
                          {r.capacity} Kursi
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            r.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {r.active ? (
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
                        {r.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(r)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Detail Ruang"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(r)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Ruang"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(r)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Ruang"
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

      {/* Form Modal (Add / Edit) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? 'Edit Ruang Ujian' : 'Tambah Ruang Ujian Baru'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Gedung Lokasi <span className="text-rose-500">*</span>
            </label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Kode Ruang <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: R-01, 7A"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono uppercase focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Nama Ruang <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Ruang 01"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Kapasitas Kursi Siswa <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">Status Aktif</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Catatan Fasilitas / Posisi (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Meja 15 baris ganda, AC berfungsi, dekat toilet lantai 2"
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
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Ruang'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRoom(null);
        }}
        title="Detail Ruang Ujian"
        maxWidth="md"
      >
        {selectedRoom && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <DoorOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">{selectedRoom.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-200 font-mono text-xs font-bold text-slate-800 rounded">
                    {selectedRoom.code}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      selectedRoom.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {selectedRoom.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-600">{selectedRoom.capacity} Kursi</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Gedung:</span>
                <span className="font-semibold text-slate-800">
                  {buildings.find((b) => b.id === selectedRoom.building_id)?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Kapasitas Maksimal:</span>
                <span className="font-semibold text-slate-800">{selectedRoom.capacity} Peserta Ujian</span>
              </div>
              <div className="py-1">
                <span className="text-slate-500 block mb-1">Catatan Ruang:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {selectedRoom.notes || 'Tidak ada catatan.'}
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
                    handleOpenEdit(selectedRoom);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                >
                  Edit Ruang
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Generate Ruang Modal */}
      <RoomGenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
      />

      {/* Import Ruang Modal */}
      <RoomImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedRoom(null);
        }}
        title="Konfirmasi Hapus Ruang"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Peringatan Penghapusan Ruang Ujian!</span>
              <p className="mt-0.5">
                Ruang <strong>{selectedRoom?.name}</strong> ({selectedRoom?.code}) akan dihapus dari sistem. Seluruh jadwal pengawas di ruang ini akan dibatalkan.
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
              {submitting ? 'Menghapus...' : 'Ya, Hapus Ruang'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
