import React, { useState, useMemo } from 'react';
import {
  FileDown,
  Printer,
  FileSpreadsheet,
  Users,
  DoorOpen,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  Download,
  Filter,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import {
  exportTeachersToSpreadsheet,
  exportRoomsToSpreadsheet,
  exportSubjectsToSpreadsheet,
  exportExamSchedulesToSpreadsheet,
  exportInvigilatorsToSpreadsheet,
  exportToSpreadsheet,
} from '../../lib/excelHelper';

type ExportCategory =
  | 'INVIGILATORS'
  | 'TEACHERS'
  | 'ROOMS'
  | 'SUBJECTS'
  | 'EXAM_SCHEDULES'
  | 'WORKLOAD_SUMMARY';

export const ExportCenterView: React.FC = () => {
  const {
    teachers,
    buildings,
    rooms,
    subjects,
    examSchedules,
    invigilatorSchedules,
    settings,
  } = useData();

  const [activeCategory, setActiveCategory] = useState<ExportCategory>('INVIGILATORS');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Available exam dates for filter
  const examDates = useMemo(() => {
    const dates = Array.from(new Set(examSchedules.map((e) => e.exam_date))).sort();
    return dates;
  }, [examSchedules]);

  // Workload summary data
  const teacherWorkloadData = useMemo(() => {
    const map = new Map<string, number>();
    teachers.forEach((t) => map.set(t.id, 0));

    invigilatorSchedules.forEach((inv) => {
      if (inv.teacher_id && map.has(inv.teacher_id)) {
        map.set(inv.teacher_id, (map.get(inv.teacher_id) || 0) + 1);
      }
    });

    return teachers.map((t, idx) => ({
      No: idx + 1,
      'Nama Guru': t.name,
      NIP: t.employee_number || '-',
      'Jenis Kelamin': t.gender,
      Status: t.active ? 'Aktif' : 'Non-Aktif',
      'Total Sesi Jaga': map.get(t.id) || 0,
      'Hari Ketersediaan': t.available_days?.join(', ') || '-',
      Catatan: t.notes || '-',
    }));
  }, [teachers, invigilatorSchedules]);

  // Filtered Invigilator export rows
  const invigilatorExportRows = useMemo(() => {
    return invigilatorSchedules
      .map((inv, idx) => {
        const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
        const room = rooms.find((r) => r.id === inv.room_id);
        const bldg = buildings.find((b) => b.id === room?.building_id);
        const teacher = teachers.find((t) => t.id === inv.teacher_id);
        const subject = subjects.find((s) => s.id === exam?.subject_id);

        return {
          idx: idx + 1,
          date: exam?.exam_date || '-',
          day: exam?.day_name || '-',
          session: exam?.session || '-',
          time: exam ? `${exam.start_time.slice(0, 5)} - ${exam.end_time.slice(0, 5)}` : '-',
          building: bldg?.name || '-',
          building_id: bldg?.id || '',
          room: room?.name || '-',
          room_code: room?.code || '-',
          subject: subject?.name || '-',
          role: inv.role || 'Pengawas',
          teacher_name: teacher?.name || '(Belum Ditugaskan)',
          teacher_nip: teacher?.employee_number || '-',
          status: inv.status || 'Dijadwalkan',
          notes: inv.notes || '-',
        };
      })
      .filter((row) => {
        if (selectedBuildingId !== 'ALL' && row.building_id !== selectedBuildingId) return false;
        if (selectedDate !== 'ALL' && row.date !== selectedDate) return false;
        return true;
      });
  }, [invigilatorSchedules, examSchedules, rooms, buildings, teachers, subjects, selectedBuildingId, selectedDate]);

  const handleExport = (format: 'xlsx' | 'csv') => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const schoolPrefix = settings.school_name.replace(/\s+/g, '_').toLowerCase();

    if (activeCategory === 'INVIGILATORS') {
      const dataToExport = invigilatorExportRows.map((r, i) => ({
        No: i + 1,
        Tanggal: r.date,
        Hari: r.day,
        Sesi: r.session,
        Jam: r.time,
        Gedung: r.building,
        Ruang: r.room,
        'Mata Pelajaran': r.subject,
        'Peran Pengawas': r.role,
        'Nama Guru Pengawas': r.teacher_name,
        NIP: r.teacher_nip,
        Status: r.status,
      }));
      exportToSpreadsheet(dataToExport, `Jadwal_Pengawas_${schoolPrefix}_${timestamp}`, format, 'Jadwal Pengawas');
    } else if (activeCategory === 'TEACHERS') {
      exportTeachersToSpreadsheet(teachers, format);
    } else if (activeCategory === 'ROOMS') {
      exportRoomsToSpreadsheet(rooms, buildings, format);
    } else if (activeCategory === 'SUBJECTS') {
      exportSubjectsToSpreadsheet(subjects, format);
    } else if (activeCategory === 'EXAM_SCHEDULES') {
      exportExamSchedulesToSpreadsheet(examSchedules, subjects, format);
    } else if (activeCategory === 'WORKLOAD_SUMMARY') {
      exportToSpreadsheet(
        teacherWorkloadData,
        `Rekap_Beban_Pengawas_${schoolPrefix}_${timestamp}`,
        format,
        'Rekap Beban Jaga'
      );
    }

    setExportNotice(`Berhasil mengekspor data ke format ${format.toUpperCase()}!`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportOptions = [
    {
      id: 'INVIGILATORS' as ExportCategory,
      title: 'Jadwal Pengawas Ujian',
      desc: 'Penugasan guru pengawas per tanggal, hari, sesi, gedung, ruang, dan status kehadiran.',
      icon: ClipboardList,
      count: invigilatorExportRows.length,
      unit: 'penugasan',
    },
    {
      id: 'WORKLOAD_SUMMARY' as ExportCategory,
      title: 'Rekapitulasi Beban Jaga Guru',
      desc: 'Laporan keadilan frekuensi bertugas, total jam mengawas per guru, dan status kehadiran.',
      icon: TrendingUp,
      count: teachers.length,
      unit: 'guru',
    },
    {
      id: 'EXAM_SCHEDULES' as ExportCategory,
      title: 'Jadwal Mata Ujian',
      desc: 'Daftar tanggal ujian, hari, sesi, jam mulai/selesai, dan mata pelajaran terjadwal.',
      icon: CalendarDays,
      count: examSchedules.length,
      unit: 'sesi ujian',
    },
    {
      id: 'TEACHERS' as ExportCategory,
      title: 'Master Data Guru',
      desc: 'Profil lengkap pendidik, NIP, gender, ketersediaan hari tugas, dan kontak.',
      icon: Users,
      count: teachers.length,
      unit: 'guru',
    },
    {
      id: 'ROOMS' as ExportCategory,
      title: 'Master Data Ruang & Gedung',
      desc: 'Daftar 45 ruang ujian yang tersebar di Gedung Utama A dan Gedung Timur B.',
      icon: DoorOpen,
      count: rooms.length,
      unit: 'ruang',
    },
    {
      id: 'SUBJECTS' as ExportCategory,
      title: 'Daftar Mata Pelajaran',
      desc: 'Seluruh mata uji yang diikutsertakan dalam penilaian semester.',
      icon: BookOpen,
      count: subjects.length,
      unit: 'mapel',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1 uppercase tracking-wider">
            <FileDown className="w-4 h-4" />
            <span>Pusat Ekspor & Laporan Resmi</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Export Center Data Ujian Sekolah
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Unduh rekapitulasi data dalam format Excel (.xlsx), CSV, atau cetak dokumen berita acara penugasan pengawas
            resmi SMP Bhinneka Tunggal Ika.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-blue-300" />
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Select Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exportOptions.map((opt) => {
          const Icon = opt.icon;
          const isSelected = activeCategory === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => setActiveCategory(opt.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-slate-800 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                    {opt.count} {opt.unit}
                  </span>
                </div>
                <h3 className="text-xs font-extrabold text-slate-900">{opt.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                <span className={isSelected ? 'text-blue-700' : 'text-slate-400'}>
                  {isSelected ? 'Kategori Terpilih' : 'Klik untuk memilih'}
                </span>
                <span className="text-slate-400">Excel / CSV / Cetak</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Bar for Invigilators */}
      {activeCategory === 'INVIGILATORS' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Data Ekspor:</span>
          </div>

          <div>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Gedung (GDA & GDB)</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Tanggal Ujian</option>
              {examDates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-slate-500 text-[11px]">
            Menampilkan <strong className="text-slate-800">{invigilatorExportRows.length}</strong> baris penugasan
          </div>
        </div>
      )}

      {/* Printable Preview Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Pratinjau Lembar Data Laporan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tampilan format tabel yang akan diekspor ke Excel, CSV, atau dicetak ke kertas kerja panitia
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
            {activeCategory === 'INVIGILATORS'
              ? `${invigilatorExportRows.length} Baris`
              : activeCategory === 'WORKLOAD_SUMMARY'
              ? `${teacherWorkloadData.length} Guru`
              : 'Siap Ekspor'}
          </span>
        </div>

        {/* Printable Official Header */}
        <div className="p-6 border-b border-slate-200 hidden print:block text-center space-y-1">
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-900">
            {settings.school_name}
          </h2>
          <p className="text-xs text-slate-600">{settings.school_address}</p>
          <div className="pt-2">
            <h3 className="text-sm font-bold underline uppercase">
              {activeCategory === 'INVIGILATORS'
                ? 'DAFTAR PENUGASAN PENGAWAS RUANG UJIAN'
                : activeCategory === 'WORKLOAD_SUMMARY'
                ? 'REKAPITULASI BEBAN PENGAWAS UJIAN SEKOLAH'
                : 'LAPORAN OPERASIONAL UJIAN'}
            </h3>
            <p className="text-xs text-slate-600">
              {settings.exam_name} &bull; Tahun Pelajaran {settings.academic_year}
            </p>
          </div>
        </div>

        {/* Dynamic Table Preview */}
        <div className="overflow-x-auto max-h-96">
          {activeCategory === 'INVIGILATORS' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Tanggal & Hari</th>
                  <th className="py-2.5 px-3">Sesi</th>
                  <th className="py-2.5 px-3">Gedung / Ruang</th>
                  <th className="py-2.5 px-3">Mata Pelajaran</th>
                  <th className="py-2.5 px-3">Pengawas Ditugaskan</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invigilatorExportRows.slice(0, 50).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {r.day}, {r.date}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.session}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900">{r.room}</span>
                      <span className="text-slate-400 text-[11px] block">{r.building}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">{r.subject}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900">{r.teacher_name}</span>
                      <span className="text-slate-400 text-[11px] block font-mono">{r.teacher_nip}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeCategory === 'WORKLOAD_SUMMARY' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Nama Guru Pengawas</th>
                  <th className="py-2.5 px-3">NIP</th>
                  <th className="py-2.5 px-3 text-center">Jenis Kelamin</th>
                  <th className="py-2.5 px-3 text-center">Total Sesi Jaga</th>
                  <th className="py-2.5 px-3">Hari Ketersediaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherWorkloadData.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center text-slate-400">{t.No}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{t['Nama Guru']}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{t.NIP}</td>
                    <td className="py-2.5 px-3 text-center text-slate-700">{t['Jenis Kelamin']}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-black text-slate-900 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                        {t['Total Sesi Jaga']} Sesi
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{t['Hari Ketersediaan']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeCategory !== 'INVIGILATORS' && activeCategory !== 'WORKLOAD_SUMMARY' && (
            <div className="p-8 text-center text-xs text-slate-500">
              Data master {activeCategory.toLowerCase()} siap diekspor. Klik tombol di atas untuk mengunduh berkas
              lengkap.
            </div>
          )}
        </div>

        {/* Printable Signature Footer */}
        <div className="p-6 border-t border-slate-200 hidden print:flex justify-between items-end text-xs text-slate-800">
          <div>
            <p>Mengetahui,</p>
            <p className="font-bold mt-1">Kepala SMP Bhinneka Tunggal Ika</p>
            <div className="h-16" />
            <p className="font-bold underline">( ............................................ )</p>
            <p className="text-[11px] text-slate-500">NIP. .....................................</p>
          </div>
          <div className="text-right">
            <p>Jakarta, {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
            <p className="font-bold mt-1">Ketua Panitia Ujian Sekolah</p>
            <div className="h-16" />
            <p className="font-bold underline">( Drs. H. Ahmad Sudrajat, M.Pd. )</p>
            <p className="text-[11px] text-slate-500">NIP. 197805122003121002</p>
          </div>
        </div>
      </div>
    </div>
  );
};
