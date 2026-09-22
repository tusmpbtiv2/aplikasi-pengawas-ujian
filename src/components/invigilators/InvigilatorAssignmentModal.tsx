import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  AlertTriangle,
  Calendar,
  DoorOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { InvigilatorSchedule, Teacher } from '../../types/database';
import { validateAssignment, isPanitiaTeacher } from '../../lib/invigilatorHelper';

interface InvigilatorAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment?: InvigilatorSchedule | null;
  defaultExamScheduleId?: string;
  defaultRoomId?: string;
  defaultRole?: 'Pengawas 1' | 'Pengawas 2' | 'Cadangan';
}

export const InvigilatorAssignmentModal: React.FC<InvigilatorAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  defaultExamScheduleId,
  defaultRoomId,
  defaultRole,
}) => {
  const {
    examSchedules,
    rooms,
    teachers,
    subjects,
    invigilatorSchedules,
    addInvigilatorSchedule,
    updateInvigilatorSchedule,
    deleteInvigilatorSchedule,
  } = useData();

  const { success: toastSuccess, error: toastError } = useToast();

  const [examScheduleId, setExamScheduleId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [role, setRole] = useState<'Pengawas 1' | 'Pengawas 2' | 'Cadangan'>('Pengawas 1');
  const [status, setStatus] = useState<'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha'>('Dijadwalkan');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset form on open
  useEffect(() => {
    if (isOpen) {
      if (assignment) {
        setExamScheduleId(assignment.exam_schedule_id);
        setRoomId(assignment.room_id);
        setTeacherId(assignment.teacher_id || '');
        setRole(assignment.role);
        setStatus(assignment.status);
        setNotes(assignment.notes || '');
      } else {
        setExamScheduleId(defaultExamScheduleId || (examSchedules[0]?.id || ''));
        setRoomId(defaultRoomId || (rooms.filter((r) => r.active)[0]?.id || ''));
        setTeacherId('');
        setRole(defaultRole || 'Pengawas 1');
        setStatus('Dijadwalkan');
        setNotes('');
      }
      setFormError(null);
      setFormWarning(null);
    }
  }, [isOpen, assignment, defaultExamScheduleId, defaultRoomId, defaultRole, examSchedules, rooms]);

  // Selected Exam Schedule details
  const selectedExam = useMemo(() => {
    return examSchedules.find((e) => e.id === examScheduleId);
  }, [examSchedules, examScheduleId]);

  const selectedSubject = useMemo(() => {
    return selectedExam ? subjects.find((s) => s.id === selectedExam.subject_id) : null;
  }, [selectedExam, subjects]);

  // Concurrent exams happening on the same date and session (e.g. Prakarya & Seni Budaya)
  const concurrentExams = useMemo(() => {
    if (!selectedExam) return [];
    return examSchedules.filter(
      (e) =>
        e.id !== selectedExam.id &&
        e.exam_date === selectedExam.exam_date &&
        e.session === selectedExam.session
    );
  }, [selectedExam, examSchedules]);

  // Real-time validation when teacher or exam changes
  useEffect(() => {
    if (!teacherId || !examScheduleId || !roomId) {
      setFormWarning(null);
      setFormError(null);
      return;
    }

    const val = validateAssignment(
      teacherId,
      examScheduleId,
      roomId,
      teachers,
      examSchedules,
      invigilatorSchedules,
      assignment?.id
    );

    if (!val.isValid) {
      setFormError(val.error || 'Penugasan tidak valid');
      setFormWarning(null);
    } else {
      setFormError(null);
      setFormWarning(val.warning || null);
    }
  }, [teacherId, examScheduleId, roomId, teachers, examSchedules, invigilatorSchedules, assignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examScheduleId || !roomId) {
      setFormError('Jadwal ujian dan ruangan wajib dipilih');
      return;
    }

    if (formError) {
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (assignment?.id) {
        const res = await updateInvigilatorSchedule(assignment.id, {
          exam_schedule_id: examScheduleId,
          room_id: roomId,
          teacher_id: teacherId || null,
          role,
          status,
          notes: notes.trim() || null,
        });

        if (!res.success) throw new Error(res.error || 'Gagal memperbarui jadwal');

        // Sinkronkan penugasan pengawas yang sama ke seluruh mata pelajaran bersamaan di ruangan ini
        for (const ce of concurrentExams) {
          const siblingInv = invigilatorSchedules.find(
            (inv) => inv.exam_schedule_id === ce.id && inv.room_id === roomId && inv.role === role
          );
          if (siblingInv) {
            await updateInvigilatorSchedule(siblingInv.id, {
              teacher_id: teacherId || null,
              status,
              notes: notes.trim() || null,
            });
          } else {
            await addInvigilatorSchedule({
              exam_schedule_id: ce.id,
              room_id: roomId,
              teacher_id: teacherId || null,
              role,
              status,
              notes: notes.trim() || null,
            });
          }
        }

        toastSuccess('Penugasan pengawas berhasil diperbarui');
      } else {
        const res = await addInvigilatorSchedule({
          exam_schedule_id: examScheduleId,
          room_id: roomId,
          teacher_id: teacherId || null,
          role,
          status,
          notes: notes.trim() || null,
        });

        if (!res.success) throw new Error(res.error || 'Gagal menambahkan jadwal');

        // Sinkronkan penugasan pengawas yang sama ke seluruh mata pelajaran bersamaan di ruangan ini
        for (const ce of concurrentExams) {
          const siblingInv = invigilatorSchedules.find(
            (inv) => inv.exam_schedule_id === ce.id && inv.room_id === roomId && inv.role === role
          );
          if (siblingInv) {
            await updateInvigilatorSchedule(siblingInv.id, {
              teacher_id: teacherId || null,
              status,
              notes: notes.trim() || null,
            });
          } else {
            await addInvigilatorSchedule({
              exam_schedule_id: ce.id,
              room_id: roomId,
              teacher_id: teacherId || null,
              role,
              status,
              notes: notes.trim() || null,
            });
          }
        }

        toastSuccess('Pengawas berhasil ditugaskan');
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setFormError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!assignment?.id) return;
    if (window.confirm('Yakin ingin menghapus penugasan pengawas ini?')) {
      // Hapus penugasan utama
      await deleteInvigilatorSchedule(assignment.id);

      // Hapus juga penugasan di mapel bersamaan untuk ruangan dan sesi yang sama
      const targetExam = examSchedules.find((e) => e.id === assignment.exam_schedule_id);
      if (targetExam) {
        const siblings = invigilatorSchedules.filter((inv) => {
          if (inv.id === assignment.id) return false;
          if (inv.room_id !== assignment.room_id || inv.role !== assignment.role) return false;
          const otherExam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
          return (
            otherExam &&
            otherExam.exam_date === targetExam.exam_date &&
            otherExam.session === targetExam.session
          );
        });

        for (const sib of siblings) {
          await deleteInvigilatorSchedule(sib.id);
        }
      }

      toastSuccess('Penugasan pengawas telah dihapus');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assignment ? 'Edit Penugasan Pengawas' : 'Tugaskan Pengawas Ruang (Manual)'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Alert */}
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Konflik Terdeteksi</p>
              <p>{formError}</p>
            </div>
          </div>
        )}

        {/* Warning Alert */}
        {formWarning && !formError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Peringatan Ketersediaan</p>
              <p>{formWarning}</p>
            </div>
          </div>
        )}

        {/* Jadwal Ujian Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Jadwal Ujian <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={examScheduleId}
            onChange={(e) => setExamScheduleId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">-- Pilih Jadwal Ujian --</option>
            {examSchedules.map((es) => {
              const sub = subjects.find((s) => s.id === es.subject_id);
              return (
                <option key={es.id} value={es.id}>
                  {es.day_name} ({es.exam_date}) &bull; {sub?.name || 'Mapel'} ({es.session}: {es.start_time.slice(0, 5)}-{es.end_time.slice(0, 5)})
                </option>
              );
            })}
          </select>

          {concurrentExams.length > 0 && selectedExam && (
            <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Sesi Multi-Mapel ({concurrentExams.length + 1} Mapel Bersamaan)
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Pada {selectedExam.day_name} ({selectedExam.session}), terdapat mapel bersamaan:{' '}
                  <strong>{selectedSubject?.name}</strong> +{' '}
                  <strong>{concurrentExams.map((e) => e.subject?.name || 'Mapel').join(', ')}</strong>.
                  Ruangan yang dipilih akan otomatis diawasi oleh 1 pengawas yang sama untuk seluruh mapel tersebut tanpa memicu bentrok.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Ruangan & Peran */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ruang Ujian <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">-- Pilih Ruang --</option>
              {rooms
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Peran Pengawas <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'Pengawas 1' | 'Pengawas 2' | 'Cadangan')
              }
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="Pengawas 1">Pengawas 1 (Utama)</option>
              <option value="Pengawas 2">Pengawas 2 (Pendamping)</option>
              <option value="Cadangan">Pengawas Cadangan</option>
            </select>
          </div>
        </div>

        {/* Guru Penugasan */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700">
              Guru yang Ditugaskan
            </label>
            {selectedExam && (
              <span className="text-[11px] text-slate-500">
                Hari Ujian: <strong>{selectedExam.day_name}</strong>
              </span>
            )}
          </div>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="">-- Kosongkan (Belum Ada Guru) --</option>
            {teachers.map((t) => {
              const isPanitia = isPanitiaTeacher(t);
              const isAvailable = isPanitia || (selectedExam ? t.available_days?.includes(selectedExam.day_name) : true);
              const statusTag = !t.active
                ? ' [NONAKTIF]'
                : isPanitia
                ? ' [⭐ PANITIA - STANDBY PENGGANTI]'
                : !isAvailable
                ? ` [Hari ${selectedExam?.day_name} Tdk Tersedia]`
                : '';

              return (
                <option key={t.id} value={t.id} disabled={!t.active}>
                  {t.name} ({t.gender === 'Laki-laki' ? 'L' : 'P'}){statusTag}
                </option>
              );
            })}
          </select>
          {(() => {
            const selectedTeacherObj = teachers.find((t) => t.id === teacherId);
            if (selectedTeacherObj && isPanitiaTeacher(selectedTeacherObj)) {
              return (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Guru Panitia:</strong> Guru ini memiliki catatan &apos;Panitia&apos; (siaga setiap hari sebagai pengganti darurat jika pengawas berhalangan izin).
                  </span>
                </div>
              );
            }
            return null;
          })()}
          <p className="text-[10px] text-slate-400 mt-1">
            * Guru yang nonaktif tidak dapat dipilih. Guru panitia disiagakan untuk penggantian darurat.
          </p>
        </div>

        {/* Status Kehadiran */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Status Kehadiran
          </label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as 'Dijadwalkan' | 'Hadir' | 'Izin' | 'Sakit' | 'Digantikan' | 'Alpha')
            }
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="Dijadwalkan">Dijadwalkan</option>
            <option value="Hadir">Hadir</option>
            <option value="Izin">Izin (Berhalangan)</option>
            <option value="Sakit">Sakit</option>
            <option value="Digantikan">Digantikan (Oleh Guru Lain)</option>
            <option value="Alpha">Alpha (Tanpa Keterangan)</option>
          </select>
        </div>

        {/* Catatan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Catatan Tambahan
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Keterangan khusus penugasan..."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {assignment ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors"
            >
              Hapus Penugasan
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !!formError}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : assignment ? 'Perbarui Penugasan' : 'Simpan Penugasan'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
