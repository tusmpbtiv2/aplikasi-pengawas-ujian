import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { parseSpreadsheetFile, downloadExamScheduleTemplate } from '../../lib/excelHelper';
import {
  getDayNameFromDate,
  parseInputDate,
  normalizeTime,
  normalizeSession,
  formatIndonesianDate,
  isTimeOverlap,
  getSubjectGradeLevels,
  formatGradeLevelsLabel,
  getOverlappingGrades,
} from '../../lib/scheduleHelper';
import { ExamSchedule, Subject } from '../../types/database';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  Clock,
  Calendar,
  BookOpen,
} from 'lucide-react';

interface ExamScheduleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview_validation' | 'confirm';

interface ColumnMapping {
  tanggal: string;
  hari: string;
  mataPelajaran: string;
  sesi: string;
  jamMulai: string;
  jamSelesai: string;
  catatan: string;
}

interface ParsedScheduleRow {
  index: number;
  rawTanggal: string;
  parsedDate: string | null;
  dayName: string;
  rawMataPelajaran: string;
  matchedSubject: Subject | null;
  session: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  isInternalCollision: boolean;
}

export const ExamScheduleImportModal: React.FC<ExamScheduleImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { subjects, examSchedules, addExamSchedulesBatch } = useData();
  const { success, error, warning } = useToast();

  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [mapping, setMapping] = useState<ColumnMapping>({
    tanggal: '',
    hari: '',
    mataPelajaran: '',
    sesi: '',
    jamMulai: '',
    jamSelesai: '',
    catatan: '',
  });

  const [processedRows, setProcessedRows] = useState<ParsedScheduleRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setLoading(false);
    setMapping({
      tanggal: '',
      hari: '',
      mataPelajaran: '',
      sesi: '',
      jamMulai: '',
      jamSelesai: '',
      catatan: '',
    });
    setProcessedRows([]);
    setSkipDuplicates(true);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleProcessFile = async (uploadedFile: File) => {
    setLoading(true);
    try {
      const { headers: parsedHeaders, rows } = await parseSpreadsheetFile(uploadedFile);

      if (rows.length === 0) {
        throw new Error('File tidak memiliki baris data atau kosong.');
      }

      setFile(uploadedFile);
      setHeaders(parsedHeaders);
      setRawRows(rows);

      // Auto map columns
      const findHeader = (patterns: RegExp[]): string => {
        for (const pat of patterns) {
          const found = parsedHeaders.find((h) => pat.test(h));
          if (found) return found;
        }
        return '';
      };

      setMapping({
        tanggal: findHeader([/^tanggal/i, /^tgl/i, /date/i]),
        hari: findHeader([/^hari/i, /day/i]),
        mataPelajaran: findHeader([/mata\s*pelajaran/i, /^mapel/i, /subject/i, /^nama.*mapel/i]),
        sesi: findHeader([/^sesi/i, /^session/i]),
        jamMulai: findHeader([/jam\s*mulai/i, /waktu\s*mulai/i, /start/i, /^mulai/i]),
        jamSelesai: findHeader([/jam\s*selesai/i, /waktu\s*selesai/i, /end/i, /^selesai/i]),
        catatan: findHeader([/catatan/i, /keterangan/i, /notes/i]),
      });

      setStep('mapping');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca berkas spreadsheet';
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleValidateAndPreview = () => {
    if (!mapping.tanggal) {
      error('Kolom Tanggal wajib dipetakan');
      return;
    }
    if (!mapping.mataPelajaran) {
      error('Kolom Mata Pelajaran wajib dipetakan');
      return;
    }

    const processed: ParsedScheduleRow[] = [];
    const seenRowsInFile: {
      date: string;
      session: string;
      startTime: string | null;
      endTime: string | null;
      matchedSubject: Subject | null;
      rowNum: number;
    }[] = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const rawTanggal = String(row[mapping.tanggal] || '').trim();
      const rawHari = mapping.hari ? String(row[mapping.hari] || '').trim() : '';
      const rawMataPelajaran = String(row[mapping.mataPelajaran] || '').trim();
      const rawSesi = mapping.sesi ? String(row[mapping.sesi] || '').trim() : 'Sesi 1';
      const rawJamMulai = mapping.jamMulai ? String(row[mapping.jamMulai] || '').trim() : '07:30';
      const rawJamSelesai = mapping.jamSelesai ? String(row[mapping.jamSelesai] || '').trim() : '09:00';
      const notes = mapping.catatan ? String(row[mapping.catatan] || '').trim() : '';

      const errors: string[] = [];

      // 1. Date parsing
      const parsedDate = parseInputDate(rawTanggal);
      if (!parsedDate) {
        errors.push(`Format tanggal '${rawTanggal}' tidak valid (Gunakan format DD/MM/YYYY atau YYYY-MM-DD)`);
      }

      const dayName = parsedDate
        ? (rawHari && rawHari.length > 2 ? rawHari : getDayNameFromDate(parsedDate))
        : 'Senin';

      // 2. Subject validation
      const cleanSubjectSearch = rawMataPelajaran.toLowerCase().trim();
      const matchedSubject = subjects.find(
        (s) =>
          s.name.toLowerCase().trim() === cleanSubjectSearch ||
          s.code.toLowerCase().trim() === cleanSubjectSearch ||
          s.name.toLowerCase().includes(cleanSubjectSearch) ||
          cleanSubjectSearch.includes(s.name.toLowerCase())
      ) || null;

      if (!rawMataPelajaran) {
        errors.push('Mata pelajaran kosong');
      } else if (!matchedSubject) {
        errors.push(`Mata pelajaran '${rawMataPelajaran}' belum terdaftar di Data Master`);
      }

      // 3. Time validation
      const startTime = normalizeTime(rawJamMulai);
      const endTime = normalizeTime(rawJamSelesai);

      if (!startTime) {
        errors.push(`Jam mulai '${rawJamMulai}' tidak valid (Contoh: 07:30)`);
      }
      if (!endTime) {
        errors.push(`Jam selesai '${rawJamSelesai}' tidak valid (Contoh: 09:00)`);
      }
      if (startTime && endTime && startTime >= endTime) {
        errors.push(`Jam mulai (${startTime.slice(0, 5)}) harus lebih awal dari jam selesai (${endTime.slice(0, 5)})`);
      }

      // 4. Session normalization
      const session = normalizeSession(rawSesi);

      // 5. Duplicate & conflict check against existing DB (only if overlapping grade levels)
      let isDuplicate = false;
      if (parsedDate && session && matchedSubject) {
        const existingConflicting = examSchedules.filter((es) => {
          if (es.exam_date !== parsedDate) return false;
          const sameSession =
            normalizeSession(es.session).toLowerCase() === session.toLowerCase();
          const timeOverlap =
            startTime && endTime
              ? isTimeOverlap(startTime, endTime, es.start_time, es.end_time)
              : false;
          if (!sameSession && !timeOverlap) return false;

          const existingSub = subjects.find((s) => s.id === es.subject_id);
          const overlapGrades = getOverlappingGrades(matchedSubject, existingSub);
          return overlapGrades.length > 0;
        });

        if (existingConflicting.length > 0) {
          isDuplicate = true;
          const first = existingConflicting[0];
          const existSub = subjects.find((s) => s.id === first.subject_id);
          const overlapGrades = getOverlappingGrades(matchedSubject, existSub);
          errors.push(
            `Jadwal bentrok kelas: Sesi '${session}' pada ${parsedDate} bentrok untuk ${formatGradeLevelsLabel(overlapGrades)} dengan '${existSub?.name || 'Mapel'}' di database`
          );
        }
      }

      // 6. Conflict within current file (only if overlapping grade levels)
      let isInternalCollision = false;
      if (parsedDate && session && matchedSubject) {
        const collidingRow = seenRowsInFile.find((r) => {
          if (r.date !== parsedDate) return false;
          const sameSession = r.session.toLowerCase() === session.toLowerCase();
          const timeOverlap =
            startTime && endTime && r.startTime && r.endTime
              ? isTimeOverlap(startTime, endTime, r.startTime, r.endTime)
              : false;
          if (!sameSession && !timeOverlap) return false;

          const overlap = getOverlappingGrades(matchedSubject, r.matchedSubject);
          return overlap.length > 0;
        });

        if (collidingRow) {
          isInternalCollision = true;
          const overlap = getOverlappingGrades(matchedSubject, collidingRow.matchedSubject);
          errors.push(
            `Duplikasi internal: Bentrok untuk ${formatGradeLevelsLabel(overlap)} dengan baris #${collidingRow.rowNum} ('${collidingRow.matchedSubject?.name}') pada ${parsedDate} ${session}`
          );
        } else {
          seenRowsInFile.push({
            date: parsedDate,
            session,
            startTime,
            endTime,
            matchedSubject,
            rowNum,
          });
        }
      }

      const isValid = errors.length === 0;

      processed.push({
        index: rowNum,
        rawTanggal,
        parsedDate,
        dayName,
        rawMataPelajaran,
        matchedSubject,
        session,
        startTime,
        endTime,
        notes,
        isValid,
        errors,
        isDuplicate,
        isInternalCollision,
      });
    });

    setProcessedRows(processed);
    setStep('preview_validation');
  };

  const handleExecuteImport = async () => {
    const validRows = processedRows.filter(
      (r) => r.isValid && (!skipDuplicates || (!r.isDuplicate && !r.isInternalCollision))
    );

    if (validRows.length === 0) {
      error('Tidak ada baris jadwal yang valid untuk diimpor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads = validRows.map((r) => ({
        exam_date: r.parsedDate!,
        day_name: r.dayName,
        subject_id: r.matchedSubject!.id,
        start_time: r.startTime!,
        end_time: r.endTime!,
        session: r.session,
        notes: r.notes || null,
      }));

      const res = await addExamSchedulesBatch(payloads);
      if (!res.success) throw new Error(res.error || 'Gagal menyimpan jadwal ke Supabase');

      success(`Berhasil mengimpor ${res.count} jadwal ujian baru!`);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat impor data';
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRows = processedRows.length;
  const validCount = processedRows.filter((r) => r.isValid).length;
  const invalidCount = totalRows - validCount;
  const duplicateCount = processedRows.filter((r) => r.isDuplicate || r.isInternalCollision).length;
  const willImportCount = processedRows.filter(
    (r) => r.isValid && (!skipDuplicates || (!r.isDuplicate && !r.isInternalCollision))
  ).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Jadwal Ujian (Excel / CSV)"
      maxWidth="4xl"
    >
      {/* Steps bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'upload'
                ? 'bg-blue-600 text-white'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            1
          </div>
          <span className="text-xs font-bold text-slate-800">Upload File</span>
        </div>
        <div className="w-8 h-0.5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'mapping'
                ? 'bg-blue-600 text-white'
                : step === 'preview_validation' || step === 'confirm'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            2
          </div>
          <span className="text-xs font-bold text-slate-800">Pemetaan Kolom</span>
        </div>
        <div className="w-8 h-0.5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'preview_validation' || step === 'confirm'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            3
          </div>
          <span className="text-xs font-bold text-slate-800">Preview & Validasi</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
            <div>
              <p className="font-bold text-blue-900">Format Spreadsheet yang Didukung</p>
              <p className="text-blue-700 mt-0.5">
                Pastikan berkas berekstensi <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">.xlsx</code> atau <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">.csv</code> dengan kolom: Tanggal, Hari, Mata Pelajaran, Sesi, Jam Mulai, Jam Selesai, Catatan.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadExamScheduleTemplate('xlsx')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-lg shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template .xlsx</span>
              </button>
              <button
                type="button"
                onClick={() => downloadExamScheduleTemplate('csv')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-lg shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template .csv</span>
              </button>
            </div>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50/60 scale-[0.99]'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Klik untuk memilih berkas atau seret ke sini
            </p>
            <p className="text-xs text-slate-400 mt-1">
              File CSV atau Excel (.xlsx) maks 10MB
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: MAPPING */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="font-bold">{file?.name}</span>
              <span className="text-slate-400">({rawRows.length} baris data terbaca)</span>
            </div>
            <button
              onClick={() => setStep('upload')}
              className="text-blue-600 hover:underline text-xs font-semibold"
            >
              Ganti Berkas
            </button>
          </div>

          <p className="text-xs text-slate-600">
            Cocokkan kolom tabel pada file spreadsheet Anda dengan kolom field sistem:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Tanggal Ujian <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.tanggal}
                onChange={(e) => setMapping({ ...mapping, tanggal: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Pilih Kolom --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Hari Pelaksanaan (Opsional - otomatis dari tanggal)
              </label>
              <select
                value={mapping.hari}
                onChange={(e) => setMapping({ ...mapping, hari: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Otomatis Dihitung dari Tanggal --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.mataPelajaran}
                onChange={(e) => setMapping({ ...mapping, mataPelajaran: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Pilih Kolom --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Sesi Ujian (Opsional)
              </label>
              <select
                value={mapping.sesi}
                onChange={(e) => setMapping({ ...mapping, sesi: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Default (Sesi 1) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Jam Mulai (Opsional)
              </label>
              <select
                value={mapping.jamMulai}
                onChange={(e) => setMapping({ ...mapping, jamMulai: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Default (07:30) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Jam Selesai (Opsional)
              </label>
              <select
                value={mapping.jamSelesai}
                onChange={(e) => setMapping({ ...mapping, jamSelesai: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Default (09:00) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kolom Catatan (Opsional)
              </label>
              <select
                value={mapping.catatan}
                onChange={(e) => setMapping({ ...mapping, catatan: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- Tidak Dipetakan --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <button
              type="button"
              onClick={handleValidateAndPreview}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <span>Validasi & Tinjau Data</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION */}
      {step === 'preview_validation' && (
        <div className="space-y-4">
          {/* Summary status pill */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-500 text-[11px]">Total Baris</p>
              <p className="text-lg font-black text-slate-900">{totalRows}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
              <p className="text-emerald-700 text-[11px] font-semibold">Valid</p>
              <p className="text-lg font-black text-emerald-700">{validCount}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900">
              <p className="text-rose-700 text-[11px] font-semibold">Error / Gagal</p>
              <p className="text-lg font-black text-rose-700">{invalidCount}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900">
              <p className="text-blue-700 text-[11px] font-semibold">Akan Diimpor</p>
              <p className="text-lg font-black text-blue-700">{willImportCount}</p>
            </div>
          </div>

          {/* Conflict skip option */}
          {duplicateCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Ditemukan {duplicateCount} jadwal yang bentrok dengan jadwal yang sudah ada.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Lewati Jadwal Bentrok</span>
              </label>
            </div>
          )}

          {/* Table preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Tanggal & Hari</th>
                  <th className="py-2.5 px-3">Sesi & Jam</th>
                  <th className="py-2.5 px-3">Mata Pelajaran</th>
                  <th className="py-2.5 px-3">Status & Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedRows.map((row) => (
                  <tr
                    key={row.index}
                    className={
                      !row.isValid
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : row.isDuplicate
                        ? 'bg-amber-50/30 hover:bg-amber-50/60'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      #{row.index}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">{row.dayName}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {row.parsedDate || row.rawTanggal}
                      </p>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-700">{row.session}</span>
                      <p className="font-mono text-[11px] text-slate-500">
                        {row.startTime?.slice(0, 5) || '--:--'} - {row.endTime?.slice(0, 5) || '--:--'}
                      </p>
                    </td>
                    <td className="py-2.5 px-3">
                      {row.matchedSubject ? (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-900">{row.matchedSubject.name}</p>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {formatGradeLevelsLabel(getSubjectGradeLevels(row.matchedSubject))}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-400">
                            Kode: {row.matchedSubject.code}
                          </p>
                        </div>
                      ) : (
                        <p className="font-bold text-rose-600">{row.rawMataPelajaran || '(Kosong)'}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Siap Impor</span>
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          {row.errors.map((err, errIdx) => (
                            <p key={errIdx} className="text-[10px] text-rose-600 font-medium flex items-start gap-1">
                              <XCircle className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                              <span>{err}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('mapping')}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Pemetaan</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={willImportCount === 0 || isSubmitting}
                onClick={handleExecuteImport}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengimpor Data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi Impor ({willImportCount} Jadwal)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
