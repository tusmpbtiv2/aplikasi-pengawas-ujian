import React, { useState, useMemo, useRef } from 'react';
import {
  Printer,
  FileText,
  CreditCard,
  Calendar,
  Grid,
  Users,
  CheckCircle2,
  Building2,
  DoorOpen,
  BookOpen,
  Filter,
  Download,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Teacher, Room, ExamSchedule, InvigilatorSchedule } from '../../types/database';
import { formatIndonesianDate } from '../../lib/scheduleHelper';

type PrintTab = 'f4_attendance' | 'a5_card' | 'all_matrix';

export const PrintCenterView: React.FC = () => {
  const {
    settings,
    examSchedules,
    rooms,
    teachers,
    buildings,
    subjects,
    invigilatorSchedules,
  } = useData();

  const [activeTab, setActiveTab] = useState<PrintTab>('f4_attendance');

  // Filters for F4 Attendance
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(examSchedules.map((es) => es.exam_date))).sort();
  }, [examSchedules]);

  const [selectedDateF4, setSelectedDateF4] = useState<string>(uniqueDates[0] || '');
  const [selectedSessionF4, setSelectedSessionF4] = useState<string>('ALL');
  const [selectedBuildingF4, setSelectedBuildingF4] = useState<string>('ALL');

  // Filters for A5 Card
  const [selectedTeacherA5, setSelectedTeacherA5] = useState<string>('ALL'); // 'ALL' or teacherId

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // DATA FOR F4 DAFTAR HADIR
  // -------------------------------------------------------------
  const f4AttendanceData = useMemo(() => {
    return invigilatorSchedules
      .filter((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        if (!exam) return false;
        if (selectedDateF4 && exam.exam_date !== selectedDateF4) return false;
        if (selectedSessionF4 !== 'ALL' && exam.session !== selectedSessionF4) return false;

        const room = rooms.find((r) => r.id === inv.room_id);
        if (selectedBuildingF4 !== 'ALL' && room?.building_id !== selectedBuildingF4) return false;

        return true;
      })
      .map((inv) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        const room = rooms.find((r) => r.id === inv.room_id);
        const b = room ? buildings.find((bg) => bg.id === room.building_id) : null;
        const sub = exam ? subjects.find((s) => s.id === exam.subject_id) : null;
        const teacher = teachers.find((t) => t.id === inv.teacher_id);
        return {
          ...inv,
          exam,
          room,
          building: b,
          subject: sub,
          teacher,
        };
      })
      .sort((a, b) => {
        const timeDiff = (a.exam?.start_time || '').localeCompare(b.exam?.start_time || '');
        if (timeDiff !== 0) return timeDiff;
        const roomDiff = (a.room?.code || '').localeCompare(b.room?.code || '', undefined, { numeric: true });
        if (roomDiff !== 0) return roomDiff;
        return (a.role || '').localeCompare(b.role || '');
      });
  }, [
    invigilatorSchedules,
    examSchedules,
    rooms,
    buildings,
    subjects,
    teachers,
    selectedDateF4,
    selectedSessionF4,
    selectedBuildingF4,
  ]);

  // -------------------------------------------------------------
  // DATA FOR A5 KARTU PENGAWAS
  // -------------------------------------------------------------
  const activeTeachers = useMemo(() => {
    return teachers
      .filter((t) => t.active)
      .sort((a, b) =>
        (a.invigilator_code || '').localeCompare(b.invigilator_code || '', undefined, { numeric: true })
      );
  }, [teachers]);

  const a5CardsTeachers = useMemo(() => {
    if (selectedTeacherA5 === 'ALL') {
      return activeTeachers;
    }
    return activeTeachers.filter((t) => t.id === selectedTeacherA5);
  }, [activeTeachers, selectedTeacherA5]);

  // -------------------------------------------------------------
  // DATA FOR ALL MATRIX (Kode Pengawas + Lampiran)
  // -------------------------------------------------------------
  const activeRooms = useMemo(() => {
    return rooms
      .filter((r) => r.active)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rooms]);

  const uniqueExamSessions = useMemo(() => {
    return examSchedules.sort((a, b) => {
      if (a.exam_date !== b.exam_date) return a.exam_date.localeCompare(b.exam_date);
      return a.start_time.localeCompare(b.start_time);
    });
  }, [examSchedules]);

  // Teacher lookup map
  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  // Workload count per teacher for attachment
  const teacherWorkloadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    invigilatorSchedules.forEach((inv) => {
      if (inv.teacher_id) {
        counts.set(inv.teacher_id, (counts.get(inv.teacher_id) || 0) + 1);
      }
    });
    return counts;
  }, [invigilatorSchedules]);

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden when printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              Pusat Cetak Dokumen Ujian
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">SMP Bhinneka Tunggal Ika</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Cetak Dokumen Resmi Pengawas Ujian
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar Hadir Harian (Ukuran F4), Kartu Jadwal Guru (Ukuran A5), dan Master Jadwal All Ujian
            dalam bentuk Kode Pengawas beserta lampirannya.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Sekarang (Print / PDF)</span>
        </button>
      </div>

      {/* Mode Selector Tabs (Hidden when printing) */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tab 1: F4 Attendance */}
        <button
          onClick={() => setActiveTab('f4_attendance')}
          className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
            activeTab === 'f4_attendance'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'f4_attendance' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Daftar Hadir Pengawas Harian</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">
                Kertas F4 / Folio (215 x 330 mm)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Format resmi berita acara & daftar hadir pengawas per hari dan sesi ujian.
          </p>
        </button>

        {/* Tab 2: A5 Card */}
        <button
          onClick={() => setActiveTab('a5_card')}
          className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
            activeTab === 'a5_card'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'a5_card' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Kartu Jadwal Pengawas Guru</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                Kertas A5 (148 x 210 mm)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Kartu penugasan individu untuk dibagikan ke masing-masing guru pengawas.
          </p>
        </button>

        {/* Tab 3: All Matrix */}
        <button
          onClick={() => setActiveTab('all_matrix')}
          className={`p-4 text-left border rounded-2xl transition-all cursor-pointer ${
            activeTab === 'all_matrix'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeTab === 'all_matrix' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Jadwal Pengawas All Ujian</span>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded">
                Format Kode Pengawas + Lampiran
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Matriks kode pengawas seluruh ruang dilampiri daftar kode & nama lengkap guru.
          </p>
        </button>
      </div>

      {/* Filter Control Bar for Active Tab (Hidden when printing) */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {activeTab === 'f4_attendance' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Tanggal Ujian *
              </label>
              <select
                value={selectedDateF4}
                onChange={(e) => setSelectedDateF4(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {uniqueDates.map((date) => (
                  <option key={date} value={date}>
                    {formatIndonesianDate(date)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Filter Sesi</label>
              <select
                value={selectedSessionF4}
                onChange={(e) => setSelectedSessionF4(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Semua Sesi</option>
                <option value="Sesi 1">Sesi 1</option>
                <option value="Sesi 2">Sesi 2</option>
                <option value="Sesi 3">Sesi 3</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Filter Gedung</label>
              <select
                value={selectedBuildingF4}
                onChange={(e) => setSelectedBuildingF4(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Semua Gedung ({buildings.length})</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'a5_card' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="sm:w-80">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Guru Pengawas (atau Semua)
              </label>
              <select
                value={selectedTeacherA5}
                onChange={(e) => setSelectedTeacherA5(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="ALL">Cetak Semua Kartu Guru ({activeTeachers.length} Guru)</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.invigilator_code || 'GURU'}] {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Jika memilih "Semua Guru", browser akan otomatis membuat halaman baru (A5 page-break)
                untuk tiap guru.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'all_matrix' && (
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              <span>
                Menampilkan matriks <strong>{activeRooms.length} Ruangan</strong> &times;{' '}
                <strong>{uniqueExamSessions.length} Sesi Ujian</strong> dengan Kode Pengawas (P01, P02...)
                dan Lampiran Daftar Nama Guru.
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Ukuran Rekomendasi: F4 / A4 Landscape</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. PRINT PREVIEW: DAFTAR HADIR PENGAWAS HARIAN (F4 / FOLIO)              */}
      {/* ========================================================================= */}
      {activeTab === 'f4_attendance' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm print:p-0 print:border-none print:shadow-none print-f4-wrapper">
          {/* Official School Header / Kop Surat */}
          <div className="text-center pb-4 mb-4 border-b-2 border-black space-y-0.5">
            <div className="text-base font-black uppercase tracking-wider text-black">
              PEMERINTAH KABUPATEN / KOTA
            </div>
            <div className="text-lg font-black uppercase tracking-widest text-black">
              {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
            </div>
            <div className="text-xs text-black font-medium">
              {settings.school_address || 'Jl. Pendidikan No. 1, Jakarta'}
            </div>
            <div className="pt-2 text-sm font-black uppercase tracking-wide text-black underline">
              DAFTAR HADIR & BERITA ACARA PENGAWAS RUANG
            </div>
            <div className="text-xs font-bold text-black uppercase">
              {settings.exam_name || 'UJIAN SEKOLAH'} &bull; TAHUN PELAJARAN {settings.academic_year || '2025/2026'}
            </div>
          </div>

          {/* Metadata Pelaksanaan */}
          <div className="grid grid-cols-2 text-xs text-black font-semibold mb-4 gap-2">
            <div>
              <span>Hari / Tanggal : </span>
              <strong className="text-black">
                {selectedDateF4 ? formatIndonesianDate(selectedDateF4) : '-'}
              </strong>
            </div>
            <div className="text-right">
              <span>Sesi / Waktu : </span>
              <strong className="text-black">
                {selectedSessionF4 === 'ALL' ? 'Semua Sesi Ujian' : selectedSessionF4}
              </strong>
            </div>
          </div>

          {/* F4 Attendance Table */}
          <table className="w-full text-left border-collapse border border-black text-xs text-black">
            <thead>
              <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                <th className="border border-black py-2 px-2 w-8">No</th>
                <th className="border border-black py-2 px-3 w-24">Ruang</th>
                <th className="border border-black py-2 px-3 w-28">Sesi & Jam</th>
                <th className="border border-black py-2 px-3">Mata Pelajaran</th>
                <th className="border border-black py-2 px-2 w-20">Kode</th>
                <th className="border border-black py-2 px-3">Nama Pengawas</th>
                <th className="border border-black py-2 px-3 w-24">Tanda Tangan Hadir</th>
                <th className="border border-black py-2 px-3 w-24">Tanda Tangan Selesai</th>
                <th className="border border-black py-2 px-2 w-20">Ket.</th>
              </tr>
            </thead>
            <tbody>
              {f4AttendanceData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-black py-8 text-center text-slate-500 italic">
                    Tidak ada jadwal pengawas untuk kriteria tanggal / sesi ini.
                  </td>
                </tr>
              ) : (
                f4AttendanceData.map((item, index) => (
                  <tr key={item.id} className="border-b border-black">
                    <td className="border border-black py-2 px-2 text-center">{index + 1}</td>
                    <td className="border border-black py-2 px-3">
                      <strong>{item.room?.name}</strong>
                      <div className="text-[10px]">{item.building?.code || item.building?.name}</div>
                    </td>
                    <td className="border border-black py-2 px-3 text-center">
                      <div>{item.exam?.session}</div>
                      <div className="text-[10px] font-mono">
                        {item.exam?.start_time.slice(0, 5)} - {item.exam?.end_time.slice(0, 5)}
                      </div>
                    </td>
                    <td className="border border-black py-2 px-3 font-semibold">
                      {item.subject?.name}
                    </td>
                    <td className="border border-black py-2 px-2 text-center font-black font-mono">
                      {item.teacher?.invigilator_code || '-'}
                    </td>
                    <td className="border border-black py-2 px-3">
                      <div className="font-bold">{item.teacher?.name || 'Belum ditugaskan'}</div>
                      <div className="text-[10px] text-slate-600">
                        {item.role}
                      </div>
                    </td>
                    <td className="border border-black py-2 px-2">
                      <div className="text-[9px] text-slate-400 mb-4">{index + 1}.</div>
                    </td>
                    <td className="border border-black py-2 px-2">
                      <div className="text-[9px] text-slate-400 mb-4">{index + 1}.</div>
                    </td>
                    <td className="border border-black py-2 px-2 text-center text-[10px]">
                      {item.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Signature Block */}
          <div className="grid grid-cols-2 text-xs text-black font-semibold mt-8 pt-4 gap-8">
            <div className="text-center">
              <div>Mengetahui,</div>
              <div className="font-bold">Kepala SMP Bhinneka Tunggal Ika</div>
              <div className="h-16"></div>
              <div className="font-bold underline">Drs. H. Mulyono, M.Pd.</div>
              <div className="text-[11px]">NIP. 196805121994031005</div>
            </div>

            <div className="text-center">
              <div>Jakarta, {selectedDateF4 ? formatIndonesianDate(selectedDateF4) : '...'}</div>
              <div className="font-bold">Ketua Panitia Ujian Sekolah</div>
              <div className="h-16"></div>
              <div className="font-bold underline">Budi Santoso, S.Pd.</div>
              <div className="text-[11px]">NIP. 197508142000031002</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PRINT PREVIEW: KARTU JADWAL PENGAWAS GURU (UKURAN A5)                  */}
      {/* ========================================================================= */}
      {activeTab === 'a5_card' && (
        <div className="space-y-6">
          {a5CardsTeachers.map((teacher, tIdx) => {
            const schedules = invigilatorSchedules
              .filter((inv) => inv.teacher_id === teacher.id)
              .map((inv) => {
                const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
                const room = rooms.find((r) => r.id === inv.room_id);
                const building = room ? buildings.find((b) => b.id === room.building_id) : null;
                const subject = exam ? subjects.find((s) => s.id === exam.subject_id) : null;
                return {
                  ...inv,
                  exam,
                  room,
                  building,
                  subject,
                };
              })
              .sort((a, b) => {
                if (a.exam && b.exam) {
                  if (a.exam.exam_date !== b.exam.exam_date) return a.exam.exam_date.localeCompare(b.exam.exam_date);
                  return a.exam.start_time.localeCompare(b.exam.start_time);
                }
                return 0;
              });

            return (
              <div
                key={teacher.id}
                className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm print:p-0 print:border-none print:shadow-none print-a5-card"
                style={{ breakAfter: 'page' }}
              >
                {/* A5 Header */}
                <div className="text-center pb-2 mb-3 border-b-2 border-black space-y-0.5">
                  <div className="text-xs font-black uppercase tracking-wider text-black">
                    {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
                  </div>
                  <div className="text-sm font-black uppercase tracking-wide text-black underline">
                    KARTU TUGAS PENGAWAS RUANG UJIAN
                  </div>
                  <div className="text-[10px] font-bold text-black uppercase">
                    {settings.exam_name || 'UJIAN SEKOLAH'} &bull; TP {settings.academic_year || '2025/2026'}
                  </div>
                </div>

                {/* Teacher Info Box */}
                <div className="grid grid-cols-2 bg-slate-50 print:bg-transparent border border-black p-2.5 mb-3 text-xs text-black">
                  <div>
                    <div className="flex gap-2">
                      <span className="w-24 font-bold text-slate-600">Nama Guru:</span>
                      <strong className="text-black">{teacher.name}</strong>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-24 font-bold text-slate-600">Jenis Kelamin:</span>
                      <span>{teacher.gender}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <span className="font-bold text-slate-600">Kode Pengawas:</span>
                      <span className="px-2 py-0.5 bg-black text-white font-black font-mono rounded text-xs">
                        {teacher.invigilator_code || 'GURU'}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>NIP/Kode:</span>
                      <span>{teacher.employee_number || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Table of Duties */}
                <table className="w-full text-left border-collapse border border-black text-xs text-black mb-3">
                  <thead>
                    <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                      <th className="border border-black py-1.5 px-2 w-8">No</th>
                      <th className="border border-black py-1.5 px-2">Hari, Tanggal</th>
                      <th className="border border-black py-1.5 px-2 w-20">Sesi & Jam</th>
                      <th className="border border-black py-1.5 px-2">Mata Pelajaran</th>
                      <th className="border border-black py-1.5 px-2 w-24">Ruang & Gedung</th>
                      <th className="border border-black py-1.5 px-2 w-20">Peran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="border border-black py-4 text-center text-slate-500 italic">
                          Belum ada jadwal pengawasan yang ditugaskan untuk guru ini.
                        </td>
                      </tr>
                    ) : (
                      schedules.map((item, idx) => (
                        <tr key={item.id} className="border-b border-black">
                          <td className="border border-black py-1.5 px-2 text-center">{idx + 1}</td>
                          <td className="border border-black py-1.5 px-2">
                            {item.exam?.exam_date ? formatIndonesianDate(item.exam.exam_date) : '-'}
                          </td>
                          <td className="border border-black py-1.5 px-2 text-center font-mono text-[11px]">
                            {item.exam?.session} ({item.exam?.start_time.slice(0, 5)})
                          </td>
                          <td className="border border-black py-1.5 px-2 font-semibold">
                            {item.subject?.name}
                          </td>
                          <td className="border border-black py-1.5 px-2 font-bold">
                            {item.room?.name} ({item.building?.code})
                          </td>
                          <td className="border border-black py-1.5 px-2 text-center font-bold">
                            {item.role}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Brief Regulations & Signature */}
                <div className="grid grid-cols-2 text-[10px] text-black gap-4 pt-1">
                  <div className="border border-black p-2 rounded">
                    <div className="font-bold underline mb-1">Tata Tertib Pengawas:</div>
                    <ol className="list-decimal pl-3 space-y-0.5">
                      <li>Hadir 15 menit sebelum ujian dimulai di ruang panitia.</li>
                      <li>Membawa kartu tugas dan menandatangani daftar hadir.</li>
                      <li>Memastikan HP siswa non-aktif selama ujian berlangsung.</li>
                    </ol>
                  </div>

                  <div className="text-center text-xs">
                    <div>Mengetahui,</div>
                    <div className="font-bold">Ketua Panitia Ujian</div>
                    <div className="h-10"></div>
                    <div className="font-bold underline">Budi Santoso, S.Pd.</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRINT PREVIEW: MASTER JADWAL ALL UJIAN (KODE PENGAWAS + LAMPIRAN)     */}
      {/* ========================================================================= */}
      {activeTab === 'all_matrix' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm print:p-0 print:border-none print:shadow-none space-y-8">
          {/* SECTION A: MASTER MATRIKS KODE PENGAWAS */}
          <div className="space-y-4">
            <div className="text-center pb-3 border-b-2 border-black space-y-0.5">
              <div className="text-xs font-black uppercase tracking-wider text-black">
                {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'}
              </div>
              <div className="text-base font-black uppercase tracking-wide text-black underline">
                MASTER JADWAL PENGAWAS RUANG UJIAN (FORMAT KODE PENGAWAS)
              </div>
              <div className="text-xs font-bold text-black uppercase">
                {settings.exam_name || 'UJIAN SEKOLAH'} &bull; TAHUN PELAJARAN {settings.academic_year || '2025/2026'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-black text-xs text-black">
                <thead>
                  <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                    <th rowSpan={2} className="border border-black py-2 px-2 w-8">No</th>
                    <th rowSpan={2} className="border border-black py-2 px-3 w-28">Ruang Ujian</th>
                    <th rowSpan={2} className="border border-black py-2 px-2 w-16">Gedung</th>
                    {uniqueExamSessions.map((exam) => (
                      <th
                        key={exam.id}
                        colSpan={2}
                        className="border border-black py-1 px-2 text-center text-[10px]"
                      >
                        <div>{formatIndonesianDate(exam.exam_date).slice(0, 10)}</div>
                        <div className="font-mono">{exam.session}</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 print:bg-transparent border-b border-black text-center text-[10px] font-bold">
                    {uniqueExamSessions.map((exam) => (
                      <React.Fragment key={`${exam.id}_roles`}>
                        <th className="border border-black py-1 px-1 w-10">P1</th>
                        <th className="border border-black py-1 px-1 w-10">P2</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRooms.map((room, rIdx) => {
                    const b = buildings.find((bg) => bg.id === room.building_id);

                    return (
                      <tr key={room.id} className="border-b border-black">
                        <td className="border border-black py-1.5 px-2 text-center">{rIdx + 1}</td>
                        <td className="border border-black py-1.5 px-3 font-bold">
                          {room.name} ({room.code})
                        </td>
                        <td className="border border-black py-1.5 px-2 text-center text-[10px]">
                          {b?.code || '-'}
                        </td>

                        {uniqueExamSessions.map((exam) => {
                          const inv1 = invigilatorSchedules.find(
                            (i) => i.exam_schedule_id === exam.id && i.room_id === room.id && i.role === 'Pengawas 1'
                          );
                          const inv2 = invigilatorSchedules.find(
                            (i) => i.exam_schedule_id === exam.id && i.room_id === room.id && i.role === 'Pengawas 2'
                          );

                          const teacher1 = inv1?.teacher_id ? teacherMap.get(inv1.teacher_id) : null;
                          const teacher2 = inv2?.teacher_id ? teacherMap.get(inv2.teacher_id) : null;

                          return (
                            <React.Fragment key={`${room.id}_${exam.id}`}>
                              <td className="border border-black py-1 px-1 text-center font-black font-mono text-[11px]">
                                {teacher1 ? teacher1.invigilator_code || 'P' : '-'}
                              </td>
                              <td className="border border-black py-1 px-1 text-center font-black font-mono text-[11px]">
                                {teacher2 ? teacher2.invigilator_code || 'P' : '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: LAMPIRAN KODE PENGAWAS DAN NAMA GURU */}
          <div className="pt-6 border-t-2 border-black space-y-4" style={{ breakBefore: 'page' }}>
            <div className="text-center pb-2 border-b border-black space-y-0.5">
              <div className="text-sm font-black uppercase tracking-wide text-black underline">
                LAMPIRAN: DAFTAR KODE PENGAWAS DAN NAMA LENGKAP GURU
              </div>
              <div className="text-[11px] font-bold text-black uppercase">
                {settings.school_name || 'SMP BHINNEKA TUNGGAL IKA'} &bull; {settings.exam_name || 'UJIAN SEKOLAH'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-black text-xs text-black">
                <thead>
                  <tr className="bg-slate-100 print:bg-transparent border-b border-black text-center font-bold">
                    <th className="border border-black py-2 px-2 w-10">No</th>
                    <th className="border border-black py-2 px-3 w-28">Kode Pengawas</th>
                    <th className="border border-black py-2 px-4">Nama Lengkap Guru</th>
                    <th className="border border-black py-2 px-3 w-28">Jenis Kelamin</th>
                    <th className="border border-black py-2 px-3 w-28 text-center">Total Mengawas</th>
                    <th className="border border-black py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTeachers.map((t, idx) => {
                    const totalTugas = teacherWorkloadCounts.get(t.id) || 0;

                    return (
                      <tr key={t.id} className="border-b border-black">
                        <td className="border border-black py-1.5 px-2 text-center">{idx + 1}</td>
                        <td className="border border-black py-1.5 px-3 font-black font-mono text-center">
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] print:bg-transparent print:text-black">
                            {t.invigilator_code || `P${String(idx + 1).padStart(2, '0')}`}
                          </span>
                        </td>
                        <td className="border border-black py-1.5 px-4 font-bold">
                          {t.name}
                        </td>
                        <td className="border border-black py-1.5 px-3">
                          {t.gender}
                        </td>
                        <td className="border border-black py-1.5 px-3 text-center font-bold font-mono">
                          {totalTugas} Sesi
                        </td>
                        <td className="border border-black py-1.5 px-3 text-[11px] text-slate-600">
                          {t.notes || 'Guru Pengawas'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 text-xs text-black font-semibold mt-8 pt-4 gap-8">
              <div className="text-center">
                <div>Mengetahui,</div>
                <div className="font-bold">Kepala SMP Bhinneka Tunggal Ika</div>
                <div className="h-16"></div>
                <div className="font-bold underline">Drs. H. Mulyono, M.Pd.</div>
                <div className="text-[11px]">NIP. 196805121994031005</div>
              </div>

              <div className="text-center">
                <div>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div className="font-bold">Ketua Panitia Ujian Sekolah</div>
                <div className="h-16"></div>
                <div className="font-bold underline">Budi Santoso, S.Pd.</div>
                <div className="text-[11px]">NIP. 197508142000031002</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
