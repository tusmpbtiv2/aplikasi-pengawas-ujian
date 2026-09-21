import React, { useState, useRef } from 'react';
import {
  FileUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Building2,
  DoorOpen,
  BookOpen,
  CalendarDays,
  RefreshCw,
  X,
  Eye,
  Check,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import {
  downloadTeacherTemplate,
  downloadBuildingTemplate,
  downloadRoomTemplate,
  downloadSubjectTemplate,
  downloadExamScheduleTemplate,
  parseSpreadsheetFile,
} from '../../lib/excelHelper';
import { Teacher, Building, Room, Subject, ExamSchedule } from '../../types/database';

type ImportEntity = 'TEACHERS' | 'BUILDINGS' | 'ROOMS' | 'SUBJECTS' | 'EXAM_SCHEDULES';

export const ImportCenterView: React.FC = () => {
  const { role } = useAuth();
  const {
    buildings,
    rooms,
    teachers,
    subjects,
    addTeachersBatch,
    addBuildingsBatch,
    addRoomsBatch,
    addSubjectsBatch,
    addExamSchedulesBatch,
  } = useData();

  const isViewer = role === 'VIEWER';

  const [activeEntity, setActiveEntity] = useState<ImportEntity>('TEACHERS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityConfigs = [
    {
      id: 'TEACHERS' as ImportEntity,
      label: 'Data Guru',
      description: 'NIP, Nama Lengkap, Gender, Hari Ketersediaan, Status',
      icon: Users,
      downloadTemplate: downloadTeacherTemplate,
    },
    {
      id: 'BUILDINGS' as ImportEntity,
      label: 'Data Gedung',
      description: 'Nama Gedung, Kode Gedung, Alamat/Lokasi, Catatan',
      icon: Building2,
      downloadTemplate: downloadBuildingTemplate,
    },
    {
      id: 'ROOMS' as ImportEntity,
      label: 'Data Ruang',
      description: 'Gedung, Nama Ruang, Kode, Kapasitas, Status',
      icon: DoorOpen,
      downloadTemplate: downloadRoomTemplate,
    },
    {
      id: 'SUBJECTS' as ImportEntity,
      label: 'Mata Pelajaran',
      description: 'Nama Mata Pelajaran, Kode Mapel, Status, Catatan',
      icon: BookOpen,
      downloadTemplate: downloadSubjectTemplate,
    },
    {
      id: 'EXAM_SCHEDULES' as ImportEntity,
      label: 'Jadwal Ujian',
      description: 'Tanggal, Hari, Sesi, Jam Mulai, Jam Selesai, Mapel',
      icon: CalendarDays,
      downloadTemplate: downloadExamScheduleTemplate,
    },
  ];

  const currentConfig = entityConfigs.find((c) => c.id === activeEntity)!;

  const handleSelectEntity = (entity: ImportEntity) => {
    setActiveEntity(entity);
    setSelectedFile(null);
    setParsedRows([]);
    setErrorMsg(null);
    setSuccessMsg(null);
    setValidationErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsLoadingFile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setValidationErrors([]);

    try {
      const result = await parseSpreadsheetFile(file);
      if (!result.rows || result.rows.length === 0) {
        setErrorMsg('File spreadsheet kosong atau tidak memuat data yang valid.');
        setParsedRows([]);
      } else {
        setParsedRows(result.rows);
        validateImportData(result.rows, activeEntity);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membaca berkas spreadsheet.');
      setParsedRows([]);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const validateImportData = (rows: any[], entity: ImportEntity) => {
    const errors: string[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // header is row 1
      if (entity === 'TEACHERS') {
        const name = row['Nama'] || row['Nama Lengkap'] || row['nama'];
        if (!name) errors.push(`Baris ${rowNum}: Nama Guru wajib diisi.`);
      } else if (entity === 'BUILDINGS') {
        const name = row['Nama Gedung'] || row['Nama'] || row['name'];
        if (!name) errors.push(`Baris ${rowNum}: Nama Gedung wajib diisi.`);
      } else if (entity === 'ROOMS') {
        const name = row['Nama Ruang'] || row['Nama'] || row['name'];
        if (!name) errors.push(`Baris ${rowNum}: Nama Ruang wajib diisi.`);
      } else if (entity === 'SUBJECTS') {
        const name = row['Nama Mata Pelajaran'] || row['Nama'] || row['name'];
        if (!name) errors.push(`Baris ${rowNum}: Nama Mata Pelajaran wajib diisi.`);
      } else if (entity === 'EXAM_SCHEDULES') {
        const date = row['Tanggal Ujian (YYYY-MM-DD)'] || row['Tanggal'] || row['exam_date'];
        const sub = row['Mata Pelajaran'] || row['Kode Mapel'] || row['subject'];
        if (!date) errors.push(`Baris ${rowNum}: Tanggal Ujian wajib diisi.`);
        if (!sub) errors.push(`Baris ${rowNum}: Mata Pelajaran / Kode Mapel wajib diisi.`);
      }
    });

    setValidationErrors(errors);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0 || isViewer) return;
    setIsImporting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (activeEntity === 'TEACHERS') {
        const newTeachers: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>[] = parsedRows.map((r) => {
          const availStr = r['Hari Tersedia'] || r['Hari'] || 'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu';
          const availDays = availStr.split(',').map((s: string) => s.trim()).filter(Boolean);

          return {
            name: String(r['Nama'] || r['Nama Lengkap'] || 'Guru').trim(),
            employee_number: r['NIP'] ? String(r['NIP']).trim() : undefined,
            gender: String(r['JK'] || r['Jenis Kelamin'] || 'Laki-laki').toLowerCase().startsWith('p')
              ? 'Perempuan'
              : 'Laki-laki',
            active: String(r['Status'] || 'Aktif').toLowerCase() !== 'non-aktif',
            available_days: availDays.length > 0 ? availDays : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
            notes: r['Catatan'] ? String(r['Catatan']).trim() : undefined,
          };
        });

        const res = await addTeachersBatch(newTeachers);
        if (res.success) {
          setSuccessMsg(`Berhasil mengimpor ${res.count} data Guru ke sistem!`);
          setParsedRows([]);
          setSelectedFile(null);
        } else {
          setErrorMsg(res.error || 'Gagal menyimpan data guru.');
        }
      } else if (activeEntity === 'BUILDINGS') {
        const newBuildings: Omit<Building, 'id' | 'created_at' | 'updated_at'>[] = parsedRows.map((r, i) => ({
          name: String(r['Nama Gedung'] || r['Nama'] || 'Gedung Baru').trim(),
          code: r['Kode'] ? String(r['Kode']).trim() : `GDG-${i + 1}`,
          address: r['Alamat'] ? String(r['Alamat']).trim() : undefined,
          notes: r['Catatan'] ? String(r['Catatan']).trim() : undefined,
        }));

        const res = await addBuildingsBatch(newBuildings);
        if (res.success) {
          setSuccessMsg(`Berhasil mengimpor ${res.count} data Gedung ke sistem!`);
          setParsedRows([]);
          setSelectedFile(null);
        } else {
          setErrorMsg(res.error || 'Gagal menyimpan data gedung.');
        }
      } else if (activeEntity === 'ROOMS') {
        const defaultBuildingId = buildings[0]?.id || 'b_default';
        const newRooms: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'building'>[] = parsedRows.map((r, i) => {
          const bldgName = r['Gedung'] ? String(r['Gedung']).toLowerCase().trim() : '';
          const matchedBldg = buildings.find(
            (b) => b.name.toLowerCase().includes(bldgName) || (b.code && b.code.toLowerCase() === bldgName)
          );

          return {
            building_id: matchedBldg ? matchedBldg.id : defaultBuildingId,
            name: String(r['Nama Ruang'] || r['Nama'] || 'Ruang').trim(),
            code: r['Kode'] ? String(r['Kode']).trim() : `R-${String(i + 1).padStart(2, '0')}`,
            capacity: Number(r['Kapasitas']) || 32,
            active: String(r['Status'] || 'Aktif').toLowerCase() !== 'non-aktif',
            notes: r['Catatan'] ? String(r['Catatan']).trim() : undefined,
          };
        });

        const res = await addRoomsBatch(newRooms);
        if (res.success) {
          setSuccessMsg(`Berhasil mengimpor ${res.count} data Ruang ke sistem!`);
          setParsedRows([]);
          setSelectedFile(null);
        } else {
          setErrorMsg(res.error || 'Gagal menyimpan data ruang.');
        }
      } else if (activeEntity === 'SUBJECTS') {
        const newSubjects: Omit<Subject, 'id' | 'created_at' | 'updated_at'>[] = parsedRows.map((r) => ({
          name: String(r['Nama Mata Pelajaran'] || r['Nama'] || 'Mapel').trim(),
          code: String(r['Kode'] || r['Kode Mapel'] || 'MPL').trim(),
          active: String(r['Status'] || 'Aktif').toLowerCase() !== 'non-aktif',
          notes: r['Catatan'] ? String(r['Catatan']).trim() : undefined,
        }));

        const res = await addSubjectsBatch(newSubjects);
        if (res.success) {
          setSuccessMsg(`Berhasil mengimpor ${res.count} data Mata Pelajaran!`);
          setParsedRows([]);
          setSelectedFile(null);
        } else {
          setErrorMsg(res.error || 'Gagal menyimpan mata pelajaran.');
        }
      } else if (activeEntity === 'EXAM_SCHEDULES') {
        const newSchedules: Omit<ExamSchedule, 'id' | 'created_at' | 'updated_at' | 'subject'>[] = parsedRows.map((r) => {
          const subInput = String(r['Mata Pelajaran'] || r['Kode Mapel'] || '').toLowerCase().trim();
          const matchedSub = subjects.find(
            (s) => s.name.toLowerCase().includes(subInput) || s.code.toLowerCase() === subInput
          );

          return {
            exam_date: String(r['Tanggal Ujian (YYYY-MM-DD)'] || r['Tanggal'] || new Date().toISOString().slice(0, 10)).trim(),
            day_name: String(r['Hari'] || 'Senin').trim(),
            session: String(r['Sesi'] || 'Sesi 1').trim(),
            start_time: String(r['Jam Mulai'] || '07:30').trim(),
            end_time: String(r['Jam Selesai'] || '09:00').trim(),
            subject_id: matchedSub ? matchedSub.id : subjects[0]?.id || 's_default',
            notes: r['Catatan'] ? String(r['Catatan']).trim() : undefined,
          };
        });

        const res = await addExamSchedulesBatch(newSchedules);
        if (res.success) {
          setSuccessMsg(`Berhasil mengimpor ${res.count} Jadwal Ujian!`);
          setParsedRows([]);
          setSelectedFile(null);
        } else {
          setErrorMsg(res.error || 'Gagal menyimpan jadwal ujian.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat proses import.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1 uppercase tracking-wider">
            <FileUp className="w-4 h-4" />
            <span>Pusat Berkas & Impor Terpadu</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Import Center Data Ujian Sekolah
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Unggah berkas spreadsheet (Excel .xlsx atau CSV) untuk memasukkan ratusan data Guru, 2 Gedung, 45 Ruang,
            Mata Pelajaran, atau Jadwal Ujian secara cepat dan terverifikasi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => currentConfig.downloadTemplate('xlsx')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Template Excel</span>
          </button>
          <button
            onClick={() => currentConfig.downloadTemplate('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4 text-red-700" />
          </button>
        </div>
      )}

      {/* Entity Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {entityConfigs.map((cfg) => {
          const Icon = cfg.icon;
          const isSelected = activeEntity === cfg.id;
          return (
            <button
              key={cfg.id}
              onClick={() => handleSelectEntity(cfg.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">{cfg.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cfg.description}</div>
            </button>
          );
        })}
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Unggah Berkas {currentConfig.label}
            </h2>
            <p className="text-xs text-slate-500">
              Format yang didukung: <strong className="text-slate-700">.xlsx, .xls, .csv</strong>. Pastikan header sesuai template resmi.
            </p>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-blue-600 hover:underline">
              Pilih berkas dari komputer
            </span>
            <span className="text-xs text-slate-500"> atau seret & lepas berkas ke sini</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Maksimal 10 MB per berkas. Sistem akan memvalidasi duplikasi secara otomatis.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {selectedFile && (
          <div className="mt-4 p-3 bg-slate-100/70 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>{selectedFile.name}</span>
              <span className="text-slate-400 text-[11px]">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setParsedRows([]);
                setValidationErrors([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-slate-400 hover:text-red-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Validation Warnings Box */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Peringatan Validasi ({validationErrors.length} Catatan):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] max-h-36 overflow-y-auto pl-2 text-amber-800">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Data Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Pratinjau Data ({parsedRows.length} Baris Siap Diimpor)
              </h3>
            </div>

            <button
              disabled={isImporting || isViewer}
              onClick={handleExecuteImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isImporting ? 'Sedang Memproses...' : `Konfirmasi Simpan ${parsedRows.length} Baris`}</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">No</th>
                  {Object.keys(parsedRows[0] || {}).map((colKey) => (
                    <th key={colKey} className="py-2.5 px-3">
                      {colKey}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    {Object.keys(row).map((colKey) => (
                      <td key={colKey} className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                        {String(row[colKey] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
