import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { parseSpreadsheetFile, downloadTeacherTemplate } from '../../lib/excelHelper';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

interface TeacherImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview_validation' | 'confirm';

interface ColumnMapping {
  nama: string;
  nip: string;
  jk: string;
  hariTersedia: string;
  status: string;
  catatan: string;
}

interface ParsedTeacherRow {
  index: number;
  nama: string;
  nip: string;
  jk: 'Laki-laki' | 'Perempuan';
  hariTersedia: string[];
  status: boolean;
  catatan: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  duplicateName?: string;
}

export const TeacherImportModal: React.FC<TeacherImportModalProps> = ({ isOpen, onClose }) => {
  const { teachers, addTeachersBatch } = useData();
  const { success, error, warning } = useToast();

  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Column mappings
  const [mapping, setMapping] = useState<ColumnMapping>({
    nama: '',
    nip: '',
    jk: '',
    hariTersedia: '',
    status: '',
    catatan: '',
  });

  // Validated items
  const [processedRows, setProcessedRows] = useState<ParsedTeacherRow[]>([]);
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
      nama: '',
      nip: '',
      jk: '',
      hariTersedia: '',
      status: '',
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

  // 1. Process File
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

      // Auto detect columns
      const autoMap: ColumnMapping = {
        nama: parsedHeaders.find((h) => /nama/i.test(h)) || '',
        nip: parsedHeaders.find((h) => /nip|nomor|pegawai/i.test(h)) || '',
        jk: parsedHeaders.find((h) => /jk|jenis\s*kelamin|gender/i.test(h)) || '',
        hariTersedia: parsedHeaders.find((h) => /hari|tersedia|jadwal/i.test(h)) || '',
        status: parsedHeaders.find((h) => /status|aktif/i.test(h)) || '',
        catatan: parsedHeaders.find((h) => /catatan|keterangan|notes/i.test(h)) || '',
      };

      setMapping(autoMap);
      setStep('mapping');
    } catch (err: any) {
      error('Gagal membaca file', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Perform Validation after Mapping
  const runValidation = () => {
    if (!mapping.nama) {
      error('Pemetaan Kolom Belum Lengkap', 'Kolom "Nama" wajib dipetakan.');
      return;
    }

    const validated: ParsedTeacherRow[] = rawRows.map((row, idx) => {
      const rowErrors: string[] = [];
      const namaVal = String(row[mapping.nama] || '').trim();
      const nipVal = mapping.nip ? String(row[mapping.nip] || '').trim() : '';
      const jkRaw = mapping.jk ? String(row[mapping.jk] || '').trim().toLowerCase() : '';
      const hariRaw = mapping.hariTersedia ? String(row[mapping.hariTersedia] || '').trim() : '';
      const statusRaw = mapping.status ? String(row[mapping.status] || '').trim().toLowerCase() : 'aktif';
      const catatanVal = mapping.catatan ? String(row[mapping.catatan] || '').trim() : '';

      // Validate Nama
      if (!namaVal) {
        rowErrors.push('Nama wajib diisi');
      }

      // Check duplicate name against database
      const existingTeacher = teachers.find(
        (t) => t.name.trim().toLowerCase() === namaVal.toLowerCase()
      );
      const isDuplicate = !!existingTeacher;

      // Validate JK
      let jk: 'Laki-laki' | 'Perempuan' = 'Laki-laki';
      if (jkRaw) {
        if (jkRaw.includes('p') || jkRaw.includes('wanita') || jkRaw.includes('perempuan')) {
          jk = 'Perempuan';
        } else if (jkRaw.includes('l') || jkRaw.includes('pria') || jkRaw.includes('laki')) {
          jk = 'Laki-laki';
        }
      }

      // Validate Status
      const status = !(statusRaw.includes('non') || statusRaw.includes('tidak') || statusRaw === 'false' || statusRaw === '0');

      // Validate Hari Tersedia
      let hariTersedia: string[] = [];
      if (hariRaw) {
        const parts = hariRaw
          .split(/[,;\/|]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const validDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        hariTersedia = parts
          .map((p) => {
            const found = validDays.find((d) => d.toLowerCase() === p.toLowerCase());
            return found || p;
          })
          .filter((d) => validDays.includes(d));
      }

      if (hariTersedia.length === 0 && status) {
        // Default to all active days if not specified but active
        hariTersedia = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
      }

      if (status && hariTersedia.length === 0) {
        rowErrors.push('Minimal memilih 1 hari ketersediaan jika status aktif');
      }

      return {
        index: idx + 1,
        nama: namaVal,
        nip: nipVal,
        jk,
        hariTersedia,
        status,
        catatan: catatanVal,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
        isDuplicate,
        duplicateName: existingTeacher?.name,
      };
    });

    setProcessedRows(validated);
    setStep('preview_validation');
  };

  // 3. Confirm and execute import to Supabase
  const handleExecuteImport = async () => {
    // Filter rows to import
    const toImport = processedRows.filter((row) => {
      if (!row.isValid) return false;
      if (skipDuplicates && row.isDuplicate) return false;
      return true;
    });

    if (toImport.length === 0) {
      warning('Tidak ada data untuk diimpor', 'Semua baris memiliki kesalahan atau terdeteksi duplikat.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads = toImport.map((row) => ({
        name: row.nama,
        employee_number: row.nip || null,
        gender: row.jk,
        active: row.status,
        available_days: row.hariTersedia,
        notes: row.catatan || null,
      }));

      const res = await addTeachersBatch(payloads);

      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan ke database');
      }

      success(
        'Impor Data Guru Berhasil!',
        `Berhasil memasukkan ${res.count} guru ke dalam database Supabase.`
      );
      handleClose();
    } catch (err: any) {
      error('Gagal Melakukan Impor', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = processedRows.filter((r) => r.isValid).length;
  const duplicateCount = processedRows.filter((r) => r.isDuplicate).length;
  const errorCount = processedRows.filter((r) => !r.isValid).length;
  const willImportCount = processedRows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicate)).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Data Guru (CSV / Excel)" maxWidth="4xl">
      {/* Step Indicator */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div className="flex items-center gap-2">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            1
          </span>
          <span className={`text-xs font-semibold ${step === 'upload' ? 'text-blue-600' : 'text-slate-400'}`}>
            Upload
          </span>
        </div>
        <div className="h-0.5 w-8 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'mapping' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            2
          </span>
          <span className={`text-xs font-semibold ${step === 'mapping' ? 'text-blue-600' : 'text-slate-400'}`}>
            Mapping Kolom
          </span>
        </div>
        <div className="h-0.5 w-8 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'preview_validation' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            3
          </span>
          <span className={`text-xs font-semibold ${step === 'preview_validation' ? 'text-blue-600' : 'text-slate-400'}`}>
            Validasi & Preview
          </span>
        </div>
        <div className="h-0.5 w-8 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'confirm' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            4
          </span>
          <span className={`text-xs font-semibold ${step === 'confirm' ? 'text-blue-600' : 'text-slate-400'}`}>
            Konfirmasi
          </span>
        </div>
      </div>

      {/* ================= STEP 1: UPLOAD ================= */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Gunakan template terstandar untuk mempercepat proses impor data guru.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadTeacherTemplate('xlsx')}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 font-semibold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Template Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => downloadTeacherTemplate('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 font-semibold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Template CSV
              </button>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleProcessFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Pilih file atau drag & drop file di sini
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Mendukung format file <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong>
            </p>
          </div>
        </div>
      )}

      {/* ================= STEP 2: MAPPING ================= */}
      {step === 'mapping' && (
        <div className="space-y-6">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>
                File: <strong>{file?.name}</strong> &bull; Total Baris Terbaca: <strong>{rawRows.length}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="text-blue-600 hover:underline font-semibold"
            >
              Ganti File
            </button>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Petakan Kolom File Anda ke Kolom Sistem
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  Nama Guru <span className="text-rose-500">* (Wajib)</span>
                </label>
                <select
                  value={mapping.nama}
                  onChange={(e) => setMapping({ ...mapping, nama: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Pilih Kolom File --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Contoh: Nama Lengkap beserta gelar</p>
              </div>

              {/* NIP */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  NIP / Nomor Pegawai (Opsional)
                </label>
                <select
                  value={mapping.nip}
                  onChange={(e) => setMapping({ ...mapping, nip: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Lewati / Kosongkan --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Nomor induk pegawai atau NUPTK</p>
              </div>

              {/* JK */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Jenis Kelamin (JK)
                </label>
                <select
                  value={mapping.jk}
                  onChange={(e) => setMapping({ ...mapping, jk: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Otomatis Default (Laki-laki) --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Laki-laki / Perempuan (atau L/P)</p>
              </div>

              {/* Hari Tersedia */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Hari Tersedia Menjaga Ujian
                </label>
                <select
                  value={mapping.hariTersedia}
                  onChange={(e) => setMapping({ ...mapping, hariTersedia: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Otomatis (Semua Hari Kerja) --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Format: dipisah koma, cth: Senin,Selasa,Kamis</p>
              </div>

              {/* Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Status Aktif
                </label>
                <select
                  value={mapping.status}
                  onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Otomatis Default (Aktif) --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Aktif / Nonaktif</p>
              </div>

              {/* Catatan */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Catatan
                </label>
                <select
                  value={mapping.catatan}
                  onChange={(e) => setMapping({ ...mapping, catatan: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Lewati / Kosongkan --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Catatan tugas atau keterangan tambahan</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <button
              type="button"
              onClick={runValidation}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
            >
              Lanjutkan ke Validasi & Preview
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: PREVIEW & VALIDASI ================= */}
      {step === 'preview_validation' && (
        <div className="space-y-6">
          {/* Summary Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-800">{validCount} Baris Valid</span>
                <p className="text-[11px] text-emerald-700">Data siap diimpor</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-800">{duplicateCount} Nama Duplikat</span>
                <p className="text-[11px] text-amber-700">Sudah terdaftar di sistem</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold text-rose-800">{errorCount} Baris Error</span>
                <p className="text-[11px] text-rose-700">Tidak dapat diimpor</p>
              </div>
            </div>
          </div>

          {/* Duplicate Warning Toggle */}
          {duplicateCount > 0 && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Terdapat <strong>{duplicateCount} guru</strong> dengan nama yang sama persis di sistem.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-amber-400 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-amber-900">Lewati Duplikat (Rekomendasi)</span>
              </label>
            </div>
          )}

          {/* Table Preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-12">No</th>
                  <th className="py-2.5 px-3">Nama</th>
                  <th className="py-2.5 px-3">NIP</th>
                  <th className="py-2.5 px-3">JK</th>
                  <th className="py-2.5 px-3">Hari Tersedia</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedRows.map((row) => (
                  <tr
                    key={row.index}
                    className={
                      !row.isValid
                        ? 'bg-rose-50/40'
                        : row.isDuplicate
                        ? 'bg-amber-50/40'
                        : 'hover:bg-slate-50/70'
                    }
                  >
                    <td className="py-2 px-3 text-slate-500">{row.index}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {row.nama || <span className="text-rose-500 italic">Kosong</span>}
                    </td>
                    <td className="py-2 px-3 text-slate-600">{row.nip || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{row.jk}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {row.hariTersedia.map((d) => (
                          <span key={d} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.status ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.status ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {!row.isValid ? (
                        <div className="text-rose-600 text-[11px] font-medium flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{row.errors.join(', ')}</span>
                        </div>
                      ) : row.isDuplicate ? (
                        <div className="text-amber-700 text-[11px] font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{skipDuplicates ? 'Dilewati (Duplikat)' : 'Nama Sama'}</span>
                        </div>
                      ) : (
                        <div className="text-emerald-600 text-[11px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Siap</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('mapping')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Mapping
            </button>
            <button
              type="button"
              onClick={() => setStep('confirm')}
              disabled={willImportCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition-colors"
            >
              Lanjut Konfirmasi ({willImportCount} data)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: KONFIRMASI ================= */}
      {step === 'confirm' && (
        <div className="space-y-6 text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-800">
              Konfirmasi Impor Data Guru ke Supabase
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Sistem akan memasukkan <strong>{willImportCount} data guru</strong> langsung ke tabel Supabase PostgreSQL.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Total baris file:</span>
              <strong className="text-slate-800">{rawRows.length}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Akan dimasukkan:</span>
              <strong className="text-emerald-600">{willImportCount} guru</strong>
            </div>
            {duplicateCount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Duplikat nama {skipDuplicates ? '(dilewati)' : '(tetap diimpor)'}:</span>
                <strong className="text-amber-600">{duplicateCount}</strong>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Baris tidak valid (dilewati):</span>
                <strong className="text-rose-600">{errorCount}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('preview_validation')}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isSubmitting || willImportCount === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan ke Supabase...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Mulai Impor Sekarang
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
