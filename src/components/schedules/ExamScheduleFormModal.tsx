import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ExamSchedule, Subject } from '../../types/database';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  INDONESIAN_DAYS,
  getDayNameFromDate,
  isTimeOverlap,
  normalizeSession,
  getSubjectGradeLevels,
  formatGradeLevelsLabel,
  getOverlappingGrades,
} from '../../lib/scheduleHelper';
import { Calendar, Clock, BookOpen, AlertTriangle, Users, Info, CheckCircle2 } from 'lucide-react';

interface ExamScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleToEdit: ExamSchedule | null;
}

export const ExamScheduleFormModal: React.FC<ExamScheduleFormModalProps> = ({
  isOpen,
  onClose,
  scheduleToEdit,
}) => {
  const { subjects, rooms, settings, examSchedules, addExamSchedule, updateExamSchedule } = useData();
  const { success, error, warning } = useToast();

  const [examDate, setExamDate] = useState('');
  const [dayName, setDayName] = useState('Senin');
  const [subjectId, setSubjectId] = useState('');
  const [session, setSession] = useState('Sesi 1');
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [parallelInfo, setParallelInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset form values
  useEffect(() => {
    if (isOpen) {
      if (scheduleToEdit) {
        setExamDate(scheduleToEdit.exam_date);
        setDayName(scheduleToEdit.day_name || getDayNameFromDate(scheduleToEdit.exam_date));
        setSubjectId(scheduleToEdit.subject_id);
        setSession(scheduleToEdit.session || 'Sesi 1');
        setStartTime(scheduleToEdit.start_time.slice(0, 5));
        setEndTime(scheduleToEdit.end_time.slice(0, 5));
        setNotes(scheduleToEdit.notes || '');
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        setExamDate(dateStr);
        setDayName(getDayNameFromDate(dateStr));
        setSubjectId(subjects.length > 0 ? subjects[0].id : '');
        setSession('Sesi 1');
        setStartTime('07:30');
        setEndTime('09:00');
        setNotes('');
      }
      setFormError(null);
      setConflictWarning(null);
      setParallelInfo(null);
    }
  }, [isOpen, scheduleToEdit, subjects]);

  // When date changes, auto update day name
  const handleDateChange = (dateVal: string) => {
    setExamDate(dateVal);
    if (dateVal) {
      const calculatedDay = getDayNameFromDate(dateVal);
      setDayName(calculatedDay);
    }
  };

  // When subject changes, auto suggest duration if available
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (sub && sub.default_duration && startTime) {
      const [h, m] = startTime.split(':').map(Number);
      const totalStartMin = h * 60 + m;
      const totalEndMin = totalStartMin + sub.default_duration;
      const endH = Math.floor(totalEndMin / 60) % 24;
      const endM = totalEndMin % 60;
      setEndTime(
        `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
      );
    }
  };

  // Check for conflicts on date & time/session considering grade levels
  useEffect(() => {
    if (!examDate || !startTime || !endTime) {
      setConflictWarning(null);
      setParallelInfo(null);
      return;
    }

    const currentSubject = subjects.find((s) => s.id === subjectId);
    const normSession = normalizeSession(session).toLowerCase();
    const otherSchedules = examSchedules.filter(
      (es) => !scheduleToEdit || es.id !== scheduleToEdit.id
    );

    const sameDateSchedules = otherSchedules.filter((es) => es.exam_date === examDate);

    // Find concurrent schedules (either exact same session or overlapping time)
    const concurrentSchedules = sameDateSchedules.filter((es) => {
      const sameSession = normalizeSession(es.session).toLowerCase() === normSession;
      const timeOverlap = isTimeOverlap(startTime, endTime, es.start_time, es.end_time);
      return sameSession || timeOverlap;
    });

    if (concurrentSchedules.length === 0) {
      setConflictWarning(null);
      setParallelInfo(null);
      return;
    }

    // Check each concurrent schedule for grade level overlap
    const clashingSchedules: {
      schedule: ExamSchedule;
      subject?: Subject;
      clashingGrades: string[];
    }[] = [];

    const nonClashingParallelSchedules: {
      schedule: ExamSchedule;
      subject?: Subject;
      grades: string[];
    }[] = [];

    concurrentSchedules.forEach((cs) => {
      const otherSub = subjects.find((s) => s.id === cs.subject_id);
      const overlap = getOverlappingGrades(currentSubject, otherSub);
      if (overlap.length > 0) {
        clashingSchedules.push({
          schedule: cs,
          subject: otherSub,
          clashingGrades: overlap,
        });
      } else {
        nonClashingParallelSchedules.push({
          schedule: cs,
          subject: otherSub,
          grades: getSubjectGradeLevels(otherSub),
        });
      }
    });

    if (clashingSchedules.length > 0) {
      const first = clashingSchedules[0];
      setConflictWarning(
        `Perhatian Bentrok: Jadwal ini bertabrakan pada tingkatan ${formatGradeLevelsLabel(first.clashingGrades)} dengan jadwal "${first.subject?.name || 'Mapel'}" (${first.schedule.session}, ${first.schedule.start_time.slice(0, 5)} - ${first.schedule.end_time.slice(0, 5)}).`
      );
      setParallelInfo(null);
    } else if (nonClashingParallelSchedules.length > 0) {
      const parallelSummary = nonClashingParallelSchedules
        .map((p) => `"${p.subject?.name || 'Mapel'}" (${formatGradeLevelsLabel(p.grades)})`)
        .join(', ');
      setConflictWarning(null);
      setParallelInfo(
        `Jadwal Bersamaan (Paralel): Pada sesi/jam ini juga terdapat ujian ${parallelSummary}. Jadwal ini diizinkan dan TIDAK bentrok karena tingkatan kelas murid berbeda.`
      );
    } else {
      setConflictWarning(null);
      setParallelInfo(null);
    }
  }, [examDate, session, startTime, endTime, subjectId, examSchedules, scheduleToEdit, subjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate) {
      setFormError('Tanggal pelaksanaan ujian wajib diisi');
      return;
    }
    if (!subjectId) {
      setFormError('Mata pelajaran wajib dipilih dari daftar');
      return;
    }
    if (startTime >= endTime) {
      setFormError('Jam mulai ujian harus lebih awal dari jam selesai');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const formattedStartTime = startTime.length === 5 ? `${startTime}:00` : startTime;
      const formattedEndTime = endTime.length === 5 ? `${endTime}:00` : endTime;
      const normalizedSessionLabel = normalizeSession(session);

      if (scheduleToEdit) {
        const res = await updateExamSchedule(scheduleToEdit.id, {
          exam_date: examDate,
          day_name: dayName,
          subject_id: subjectId,
          start_time: formattedStartTime,
          end_time: formattedEndTime,
          session: normalizedSessionLabel,
          notes: notes.trim() || null,
        });

        if (!res.success) throw new Error(res.error || 'Gagal memperbarui jadwal');
        success('Jadwal ujian berhasil diperbarui');
      } else {
        const res = await addExamSchedule({
          exam_date: examDate,
          day_name: dayName,
          subject_id: subjectId,
          start_time: formattedStartTime,
          end_time: formattedEndTime,
          session: normalizedSessionLabel,
          notes: notes.trim() || null,
        });

        if (!res.success) throw new Error(res.error || 'Gagal menambahkan jadwal baru');
        success('Jadwal ujian baru berhasil dibuat');
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      setFormError(msg);
      error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const activeRoomsCount = rooms.filter((r) => r.active).length;
  const invigilatorsPerRoom = settings.default_invigilators_per_room || 2;
  const totalNeeds = activeRoomsCount * invigilatorsPerRoom;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={scheduleToEdit ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian Baru'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {conflictWarning && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>{conflictWarning}</span>
          </div>
        )}

        {parallelInfo && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Info Sesi Paralel: </span>
              <span>{parallelInfo}</span>
            </div>
          </div>
        )}

        {/* Tanggal & Hari */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tanggal Ujian <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Hari akan otomatis dihitung dari tanggal
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Hari Pelaksanaan <span className="text-rose-500">*</span>
            </label>
            <select
              value={dayName}
              onChange={(e) => setDayName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white font-medium"
            >
              {INDONESIAN_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Otomatis terisi: <span className="font-semibold text-slate-600">{dayName}</span>
            </p>
          </div>
        </div>

        {/* Mata Pelajaran */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Mata Pelajaran <span className="text-rose-500">*</span>
          </label>
          <select
            required
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white font-medium"
          >
            <option value="">-- Pilih Mata Pelajaran --</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code}) - {formatGradeLevelsLabel(getSubjectGradeLevels(s))}
              </option>
            ))}
          </select>
          {subjectId && (
            <div className="mt-1.5 p-2 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>
                Mata pelajaran ini berlaku untuk:{' '}
                <strong className="font-bold text-indigo-950">
                  {formatGradeLevelsLabel(
                    getSubjectGradeLevels(subjects.find((s) => s.id === subjectId))
                  )}
                </strong>{' '}
                <span className="text-slate-500">(sesuai centang di Master Mata Pelajaran)</span>
              </span>
            </div>
          )}
          {subjects.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              Belum ada mata pelajaran di Data Master. Silakan tambahkan terlebih dahulu di menu Mata Pelajaran.
            </p>
          )}
        </div>

        {/* Sesi & Jam Mulai - Selesai */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sesi Ujian <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Sesi 1"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Jam Mulai <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Jam Selesai <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>
        </div>

        {/* Invigilator need preview card */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold">Kebutuhan Pengawas Sesi Ini:</span>
              <span className="ml-1 text-slate-600">
                {activeRoomsCount} Ruang Aktif × {invigilatorsPerRoom} Pengawas
              </span>
            </div>
          </div>
          <span className="font-mono font-black text-blue-700 text-sm px-2.5 py-0.5 bg-white rounded-lg border border-blue-200 shadow-2xs">
            {totalNeeds} Pengawas
          </span>
        </div>

        {/* Catatan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Catatan Pelaksanaan (Opsional)
          </label>
          <textarea
            rows={2}
            placeholder="Contoh: Siswa membawa lembar jawaban komputer & pensil 2B..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {submitting
              ? 'Menyimpan...'
              : scheduleToEdit
              ? 'Perbarui Jadwal Ujian'
              : 'Simpan Jadwal Ujian'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
