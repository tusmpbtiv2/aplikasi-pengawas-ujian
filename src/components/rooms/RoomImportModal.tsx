import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { parseSpreadsheetFile, downloadRoomTemplate } from '../../lib/excelHelper';
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

interface RoomImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview_validation' | 'confirm';

interface ColumnMapping {
  nama: string;
  kode: string;
  gedung: string;
  kapasitas: string;
  status: string;
  catatan: string;
}

interface ParsedRoomRow {
  index: number;
  nama: string;
  kode: string;
  buildingId: string;
  buildingName: string;
  kapasitas: number;
  status: boolean;
  catatan: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

export const RoomImportModal: React.FC<RoomImportModalProps> = ({ isOpen, onClose }) => {
  const { buildings, rooms, addRoomsBatch } = useData();
  const { success, error, warning } = useToast();

  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [defaultBuildingId, setDefaultBuildingId] = useState(buildings[0]?.id || '');
  const [mapping, setMapping] = useState<ColumnMapping>({
    nama: '',
    kode: '',
    gedung: '',
    kapasitas: '',
    status: '',
    catatan: '',
  });

  const [processedRows, setProcessedRows] = useState<ParsedRoomRow[]>([]);
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
      kode: '',
      gedung: '',
      kapasitas: '',
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

      // Auto map
      setMapping({
        nama: parsedHeaders.find((h) => /nama.*ruang|room.*name|nama/i.test(h)) || '',
        kode: parsedHeaders.find((h) => /kode.*ruang|room.*code|kode/i.test(h)) || '',
        gedung: parsedHeaders.find((h) => /gedung|building/i.test(h)) || '',
        kapasitas: parsedHeaders.find((h) => /kapasitas|kursi|capacity/i.test(h)) || '',
        status: parsedHeaders.find((h) => /status|aktif/i.test(h)) || '',
        catatan: parsedHeaders.find((h) => /catatan|keterangan|notes/i.test(h)) || '',
      });

      setStep('mapping');
    } catch (err: any) {
      error('Gagal membaca file', err.message);
    } finally {
      setLoading(false);
    }
  };

  const runValidation = () => {
    if (!mapping.nama && !mapping.kode) {
      error('Pemetaan Kurang', 'Setidaknya kolom Nama Ruang atau Kode Ruang wajib dipetakan.');
      return;
    }

    const validated: ParsedRoomRow[] = rawRows.map((row, idx) => {
      const rowErrors: string[] = [];
      const namaVal = mapping.nama ? String(row[mapping.nama] || '').trim() : '';
      const kodeVal = mapping.kode ? String(row[mapping.kode] || '').trim().toUpperCase() : '';
      const gedungRaw = mapping.gedung ? String(row[mapping.gedung] || '').trim() : '';
      const kapRaw = mapping.kapasitas ? parseInt(String(row[mapping.kapasitas])) : 30;
      const statusRaw = mapping.status ? String(row[mapping.status] || '').trim().toLowerCase() : 'aktif';
      const catatanVal = mapping.catatan ? String(row[mapping.catatan] || '').trim() : '';

      const finalName = namaVal || (kodeVal ? `Ruang ${kodeVal}` : '');
      const finalCode = kodeVal || (namaVal ? namaVal.replace(/\s+/g, '-').toUpperCase() : '');

      if (!finalName) rowErrors.push('Nama ruang kosong');
      if (!finalCode) rowErrors.push('Kode ruang kosong');

      // Resolve building
      let matchedBuilding = buildings.find(
        (b) =>
          b.code.toUpperCase() === gedungRaw.toUpperCase() ||
          b.name.toLowerCase() === gedungRaw.toLowerCase()
      );
      if (!matchedBuilding && defaultBuildingId) {
        matchedBuilding = buildings.find((b) => b.id === defaultBuildingId);
      }

      if (!matchedBuilding) {
        rowErrors.push('Gedung tidak dikenali');
      }

      // Check duplicates
      const isDuplicate = rooms.some((r) => r.code.toUpperCase() === finalCode);

      const status = !(statusRaw.includes('non') || statusRaw.includes('tidak') || statusRaw === 'false' || statusRaw === '0');

      return {
        index: idx + 1,
        nama: finalName,
        kode: finalCode,
        buildingId: matchedBuilding?.id || '',
        buildingName: matchedBuilding ? `${matchedBuilding.name} (${matchedBuilding.code})` : '-',
        kapasitas: isNaN(kapRaw) || kapRaw <= 0 ? 30 : kapRaw,
        status,
        catatan: catatanVal,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
        isDuplicate,
      };
    });

    setProcessedRows(validated);
    setStep('preview_validation');
  };

  const handleExecuteImport = async () => {
    const toImport = processedRows.filter((r) => {
      if (!r.isValid) return false;
      if (skipDuplicates && r.isDuplicate) return false;
      return true;
    });

    if (toImport.length === 0) {
      warning('Tidak ada data yang valid untuk diimpor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads = toImport.map((r) => ({
        building_id: r.buildingId,
        code: r.kode,
        name: r.nama,
        capacity: r.kapasitas,
        active: r.status,
        notes: r.catatan || null,
      }));

      const res = await addRoomsBatch(payloads);
      if (!res.success) throw new Error(res.error);

      success('Impor Ruang Berhasil!', `Berhasil mengimpor ${res.count} ruang ujian ke Supabase.`);
      handleClose();
    } catch (err: any) {
      error('Gagal Impor Ruang', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = processedRows.filter((r) => r.isValid).length;
  const duplicateCount = processedRows.filter((r) => r.isDuplicate).length;
  const errorCount = processedRows.filter((r) => !r.isValid).length;
  const willImportCount = processedRows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicate)).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Data Ruang Ujian" maxWidth="4xl">
      {/* Step Indicator */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>1</span>
          <span className={`text-xs font-semibold ${step === 'upload' ? 'text-blue-600' : 'text-slate-400'}`}>Upload</span>
        </div>
        <div className="h-0.5 w-8 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'mapping' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>2</span>
          <span className={`text-xs font-semibold ${step === 'mapping' ? 'text-blue-600' : 'text-slate-400'}`}>Mapping</span>
        </div>
        <div className="h-0.5 w-8 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'preview_validation' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>3</span>
          <span className={`text-xs font-semibold ${step === 'preview_validation' ? 'text-blue-600' : 'text-slate-400'}`}>Validasi</span>
        </div>
        <div className="h-0.5 w-8 bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'confirm' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>4</span>
          <span className={`text-xs font-semibold ${step === 'confirm' ? 'text-blue-600' : 'text-slate-400'}`}>Konfirmasi</span>
        </div>
      </div>

      {step === 'upload' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Unduh template tabel ruang untuk format pengisian yang terstandarisasi.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadRoomTemplate('xlsx')}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 font-semibold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Template Excel
              </button>
              <button
                type="button"
                onClick={() => downloadRoomTemplate('csv')}
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
              Pilih file spreadsheet data ruang ujian
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Mendukung file <strong>.xlsx</strong>, <strong>.xls</strong>, dan <strong>.csv</strong>
            </p>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-6">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
            <span className="text-slate-700">
              File: <strong>{file?.name}</strong> ({rawRows.length} baris terbaca)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Gedung Default (jika kolom kosong):</span>
              <select
                value={defaultBuildingId}
                onChange={(e) => setDefaultBuildingId(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Nama Ruang <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.nama}
                onChange={(e) => setMapping({ ...mapping, nama: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="">-- Pilih Kolom File --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Kode Ruang <span className="text-rose-500">*</span>
              </label>
              <select
                value={mapping.kode}
                onChange={(e) => setMapping({ ...mapping, kode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="">-- Pilih Kolom File --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Gedung / Kode Gedung
              </label>
              <select
                value={mapping.gedung}
                onChange={(e) => setMapping({ ...mapping, gedung: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="">-- Gunakan Gedung Default --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Kapasitas Kursi
              </label>
              <select
                value={mapping.kapasitas}
                onChange={(e) => setMapping({ ...mapping, kapasitas: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="">-- Default (30 Kursi) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Status Aktif
              </label>
              <select
                value={mapping.status}
                onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="">-- Otomatis (Aktif) --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Catatan
              </label>
              <select
                value={mapping.catatan}
                onChange={(e) => setMapping({ ...mapping, catatan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              >
                <option value="">-- Kosongkan --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <button
              type="button"
              onClick={runValidation}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
            >
              Lanjutkan ke Validasi
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'preview_validation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="font-bold text-emerald-800">{validCount} Ruang Valid</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="font-bold text-amber-800">{duplicateCount} Kode Duplikat</span>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <span className="font-bold text-rose-800">{errorCount} Baris Error</span>
            </div>
          </div>

          {duplicateCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center justify-between">
              <span className="text-amber-900">
                Terdapat <strong>{duplicateCount} kode ruang</strong> yang sudah terdaftar.
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="font-bold text-amber-900">Lewati Duplikat</span>
              </label>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-12">No</th>
                  <th className="py-2.5 px-3">Kode</th>
                  <th className="py-2.5 px-3">Nama Ruang</th>
                  <th className="py-2.5 px-3">Gedung</th>
                  <th className="py-2.5 px-3">Kapasitas</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedRows.map((row) => (
                  <tr key={row.index} className={!row.isValid ? 'bg-rose-50/40' : row.isDuplicate ? 'bg-amber-50/40' : ''}>
                    <td className="py-2 px-3 text-slate-400">{row.index}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{row.kode}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{row.nama}</td>
                    <td className="py-2 px-3 text-slate-600">{row.buildingName}</td>
                    <td className="py-2 px-3">{row.kapasitas} Kursi</td>
                    <td className="py-2 px-3">
                      {!row.isValid ? (
                        <span className="text-rose-600 font-medium">{row.errors.join(', ')}</span>
                      ) : row.isDuplicate ? (
                        <span className="text-amber-700 font-medium">Sudah Ada</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Valid</span>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <button
              type="button"
              onClick={() => setStep('confirm')}
              disabled={willImportCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
            >
              Lanjut Konfirmasi ({willImportCount} data)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6 text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-800">
              Konfirmasi Impor Ruang ke Supabase
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Sistem akan menyimpan <strong>{willImportCount} data ruang ujian</strong> ke dalam database PostgreSQL.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('preview_validation')}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isSubmitting || willImportCount === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50"
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
