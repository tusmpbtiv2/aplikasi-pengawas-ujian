import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Sparkles, Layers, ShieldAlert, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';

interface RoomGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoomGenerateModal: React.FC<RoomGenerateModalProps> = ({ isOpen, onClose }) => {
  const { buildings, rooms, addRoomsBatch } = useData();
  const { success, error, warning } = useToast();

  const [buildingId, setBuildingId] = useState(buildings[0]?.id || '');
  const [prefix, setPrefix] = useState('Ruang');
  const [codePrefix, setCodePrefix] = useState('R-');
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(20);
  const [capacity, setCapacity] = useState(30);
  const [active, setActive] = useState(true);
  const [zeroPad, setZeroPad] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Generate preview
  const generatedList = React.useMemo(() => {
    if (startNum <= 0 || endNum < startNum) return [];
    const count = endNum - startNum + 1;
    if (count > 200) return []; // safety limit for single batch

    const padLength = endNum >= 100 ? 3 : 2;

    const list = [];
    for (let i = startNum; i <= endNum; i++) {
      const numStr = zeroPad ? String(i).padStart(padLength, '0') : String(i);
      const roomName = `${prefix.trim()} ${numStr}`.trim();
      const roomCode = `${codePrefix.trim()}${numStr}`.toUpperCase().trim();

      // Check if code already exists in db
      const alreadyExists = rooms.some((r) => r.code.toUpperCase() === roomCode);

      list.push({
        name: roomName,
        code: roomCode,
        capacity,
        active,
        alreadyExists,
      });
    }
    return list;
  }, [startNum, endNum, prefix, codePrefix, capacity, active, zeroPad, rooms]);

  const duplicateCount = generatedList.filter((r) => r.alreadyExists).length;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!buildingId) {
      setFormError('Pilih gedung lokasi ruang terlebih dahulu.');
      return;
    }

    if (startNum <= 0 || endNum < startNum) {
      setFormError('Nomor awal harus lebih kecil atau sama dengan nomor akhir.');
      return;
    }

    const count = endNum - startNum + 1;
    if (count > 200) {
      setFormError('Batas maksimum sekali generate adalah 200 ruang untuk performa optimal.');
      return;
    }

    const toInsert = generatedList.filter((r) => !r.alreadyExists);
    if (toInsert.length === 0) {
      warning('Semua Ruang Sudah Terdaftar', 'Semua kode ruang yang di-generate sudah ada di database.');
      return;
    }

    setSubmitting(true);
    try {
      const payloads = toInsert.map((item) => ({
        building_id: buildingId,
        code: item.code,
        name: item.name,
        capacity: item.capacity,
        active: item.active,
        notes: `Digenerate otomatis (${new Date().toLocaleDateString('id-ID')})`,
      }));

      const res = await addRoomsBatch(payloads);
      if (!res.success) throw new Error(res.error);

      success(
        'Generate Ruang Berhasil!',
        `Berhasil membuat ${res.count} ruang ujian baru di gedung yang dipilih.`
      );
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Gagal membuat ruang');
      error('Gagal Generate Ruang', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBuilding = buildings.find((b) => b.id === buildingId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Ruang Ujian Otomatis" maxWidth="2xl">
      <form onSubmit={handleGenerate} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Fitur ini membuat penomoran ruang secara berurutan dan cepat untuk panitia ujian.
          </span>
        </div>

        {/* Building selector */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Gedung Lokasi Ruang <span className="text-rose-500">*</span>
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
          {buildings.length === 0 && (
            <p className="text-[11px] text-rose-500 mt-1">
              Belum ada data gedung. Buat gedung terlebih dahulu di menu Gedung.
            </p>
          )}
        </div>

        {/* Prefix & Code Prefix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Prefix Nama Ruang
            </label>
            <input
              type="text"
              placeholder="Contoh: Ruang"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Hasil: "{prefix} 01", "{prefix} 02"...</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Prefix Kode Ruang
            </label>
            <input
              type="text"
              placeholder="Contoh: R- atau U-"
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono uppercase focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">Hasil: "{codePrefix}01", "{codePrefix}02"...</p>
          </div>
        </div>

        {/* Range and Capacity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Nomor Awal <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={startNum}
              onChange={(e) => setStartNum(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Nomor Akhir <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={startNum}
              value={endNum}
              onChange={(e) => setEndNum(parseInt(e.target.value) || startNum)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Kapasitas Default (Kursi)
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
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={zeroPad}
              onChange={(e) => setZeroPad(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Gunakan angka 0 di depan (contoh: 01, 02)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Set Status Langsung Aktif</span>
          </label>
        </div>

        {/* Live Preview List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Preview Ruang ({generatedList.length} Ruang Dihasilkan)
            </label>
            {duplicateCount > 0 && (
              <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {duplicateCount} kode sudah ada (akan dilewati)
              </span>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-2.5 max-h-44 overflow-y-auto bg-slate-50/50">
            {generatedList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Rentang nomor tidak valid. Masukkan nomor awal dan akhir yang benar.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {generatedList.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                      item.alreadyExists
                        ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{item.code}</div>
                    </div>
                    {item.alreadyExists ? (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
                        Ada
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{item.capacity} kursi</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || generatedList.length === 0 || buildings.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {submitting ? 'Membuat...' : `Generate ${generatedList.length - duplicateCount} Ruang`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
