import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  Eye,
  Download,
  MapPin,
  FileText,
  DoorOpen,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Building } from '../../types/database';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { PageHeader } from '../common/PageHeader';
import { Pagination } from '../common/Pagination';
import { exportToSpreadsheet } from '../../lib/excelHelper';

export const BuildingsView: React.FC = () => {
  const { buildings, rooms, addBuilding, updateBuilding, deleteBuilding, loading, error: dataError } = useData();
  const { role } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin = role === 'ADMIN';

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtered
  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      const q = searchTerm.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.address && b.address.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    });
  }, [buildings, searchTerm]);

  // Pagination
  const totalItems = filteredBuildings.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedBuildings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBuildings.slice(start, start + pageSize);
  }, [filteredBuildings, currentPage, pageSize]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setAddress('');
    setNotes('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (b: Building) => {
    setEditingId(b.id);
    setCode(b.code);
    setName(b.name);
    setAddress(b.address || '');
    setNotes(b.notes || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (b: Building) => {
    setSelectedBuilding(b);
    setIsDetailModalOpen(true);
  };

  const handleOpenDelete = (b: Building) => {
    setSelectedBuilding(b);
    setIsDeleteModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !code.trim()) {
      setFormError('Nama gedung dan kode gedung wajib diisi');
      return;
    }

    // Check duplicate code
    const duplicateCode = buildings.find(
      (b) => b.code.toUpperCase() === code.trim().toUpperCase() && b.id !== editingId
    );
    if (duplicateCode) {
      setFormError(`Kode gedung "${code.toUpperCase()}" sudah digunakan oleh gedung ${duplicateCode.name}`);
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const res = await updateBuilding(editingId, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          address: address.trim() || null,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Gedung Diperbarui', `Informasi gedung ${name} berhasil disimpan.`);
      } else {
        const res = await addBuilding({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          address: address.trim() || null,
          notes: notes.trim() || null,
        });
        if (!res.success) throw new Error(res.error);
        success('Gedung Baru Ditambahkan', `Gedung ${name} (${code.toUpperCase()}) berhasil ditambahkan.`);
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan gedung');
      toastError('Gagal Menyimpan Gedung', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedBuilding) return;
    setSubmitting(true);
    try {
      const res = await deleteBuilding(selectedBuilding.id);
      if (!res.success) throw new Error(res.error);
      success('Gedung Dihapus', `Gedung ${selectedBuilding.name} telah dihapus.`);
      setIsDeleteModalOpen(false);
      setSelectedBuilding(null);
    } catch (err: any) {
      toastError('Gagal Menghapus Gedung', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportData = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (buildings.length === 0) {
      toastError('Tidak Ada Data', 'Belum ada data gedung untuk diekspor.');
      return;
    }
    const rows = filteredBuildings.map((b, idx) => {
      const buildingRooms = rooms.filter((r) => r.building_id === b.id);
      return {
        No: idx + 1,
        'Kode Gedung': b.code,
        'Nama Gedung': b.name,
        'Jumlah Ruang': buildingRooms.length,
        'Total Kapasitas': buildingRooms.reduce((acc, r) => acc + (r.capacity || 0), 0),
        Alamat: b.address || '-',
        Catatan: b.notes || '-',
      };
    });
    exportToSpreadsheet(rows, 'Data_Gedung_SMP_Bhinneka_Tunggal_Ika', format, 'Gedung');
    success('Ekspor Berhasil', `Data gedung berhasil diekspor ke format ${format.toUpperCase()}.`);
  };

  // Rooms belonging to selected building in detail modal
  const selectedBuildingRooms = useMemo(() => {
    if (!selectedBuilding) return [];
    return rooms.filter((r) => r.building_id === selectedBuilding.id);
  }, [selectedBuilding, rooms]);

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumbs */}
      <PageHeader
        title="Data Gedung Sekolah"
        subtitle="Kelola data gedung dan fasilitas lokasi ruang ujian di lingkungan SMP Bhinneka Tunggal Ika."
        badge={`${buildings.length} Gedung`}
        badgeColor="indigo"
        breadcrumbItems={[
          { label: 'Data Master' },
          { label: 'Gedung' },
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
                  id: 'btn-add-building',
                  label: 'Tambah Gedung',
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

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama gedung, kode, atau alamat..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
          />
        </div>
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setCurrentPage(1);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Buildings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Memuat data gedung dari database...</p>
          </div>
        ) : paginatedBuildings.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Gedung"
            description={
              searchTerm
                ? 'Tidak ada gedung yang sesuai dengan pencarian Anda.'
                : 'Belum ada gedung sekolah yang terdaftar. Tambahkan gedung pertama Anda.'
            }
            icon={Building2}
            actionLabel="Tambah Gedung Baru"
            onAction={isAdmin ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-28">Kode Gedung</th>
                  <th className="py-3.5 px-4">Nama Gedung</th>
                  <th className="py-3.5 px-4 w-32">Kapasitas Ruang</th>
                  <th className="py-3.5 px-4">Alamat / Lokasi</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 w-28 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBuildings.map((b, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  const buildingRooms = rooms.filter((r) => r.building_id === b.id);
                  const totalCapacity = buildingRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                        {itemNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 font-mono font-bold text-slate-800 rounded-lg border border-slate-200">
                          {b.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-100">
                            <DoorOpen className="w-3 h-3" />
                            {buildingRooms.length} Ruang
                          </span>
                          {totalCapacity > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-100">
                              <Users className="w-3 h-3" />
                              {totalCapacity} Kursi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {b.address || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {b.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(b)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Lihat Daftar Ruang"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(b)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Gedung"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(b)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus Gedung"
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

      {/* Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? 'Edit Gedung' : 'Tambah Gedung Baru'}
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
                Kode Gedung <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: G-A, GD-UTAMA"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Nama Gedung <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Gedung A (Barat)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Alamat / Posisi Lokasi (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Sayap Kiri Lantai 1-2, Dekat Lapangan Upacara"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Catatan Fasilitas (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Memiliki 15 ruang kelas ber-AC dan proyektor"
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
              {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Gedung'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBuilding(null);
        }}
        title="Detail Inventaris Gedung"
        maxWidth="2xl"
      >
        {selectedBuilding && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{selectedBuilding.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-200 font-mono text-xs font-bold text-slate-800 rounded">
                    {selectedBuilding.code}
                  </span>
                </div>
                {selectedBuilding.address && (
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedBuilding.address}
                  </p>
                )}
                {selectedBuilding.notes && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    {selectedBuilding.notes}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Daftar Ruang di Gedung Ini ({selectedBuildingRooms.length} Ruang)
                </h4>
              </div>

              {selectedBuildingRooms.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  Belum ada ruang yang dialokasikan di gedung ini. Anda dapat menambahkan atau generate ruang di menu Data Ruang.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedBuildingRooms.map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">{r.name}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px] text-slate-600">
                          {r.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>Kapasitas: {r.capacity}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] ${
                            r.active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                          }`}
                        >
                          {r.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Tutup
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEdit(selectedBuilding);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                >
                  Edit Gedung
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedBuilding(null);
        }}
        title="Konfirmasi Hapus Gedung"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Peringatan Penghapusan Gedung!</span>
              <p className="mt-0.5">
                Gedung <strong>{selectedBuilding?.name}</strong> akan dihapus. Jika terdapat ruang di gedung ini, ruang-ruang tersebut juga akan terhapus.
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
              {submitting ? 'Menghapus...' : 'Ya, Hapus Gedung'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
