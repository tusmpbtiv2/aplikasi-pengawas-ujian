import React, { useState, useMemo } from 'react';
import {
  Printer,
  FileText,
  Calendar,
  Building2,
  DoorOpen,
  User,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { formatIndonesianDate } from '../../lib/scheduleHelper';

interface InvigilatorPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTeacherId?: string;
}

export const InvigilatorPrintModal: React.FC<InvigilatorPrintModalProps> = ({
  isOpen,
  onClose,
  defaultTeacherId,
}) => {
  const {
    settings,
    examSchedules,
    rooms,
    teachers,
    buildings,
    subjects,
    invigilatorSchedules,
  } = useData();

  // Print mode: 'ATTENDANCE_SESSION' | 'RECAP_ROOM' | 'PERSONAL_TEACHER'
  const [printMode, setPrintMode] = useState<'ATTENDANCE_SESSION' | 'RECAP_ROOM' | 'PERSONAL_TEACHER'>('ATTENDANCE_SESSION');

  // Filters for printing
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(defaultTeacherId || '');

  // Initialize selected date
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  React.useEffect(() => {
    if (uniqueDates.length > 0 && !selectedDate) {
      setSelectedDate(uniqueDates[0]);
    }
    if (defaultTeacherId) {
      setSelectedTeacherId(defaultTeacherId);
      setPrintMode('PERSONAL_TEACHER');
    }
  }, [uniqueDates, defaultTeacherId]);

  // Target exam schedules based on date & session
  const targetExams = useMemo(() => {
    return examSchedules.filter((es) => {
      const matchDate = !selectedDate || es.exam_date === selectedDate;
      const matchSession = selectedSession === 'ALL' || es.session === selectedSession;
      return matchDate && matchSession;
    });
  }, [examSchedules, selectedDate, selectedSession]);

  // Target rooms
  const targetRooms = useMemo(() => {
    return rooms
      .filter((r) => r.active)
      .filter((r) => selectedBuildingId === 'ALL' || r.building_id === selectedBuildingId)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rooms, selectedBuildingId]);

  // Personal schedule for selected teacher
  const teacherAssignments = useMemo(() => {
    if (!selectedTeacherId) return [];
    return invigilatorSchedules
      .filter((inv) => inv.teacher_id === selectedTeacherId)
      .map((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        const room = rooms.find((r) => r.id === inv.room_id);
        const b = room ? buildings.find((bg) => bg.id === room.building_id) : null;
        const sub = exam ? subjects.find((s) => s.id === exam.subject_id) : null;
        return {
          ...inv,
          exam,
          room,
          building: b,
          subject: sub,
        };
      })
      .sort((a, b) => {
        if (a.exam && b.exam) {
          if (a.exam.exam_date !== b.exam.exam_date) return a.exam.exam_date.localeCompare(b.exam.exam_date);
          return a.exam.start_time.localeCompare(b.exam.start_time);
        }
        return 0;
      });
  }, [selectedTeacherId, invigilatorSchedules, examSchedules, rooms, buildings, subjects]);

  const handlePrint = () => {
    window.print();
  };

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cetak Dokumen & Berita Acara Pengawas"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Print Template Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
          <button
            onClick={() => setPrintMode('ATTENDANCE_SESSION')}
            className={`p-3 text-left border rounded-xl transition-all ${
              printMode === 'ATTENDANCE_SESSION'
                ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText className={`w-4 h-4 ${printMode === 'ATTENDANCE_SESSION' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-900">Daftar Hadir & Berita Acara</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Format formal siap tanda tangan per sesi/hari untuk arsip panitia
            </p>
          </button>

          <button
            onClick={() => setPrintMode('RECAP_ROOM')}
            className={`p-3 text-left border rounded-xl transition-all ${
              printMode === 'RECAP_ROOM'
                ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <DoorOpen className={`w-4 h-4 ${printMode === 'RECAP_ROOM' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-900">Rekap Jadwal per Ruang</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Daftar pembagian pengawas seluruh ruangan & gedung
            </p>
          </button>

          <button
            onClick={() => setPrintMode('PERSONAL_TEACHER')}
            className={`p-3 text-left border rounded-xl transition-all ${
              printMode === 'PERSONAL_TEACHER'
                ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <User className={`w-4 h-4 ${printMode === 'PERSONAL_TEACHER' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-xs font-bold text-slate-900">Jadwal Pribadi Guru</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Surat tugas pengawasan individual untuk diberikan kepada guru
            </p>
          </button>
        </div>

        {/* Configuration Filters for Print */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {printMode !== 'PERSONAL_TEACHER' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Tanggal Ujian
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    {uniqueDates.map((d) => (
                      <option key={d} value={d}>
                        {formatIndonesianDate(d)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Sesi
                  </label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="ALL">Semua Sesi Ujian</option>
                    <option value="Sesi 1">Sesi 1</option>
                    <option value="Sesi 2">Sesi 2</option>
                    <option value="Sesi 3">Sesi 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gedung
                  </label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="ALL">Semua Gedung</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Guru untuk Jadwal Pribadi
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.invigilator_code || 'GURU'}] {t.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500">
            Pastikan opsi cetak browser diatur ke ukuran <strong>A4</strong> dan skala <strong>Default (100%)</strong>.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Print)</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE AREA CONTAINER */}
        <div id="printable-invigilator-doc" className="bg-white p-6 border border-slate-200 rounded-xl shadow-xs font-sans text-slate-900 print:border-none print:shadow-none print:p-0">
          {/* Formal School Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
            <h2 className="text-base font-black tracking-wider uppercase">
              {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              {settings.school_address || 'Jl. Pendidikan No. 45, Jakarta'}
            </p>
            <p className="text-xs font-bold text-slate-800 mt-1 uppercase tracking-wide">
              PANITIA {settings.exam_name || 'PENILAIAN AKHIR SEMESTER'} TAHUN PELAJARAN {settings.academic_year || '2024/2025'}
            </p>
          </div>

          {/* TEMPLATE 1: DAFTAR HADIR & BERITA ACARA PER SESI */}
          {printMode === 'ATTENDANCE_SESSION' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-black underline uppercase">
                  DAFTAR HADIR & BERITA ACARA PENGAWAS RUANG UJIAN
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Hari / Tanggal: <strong>{formatIndonesianDate(selectedDate)}</strong> &bull; Sesi: <strong>{selectedSession}</strong>
                </p>
              </div>

              {targetExams.map((exam) => {
                const sub = subjects.find((s) => s.id === exam.subject_id);

                return (
                  <div key={exam.id} className="space-y-2 mb-6">
                    <div className="flex items-center justify-between text-xs font-bold bg-slate-100 p-2 rounded">
                      <span>Mata Pelajaran: {sub?.name || 'Mata Pelajaran'}</span>
                      <span>
                        Waktu: {exam.start_time.slice(0, 5)} - {exam.end_time.slice(0, 5)} WIB ({exam.session})
                      </span>
                    </div>

                    <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-center font-bold">
                          <th className="border border-slate-300 py-1.5 px-2 w-8">No</th>
                          <th className="border border-slate-300 py-1.5 px-2 w-28">Ruangan</th>
                          <th className="border border-slate-300 py-1.5 px-3">Nama Pengawas 1</th>
                          <th className="border border-slate-300 py-1.5 px-2 w-24">Tanda Tangan 1</th>
                          <th className="border border-slate-300 py-1.5 px-3">Nama Pengawas 2</th>
                          <th className="border border-slate-300 py-1.5 px-2 w-24">Tanda Tangan 2</th>
                          <th className="border border-slate-300 py-1.5 px-2 w-16">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetRooms.map((room, idx) => {
                          const p1 = invigilatorSchedules.find(
                            (inv) =>
                              inv.exam_schedule_id === exam.id &&
                              inv.room_id === room.id &&
                              inv.role === 'Pengawas 1'
                          );
                          const p2 = invigilatorSchedules.find(
                            (inv) =>
                              inv.exam_schedule_id === exam.id &&
                              inv.room_id === room.id &&
                              inv.role === 'Pengawas 2'
                          );

                          const t1 = p1?.teacher_id ? teachers.find((t) => t.id === p1.teacher_id) : null;
                          const t2 = p2?.teacher_id ? teachers.find((t) => t.id === p2.teacher_id) : null;

                          return (
                            <tr key={room.id} className="border-b border-slate-200">
                              <td className="border border-slate-300 py-2 px-2 text-center">{idx + 1}</td>
                              <td className="border border-slate-300 py-2 px-2 font-bold">
                                {room.name}
                                <span className="block font-normal text-[9px] text-slate-500 font-mono">
                                  {room.code}
                                </span>
                              </td>
                              <td className="border border-slate-300 py-2 px-3">
                                {t1 ? (
                                  <div>
                                    <span className="font-semibold">{t1.name}</span>
                                    <span className="block text-[9px] text-slate-500 font-mono">
                                      Kode Pengawas: {t1.invigilator_code || '-'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">........................</span>
                                )}
                              </td>
                              <td className="border border-slate-300 py-2 px-2 text-center text-slate-300">
                                {idx + 1}. .........
                              </td>
                              <td className="border border-slate-300 py-2 px-3">
                                {t2 ? (
                                  <div>
                                    <span className="font-semibold">{t2.name}</span>
                                    <span className="block text-[9px] text-slate-500 font-mono">
                                      Kode Pengawas: {t2.invigilator_code || '-'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">........................</span>
                                )}
                              </td>
                              <td className="border border-slate-300 py-2 px-2 text-center text-slate-300">
                                {idx + 1}. .........
                              </td>
                              <td className="border border-slate-300 py-2 px-2 text-center text-[10px]">
                                {p1?.status === 'Hadir' && p2?.status === 'Hadir'
                                  ? 'Hadir'
                                  : p1?.status || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Signature Blocks */}
              <div className="pt-6 grid grid-cols-2 text-center text-xs">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Kepala Sekolah SMP Bhinneka Tunggal Ika</p>
                  <div className="h-16" />
                  <p className="font-bold underline">Drs. H. Ahmad Sudrajat, M.Pd.</p>
                  <p className="text-[10px] text-slate-500">NIP. 197503152000031002</p>
                </div>

                <div>
                  <p>Jakarta, {formatIndonesianDate(selectedDate)}</p>
                  <p className="font-bold">Ketua Panitia Ujian</p>
                  <div className="h-16" />
                  <p className="font-bold underline">Siti Rahmawati, S.Pd.</p>
                  <p className="text-[10px] text-slate-500">NIP. 198207122008012015</p>
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 2: REKAP JADWAL PER RUANG */}
          {printMode === 'RECAP_ROOM' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-black underline uppercase">
                  REKAP PEMBAGIAN JADWAL PENGAWAS RUANG UJIAN
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tanggal: <strong>{formatIndonesianDate(selectedDate)}</strong>
                </p>
              </div>

              <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-center font-bold">
                    <th className="border border-slate-300 py-2 px-2 w-8">No</th>
                    <th className="border border-slate-300 py-2 px-2">Ruang & Gedung</th>
                    <th className="border border-slate-300 py-2 px-2">Sesi & Jam</th>
                    <th className="border border-slate-300 py-2 px-2">Mata Pelajaran</th>
                    <th className="border border-slate-300 py-2 px-3">Pengawas 1</th>
                    <th className="border border-slate-300 py-2 px-3">Pengawas 2</th>
                  </tr>
                </thead>
                <tbody>
                  {targetRooms.map((room, idx) => {
                    return targetExams.map((exam, eIdx) => {
                      const p1 = invigilatorSchedules.find(
                        (inv) =>
                          inv.exam_schedule_id === exam.id &&
                          inv.room_id === room.id &&
                          inv.role === 'Pengawas 1'
                      );
                      const p2 = invigilatorSchedules.find(
                        (inv) =>
                          inv.exam_schedule_id === exam.id &&
                          inv.room_id === room.id &&
                          inv.role === 'Pengawas 2'
                      );

                      const t1 = p1?.teacher_id ? teachers.find((t) => t.id === p1.teacher_id) : null;
                      const t2 = p2?.teacher_id ? teachers.find((t) => t.id === p2.teacher_id) : null;
                      const sub = subjects.find((s) => s.id === exam.subject_id);

                      return (
                        <tr key={`${room.id}_${exam.id}`} className="border-b border-slate-200">
                          {eIdx === 0 && (
                            <>
                              <td
                                rowSpan={targetExams.length}
                                className="border border-slate-300 py-2 px-2 text-center font-medium align-top"
                              >
                                {idx + 1}
                              </td>
                              <td
                                rowSpan={targetExams.length}
                                className="border border-slate-300 py-2 px-2 font-bold align-top"
                              >
                                {room.name}
                                <span className="block font-normal text-[10px] text-slate-500">
                                  {room.code}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="border border-slate-300 py-1.5 px-2 font-semibold">
                            {exam.session} ({exam.start_time.slice(0, 5)}-{exam.end_time.slice(0, 5)})
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-medium">
                            {sub?.name || '-'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-3">
                            {t1?.name || <span className="text-slate-400 italic">Belum Ada</span>}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-3">
                            {t2?.name || <span className="text-slate-400 italic">Belum Ada</span>}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>

              <div className="pt-6 grid grid-cols-2 text-center text-xs">
                <div />
                <div>
                  <p>Jakarta, {formatIndonesianDate(selectedDate)}</p>
                  <p className="font-bold">Ketua Panitia Ujian</p>
                  <div className="h-16" />
                  <p className="font-bold underline">Siti Rahmawati, S.Pd.</p>
                  <p className="text-[10px] text-slate-500">NIP. 198207122008012015</p>
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE 3: JADWAL PRIBADI GURU */}
          {printMode === 'PERSONAL_TEACHER' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-black underline uppercase">
                  SURAT TUGAS & JADWAL PENGAWASAN UJIAN
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nomor: 421.3 / SMP-BTI / ST / {new Date().getFullYear()}
                </p>
              </div>

              {selectedTeacher ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                  <p>Panitia Ujian Sekolah menugaskan kepada:</p>
                  <div className="grid grid-cols-2 pt-1 gap-1">
                    <div>
                      Nama: <strong>{selectedTeacher.name}</strong>
                    </div>
                    <div>
                      Kode Pengawas: <strong className="font-mono bg-slate-900 text-white px-1.5 py-0.5 rounded text-[11px]">{selectedTeacher.invigilator_code || '-'}</strong>
                    </div>
                    <div>
                      Jabatan: <strong>Guru / Pengawas Ujian</strong>
                    </div>
                    <div>
                      Total Tugas: <strong>{teacherAssignments.length} Sesi Ujian</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-600 italic">Silakan pilih guru terlebih dahulu.</p>
              )}

              <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 text-center font-bold">
                    <th className="border border-slate-300 py-2 px-2 w-8">No</th>
                    <th className="border border-slate-300 py-2 px-3">Hari & Tanggal</th>
                    <th className="border border-slate-300 py-2 px-2">Sesi & Waktu</th>
                    <th className="border border-slate-300 py-2 px-3">Mata Pelajaran</th>
                    <th className="border border-slate-300 py-2 px-3">Ruang Ujian</th>
                    <th className="border border-slate-300 py-2 px-2">Peran</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                        Guru ini belum memiliki jadwal pengawasan.
                      </td>
                    </tr>
                  ) : (
                    teacherAssignments.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-200">
                        <td className="border border-slate-300 py-2 px-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 py-2 px-3 font-semibold">
                          {item.exam?.day_name}, {formatIndonesianDate(item.exam?.exam_date || '')}
                        </td>
                        <td className="border border-slate-300 py-2 px-2">
                          {item.exam?.session} ({item.exam?.start_time.slice(0, 5)} - {item.exam?.end_time.slice(0, 5)})
                        </td>
                        <td className="border border-slate-300 py-2 px-3 font-medium">
                          {item.subject?.name || '-'}
                        </td>
                        <td className="border border-slate-300 py-2 px-3 font-bold">
                          {item.room?.name} ({item.room?.code})
                          <span className="block font-normal text-[9px] text-slate-500">
                            {item.building?.name}
                          </span>
                        </td>
                        <td className="border border-slate-300 py-2 px-2 text-center font-semibold">
                          {item.role}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="pt-6 grid grid-cols-2 text-center text-xs">
                <div>
                  <p>Pengawas yang Bersangkutan,</p>
                  <div className="h-16" />
                  <p className="font-bold underline">{selectedTeacher?.name || 'Guru Pengawas'}</p>
                  <p className="text-[10px] text-slate-500">NIP. {selectedTeacher?.employee_number || '-'}</p>
                </div>

                <div>
                  <p>Jakarta, {formatIndonesianDate(new Date().toISOString().slice(0, 10))}</p>
                  <p className="font-bold">Kepala Sekolah,</p>
                  <div className="h-16" />
                  <p className="font-bold underline">Drs. H. Ahmad Sudrajat, M.Pd.</p>
                  <p className="text-[10px] text-slate-500">NIP. 197503152000031002</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
