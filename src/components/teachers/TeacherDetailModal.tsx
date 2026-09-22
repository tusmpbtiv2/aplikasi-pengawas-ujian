import React from 'react';
import { Teacher } from '../../types/database';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { isPanitiaTeacher } from '../../lib/invigilatorHelper';
import {
  User,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Building2,
  Sparkles,
} from 'lucide-react';

interface TeacherDetailModalProps {
  teacher: Teacher | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (teacher: Teacher) => void;
}

export const TeacherDetailModal: React.FC<TeacherDetailModalProps> = ({
  teacher,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { invigilatorSchedules, examSchedules, rooms } = useData();

  if (!teacher) return null;

  // Find all assignments for this teacher
  const assignments = invigilatorSchedules
    .filter((inv) => inv.teacher_id === teacher.id)
    .map((inv) => {
      const exam = examSchedules.find((es) => es.id === inv.exam_schedule_id);
      const room = rooms.find((r) => r.id === inv.room_id);
      return {
        ...inv,
        exam,
        room,
      };
    });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Profil Guru" maxWidth="2xl">
      <div className="space-y-6">
        {/* Header Profile Badge */}
        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
            {teacher.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">{teacher.name}</h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  teacher.active
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {teacher.active ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Aktif
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    Nonaktif
                  </>
                )}
              </span>
              {isPanitiaTeacher(teacher) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Panitia Ujian (Standby Pengganti)
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Kode Pengawas: <strong className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{teacher.invigilator_code || teacher.employee_number || '-'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Jenis Kelamin: <strong>{teacher.gender}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Hari Ketersediaan Mengawas */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            Hari Ketersediaan Mengawas Ujian
          </h4>
          {isPanitiaTeacher(teacher) ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Tersedia Setiap Hari (Standby Pengganti Panitia)
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Karena memiliki catatan <strong>&apos;Panitia&apos;</strong>, guru ini disiagakan setiap hari di sekolah sebagai opsi guru pengganti darurat jika ada pengawas yang mendadak izin/berhalangan.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {teacher.available_days && teacher.available_days.length > 0 ? (
                teacher.available_days.map((day) => (
                  <span
                    key={day}
                    className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-lg text-xs font-medium"
                  >
                    {day}
                  </span>
                ))
              ) : (
                <span className="text-xs text-rose-500 italic">Belum ada hari yang dipilih</span>
              )}
            </div>
          )}
        </div>

        {/* Catatan */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-500" />
            Catatan Tambahan
          </h4>
          <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
            {teacher.notes || 'Tidak ada catatan khusus.'}
          </p>
        </div>

        {/* Riwayat / Jadwal Penugasan Mengawas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Jadwal Penugasan Mengawas ({assignments.length} Sesi)
            </h4>
          </div>

          {assignments.length > 0 ? (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {assignments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-800">
                      {item.exam?.subject?.name || 'Ujian'} &bull; {item.exam?.day_name},{' '}
                      {item.exam?.exam_date}
                    </div>
                    <div className="text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.exam?.session} ({item.exam?.start_time.substring(0, 5)} -{' '}
                        {item.exam?.end_time.substring(0, 5)})
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {item.room?.name || 'Ruang'} ({item.room?.code})
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    {item.role}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs">
              {isPanitiaTeacher(teacher) ? (
                <div className="text-amber-800 space-y-1">
                  <p className="font-semibold">Guru ini berstatus Panitia Ujian (Standby Pengganti)</p>
                  <p className="text-[11px] text-amber-700/80">
                    Sesuai ketentuan, panitia tidak diberikan jadwal mengawas pasti otomatis agar selalu siaga setiap hari untuk menggantikan pengawas yang mendadak izin.
                  </p>
                </div>
              ) : (
                <p className="text-slate-400">Guru ini belum memiliki penugasan jadwal mengawas ruang ujian.</p>
              )}
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Tutup
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(teacher);
              }}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
            >
              Ubah Data Guru
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
