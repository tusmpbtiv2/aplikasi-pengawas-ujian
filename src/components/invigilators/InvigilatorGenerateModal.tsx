import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  RotateCcw,
  Check,
  Building2,
  DoorOpen,
  Info,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  runAutoScheduler,
  GenerateConfig,
  GenerationResult,
} from '../../lib/invigilatorHelper';
import { formatIndonesianDate } from '../../lib/scheduleHelper';

interface InvigilatorGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InvigilatorGenerateModal: React.FC<InvigilatorGenerateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    examSchedules,
    rooms,
    teachers,
    buildings,
    subjects,
    invigilatorSchedules,
    settings,
    addInvigilatorSchedulesBatch,
  } = useData();

  const { success: toastSuccess, error: toastError } = useToast();

  const invigilatorsPerRoom = settings?.default_invigilators_per_room || 2;

  // Step: 'config' | 'preview'
  const [step, setStep] = useState<'config' | 'preview'>('config');

  // Config form state
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('ALL');
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');

  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [respectAvailability, setRespectAvailability] = useState<boolean>(true);
  const [balanceWorkload, setBalanceWorkload] = useState<boolean>(true);
  const [avoidConsecutiveSameRoom, setAvoidConsecutiveSameRoom] = useState<boolean>(false);
  const [noBuildingHopping, setNoBuildingHopping] = useState<boolean>(true);
  const [consistentSessionsSameRoom, setConsistentSessionsSameRoom] = useState<boolean>(true);
  const [assignReserve, setAssignReserve] = useState<boolean>(false);
  const [reserveCount, setReserveCount] = useState<number>(1);

  // Preview result state
  const [previewResult, setPreviewResult] = useState<GenerationResult | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Derived options
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  const uniqueSessions = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.session))).sort();
  }, [examSchedules]);

  // Target exam schedule IDs based on filters
  const targetExamIds = useMemo(() => {
    return examSchedules
      .filter((es) => {
        const matchDate = selectedDateFilter === 'ALL' || es.exam_date === selectedDateFilter;
        const matchSession = selectedSessionFilter === 'ALL' || es.session === selectedSessionFilter;
        return matchDate && matchSession;
      })
      .map((es) => es.id);
  }, [examSchedules, selectedDateFilter, selectedSessionFilter]);

  // Target room IDs based on building & room filters
  const targetRoomIds = useMemo(() => {
    return rooms
      .filter((r) => r.active)
      .filter((r) => {
        const matchBuilding = selectedBuildingFilter === 'ALL' || r.building_id === selectedBuildingFilter;
        const matchRoom = selectedRoomFilter === 'ALL' || r.id === selectedRoomFilter;
        return matchBuilding && matchRoom;
      })
      .map((r) => r.id);
  }, [rooms, selectedBuildingFilter, selectedRoomFilter]);

  // Build config object
  const buildConfig = (): GenerateConfig => {
    return {
      examScheduleIds: targetExamIds.length === examSchedules.length ? ['ALL'] : targetExamIds,
      buildingIds: selectedBuildingFilter === 'ALL' ? ['ALL'] : [selectedBuildingFilter],
      roomIds: selectedRoomFilter === 'ALL' ? ['ALL'] : [selectedRoomFilter],
      overwriteExisting,
      respectAvailability,
      balanceWorkload,
      avoidConsecutiveSameRoom,
      noBuildingHopping,
      consistentSessionsSameRoom,
      assignReserve,
      reserveCountPerSession: reserveCount,
    };
  };

  const handlePreview = () => {
    if (targetExamIds.length === 0) {
      toastError('Tidak ada jadwal ujian yang sesuai dengan filter yang dipilih.');
      return;
    }
    if (targetRoomIds.length === 0) {
      toastError('Tidak ada ruangan aktif yang sesuai dengan filter yang dipilih.');
      return;
    }

    const config = buildConfig();
    const result = runAutoScheduler(
      examSchedules,
      rooms,
      teachers,
      invigilatorSchedules,
      config,
      invigilatorsPerRoom
    );

    setPreviewResult(result);
    setStep('preview');
  };

  const handleApply = async () => {
    let result = previewResult;
    if (!result) {
      const config = buildConfig();
      result = runAutoScheduler(
        examSchedules,
        rooms,
        teachers,
        invigilatorSchedules,
        config,
        invigilatorsPerRoom
      );
    }

    if (result.newAssignments.length === 0) {
      toastError('Tidak ada jadwal pengawas yang dapat dibuat.');
      return;
    }

    setSaving(true);
    try {
      const res = await addInvigilatorSchedulesBatch(result.newAssignments, {
        overwriteExisting,
        examScheduleIds: targetExamIds,
        roomIds: targetRoomIds,
      });

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan jadwal pengawas');
      }

      toastSuccess(
        `Berhasil menugaskan ${result.totalAssigned} pengawas di ${result.totalSessions} sesi ujian!`
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan jadwal';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleResetModal = () => {
    setStep('config');
    setPreviewResult(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Penjadwalan Otomatis Pengawas Ujian"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('config')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                step === 'config'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Konfigurasi Parameter</span>
            </button>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <button
              disabled={!previewResult}
              onClick={() => previewResult && setStep('preview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                step === 'preview'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-400 disabled:opacity-50'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span>Preview & Validasi Distribusi</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 hidden sm:inline-block">
            {invigilatorsPerRoom} Pengawas per Ruangan (Sesuai Pengaturan)
          </span>
        </div>

        {/* STEP 1: CONFIGURATION */}
        {step === 'config' && (
          <div className="space-y-5">
            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Sistem akan membagi guru aktif sebagai pengawas secara deterministik dan adil,
                memperhitungkan ketersediaan hari mengawas masing-masing guru, menghindari jadwal
                ganda (double booking), dan meratakan beban tugas.
              </p>
            </div>

            {/* Filter Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Lingkup Penjadwalan (Scope)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Ujian
                  </label>
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="ALL">Semua Tanggal ({uniqueDates.length} Hari)</option>
                    {uniqueDates.map((date) => (
                      <option key={date} value={date}>
                        {formatIndonesianDate(date)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sesi */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sesi Ujian
                  </label>
                  <select
                    value={selectedSessionFilter}
                    onChange={(e) => setSelectedSessionFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="ALL">Semua Sesi ({uniqueSessions.length} Sesi)</option>
                    {uniqueSessions.map((session) => (
                      <option key={session} value={session}>
                        {session}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gedung */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gedung
                  </label>
                  <select
                    value={selectedBuildingFilter}
                    onChange={(e) => {
                      setSelectedBuildingFilter(e.target.value);
                      setSelectedRoomFilter('ALL');
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="ALL">Semua Gedung ({buildings.length} Gedung)</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ruang */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ruangan
                  </label>
                  <select
                    value={selectedRoomFilter}
                    onChange={(e) => setSelectedRoomFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="ALL">Semua Ruang Aktif ({targetRoomIds.length} Ruang)</option>
                    {rooms
                      .filter(
                        (r) =>
                          r.active &&
                          (selectedBuildingFilter === 'ALL' || r.building_id === selectedBuildingFilter)
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Target lingkup: <strong>{targetExamIds.length}</strong> sesi ujian &bull;{' '}
                  <strong>{targetRoomIds.length}</strong> ruangan aktif &bull; Estimasi kebutuhan:{' '}
                  <strong>{targetExamIds.length * targetRoomIds.length * invigilatorsPerRoom}</strong> slot
                  pengawas
                </span>
              </div>
            </div>

            {/* Scheduling Options */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Opsi & Aturan Penjadwalan
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Opsi 1 */}
                <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Timpa jadwal lama jika sudah ada
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Jika dicentang, penugasan yang sudah ada di jadwal target akan digantikan secara
                      bersih.
                    </span>
                  </div>
                </label>

                {/* Opsi 2 */}
                <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={respectAvailability}
                    onChange={(e) => setRespectAvailability(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Hindari guru mengawas di hari yang tidak tersedia
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menghormati preferensi ketersediaan hari guru (Senin s/d Jumat) sesuai Data Guru.
                    </span>
                  </div>
                </label>

                {/* Opsi 3 */}
                <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={balanceWorkload}
                    onChange={(e) => setBalanceWorkload(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Seimbangkan beban mengawas antar guru
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Memastikan selisih jumlah tugas mengawas antar seluruh guru seminimal mungkin.
                    </span>
                  </div>
                </label>

                {/* Opsi 4: Hindari Mengawas di Ruang Sama Berturut-turut */}
                <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={avoidConsecutiveSameRoom}
                    onChange={(e) => setAvoidConsecutiveSameRoom(e.target.checked)}
                    disabled={consistentSessionsSameRoom}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 disabled:opacity-50"
                  />
                  <div className={consistentSessionsSameRoom ? 'opacity-50' : ''}>
                    <span className="text-xs font-bold text-slate-900 block">
                      Hindari mengawas di ruang sama berturut-turut
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Merotasi ruangan jika opsi sesi sama tidak diaktifkan.
                    </span>
                  </div>
                </label>

                {/* Opsi 5: Tidak Pindah Gedung */}
                <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={noBuildingHopping}
                    onChange={(e) => setNoBuildingHopping(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 block">
                        Tidak Pindah Gedung (Satu Hari Penuh)
                      </span>
                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-semibold">
                        Disarankan
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Guru yang mengawas beberapa sesi pada hari yang sama tetap berada di gedung yang sama (tidak mondar-mandir).
                    </span>
                  </div>
                </label>

                {/* Opsi 6: Semua Sesi Pengawas Sama */}
                <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={consistentSessionsSameRoom}
                    onChange={(e) => {
                      setConsistentSessionsSameRoom(e.target.checked);
                      if (e.target.checked) {
                        setAvoidConsecutiveSameRoom(false);
                      }
                    }}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 block">
                        Semua Sesi Pengawas Sama (Tetap di Ruang yang Sama)
                      </span>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-semibold">
                        Konsisten
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Pengawas di sesi 1 akan otomatis tetap mengawas di ruangan yang sama pada sesi berikutnya di hari tersebut.
                    </span>
                  </div>
                </label>
              </div>

              {/* Opsi Cadangan */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignReserve}
                    onChange={(e) => setAssignReserve(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Tugaskan Pengawas Cadangan per Sesi Ujian
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Menyiapkan guru pengganti darurat jika sewaktu-waktu ada pengawas ruang yang berhalangan hadir.
                    </span>
                  </div>
                </label>

                {assignReserve && (
                  <div className="pl-7 pt-2 flex items-center gap-3">
                    <span className="text-xs text-slate-700 font-semibold">
                      Jumlah guru cadangan per sesi:
                    </span>
                    <select
                      value={reserveCount}
                      onChange={(e) => setReserveCount(Number(e.target.value))}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value={1}>1 Pengawas Cadangan</option>
                      <option value={2}>2 Pengawas Cadangan</option>
                      <option value={3}>3 Pengawas Cadangan</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Batal
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
                >
                  <Eye className="w-4 h-4 text-slate-600" />
                  <span>Preview Jadwal</span>
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{saving ? 'Memproses...' : 'Generate Sekarang'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VALIDATION */}
        {step === 'preview' && previewResult && (
          <div className="space-y-5">
            {/* Stats Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Sesi
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {previewResult.totalSessions} Sesi
                </span>
                <span className="text-[10px] text-slate-400">
                  {previewResult.totalRooms} Ruangan
                </span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Kebutuhan Slot
                </span>
                <span className="text-lg font-black text-blue-900 mt-0.5 block">
                  {previewResult.totalRequired} Slot
                </span>
                <span className="text-[10px] text-blue-600">
                  {invigilatorsPerRoom} per ruang
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Terpenuhi
                </span>
                <span className="text-lg font-black text-emerald-900 mt-0.5 block">
                  {previewResult.totalAssigned} Slot
                </span>
                <span className="text-[10px] text-emerald-600">
                  {Math.round((previewResult.totalAssigned / (previewResult.totalRequired || 1)) * 100)}% Terisi
                </span>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  Guru Bertugas
                </span>
                <span className="text-lg font-black text-purple-900 mt-0.5 block">
                  {previewResult.uniqueTeachersUsed} Guru
                </span>
                <span className="text-[10px] text-purple-600">
                  dari {teachers.filter((t) => t.active).length} aktif
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  Tugas Terbanyak
                </span>
                <span className="text-sm font-bold text-amber-900 mt-0.5 block truncate" title={previewResult.maxLoadedTeacher?.name}>
                  {previewResult.maxLoadedTeacher?.name || '-'}
                </span>
                <span className="text-[10px] text-amber-700 font-semibold">
                  {previewResult.maxLoadedTeacher?.count || 0} Tugas
                </span>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                  Tugas Paling Sedikit
                </span>
                <span className="text-sm font-bold text-teal-900 mt-0.5 block truncate" title={previewResult.minLoadedTeacher?.name}>
                  {previewResult.minLoadedTeacher?.name || '-'}
                </span>
                <span className="text-[10px] text-teal-700 font-semibold">
                  {previewResult.minLoadedTeacher?.count || 0} Tugas
                </span>
              </div>
            </div>

            {/* Warnings or Shortages */}
            {previewResult.warnings.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Catatan Validasi Distribusi:</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-0.5">
                  {previewResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table of Assignments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Hasil Penugasan ({previewResult.newAssignments.length} Catatan)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Menampilkan 20 entri pertama preview
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Jadwal & Sesi</th>
                      <th className="py-2.5 px-3">Ruang</th>
                      <th className="py-2.5 px-3">Peran</th>
                      <th className="py-2.5 px-3">Guru Ditugaskan</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.newAssignments.slice(0, 20).map((item, idx) => {
                      const exam = examSchedules.find((e) => e.id === item.exam_schedule_id);
                      const room = rooms.find((r) => r.id === item.room_id);
                      const teacher = teachers.find((t) => t.id === item.teacher_id);
                      const sub = exam ? subjects.find((s) => s.id === exam.subject_id) : null;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-900 block">
                              {sub?.name || 'Mata Pelajaran'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {exam?.day_name}, {exam?.exam_date} &bull; {exam?.session}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-800">{room?.name}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {room?.code}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.role === 'Pengawas 1'
                                  ? 'bg-blue-50 text-blue-700'
                                  : item.role === 'Pengawas 2'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {teacher ? (
                              <span className="font-semibold text-slate-900">{teacher.name}</span>
                            ) : (
                              <span className="text-amber-600 italic text-[11px] font-medium">
                                Belum ada guru
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              Siap Ditugaskan
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('config')}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ubah Konfigurasi</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 text-xs font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Terapkan & Simpan Jadwal'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
