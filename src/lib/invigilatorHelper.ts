import {
  ExamSchedule,
  Room,
  Teacher,
  InvigilatorSchedule,
  Building,
  ConflictDetail,
} from '../types/database';
import { exportToSpreadsheet } from './excelHelper';
import { formatIndonesianDate, formatGradeLevelsLabel, getSubjectGradeLevels } from './scheduleHelper';

export interface GenerateConfig {
  examScheduleIds: string[]; // 'ALL' or specific IDs
  buildingIds: string[]; // 'ALL' or specific IDs
  roomIds: string[]; // 'ALL' or specific IDs
  overwriteExisting: boolean;
  respectAvailability: boolean;
  balanceWorkload: boolean;
  avoidConsecutiveSameRoom: boolean;
  noBuildingHopping?: boolean; // Guru tidak pindah gedung pada hari yang sama
  consistentSessionsSameRoom?: boolean; // Guru tetap di ruangan yang sama pada seluruh sesi di hari yang sama
  rotateRoomsDaily?: boolean; // Setiap hari mengawasi ruang yang berbeda
  assignReserve: boolean;
  reserveCountPerSession: number;
}

export interface TeacherWorkloadStat {
  teacherId: string;
  teacherName: string;
  employeeNumber?: string | null;
  gender: 'Laki-laki' | 'Perempuan';
  active: boolean;
  availableDays: string[];
  totalAssigned: number;
  assignedDays: { [day: string]: number };
  assignedSessions: { [sessionKey: string]: number };
  roles: { [role: string]: number };
  isPanitia?: boolean;
  notes?: string | null;
}

/**
 * Memeriksa apakah seorang guru bertindak sebagai Panitia (Standby Pengganti).
 * Dideteksi dari kolom catatan (notes) yang mengandung kata "panitia" (case-insensitive).
 * Sesuai aturan:
 * - Tidak diberikan jadwal pengawas pasti saat generate otomatis.
 * - Tersedia setiap hari di sekolah untuk menjadi opsi guru pengganti jika ada pengawas mendadak berhalangan/izin.
 */
export const isPanitiaTeacher = (teacher?: { notes?: string | null } | null): boolean => {
  if (!teacher || !teacher.notes) return false;
  return teacher.notes.toLowerCase().includes('panitia');
};

export interface GenerationResult {
  newAssignments: Omit<InvigilatorSchedule, 'id' | 'created_at' | 'updated_at' | 'exam_schedule' | 'room' | 'teacher'>[];
  totalSessions: number;
  totalRooms: number;
  totalRequired: number;
  totalAssigned: number;
  totalUnassigned: number;
  uniqueTeachersUsed: number;
  teacherWorkloads: TeacherWorkloadStat[];
  maxLoadedTeacher: { name: string; count: number } | null;
  minLoadedTeacher: { name: string; count: number } | null;
  conflicts: ConflictDetail[];
  warnings: string[];
}

/**
 * Grouped view representation of a single Exam Schedule + Room slot
 */
export interface ExamRoomSlot {
  key: string;
  examSchedule: ExamSchedule;
  allExamSchedules?: ExamSchedule[];
  subjectDisplay?: string;
  room: Room;
  building?: Building;
  invigilators: (InvigilatorSchedule | undefined)[];
  reserveInvigilators: InvigilatorSchedule[];
  isComplete: boolean;
  statusText: string;
  hasConflict: boolean;
  conflictMessages: string[];
}

/**
 * Run deterministic, fair invigilator scheduling algorithm
 */
export const runAutoScheduler = (
  examSchedules: ExamSchedule[],
  rooms: Room[],
  teachers: Teacher[],
  existingAssignments: InvigilatorSchedule[],
  config: GenerateConfig,
  invigilatorsPerRoom: number = 2
): GenerationResult => {
  // 1. Filter target exam schedules
  const targetExams = examSchedules
    .filter((es) => config.examScheduleIds.includes('ALL') || config.examScheduleIds.includes(es.id))
    .sort((a, b) => {
      if (a.exam_date !== b.exam_date) return a.exam_date.localeCompare(b.exam_date);
      return a.start_time.localeCompare(b.start_time);
    });

  // 2. Filter target rooms
  const targetRooms = rooms
    .filter((r) => r.active)
    .filter((r) => config.buildingIds.includes('ALL') || config.buildingIds.includes(r.building_id))
    .filter((r) => config.roomIds.includes('ALL') || config.roomIds.includes(r.id))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  // 3. Filter active teachers
  const activeTeachers = teachers.filter((t) => t.active);
  // Guru panitia (catatan mengandung 'panitia') tidak mendapatkan jadwal pengawas pasti
  // Mereka disiagakan setiap hari sebagai opsi guru pengganti darurat jika ada pengawas berhalangan
  const regularTeachers = activeTeachers.filter((t) => !isPanitiaTeacher(t));
  const candidatePool = regularTeachers.length > 0 ? regularTeachers : activeTeachers;

  // Initialize teacher load tracking
  const loadMap = new Map<string, TeacherWorkloadStat>();
  teachers.forEach((t) => {
    loadMap.set(t.id, {
      teacherId: t.id,
      teacherName: t.name,
      employeeNumber: t.employee_number,
      gender: t.gender,
      active: t.active,
      availableDays: isPanitiaTeacher(t)
        ? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        : t.available_days || [],
      totalAssigned: 0,
      assignedDays: {},
      assignedSessions: {},
      roles: {},
      isPanitia: isPanitiaTeacher(t),
      notes: t.notes,
    });
  });

  // Pre-fill loadMap with preserved existing assignments if not overwriting
  const keptAssignments: InvigilatorSchedule[] = [];
  if (!config.overwriteExisting) {
    existingAssignments.forEach((inv) => {
      const isTarget =
        targetExams.some((e) => e.id === inv.exam_schedule_id) &&
        targetRooms.some((r) => r.id === inv.room_id);

      if (isTarget) {
        keptAssignments.push(inv);
        if (inv.teacher_id && loadMap.has(inv.teacher_id)) {
          const stat = loadMap.get(inv.teacher_id)!;
          stat.totalAssigned += 1;
          const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
          if (exam) {
            stat.assignedDays[exam.day_name] = (stat.assignedDays[exam.day_name] || 0) + 1;
            const sKey = `${exam.exam_date}_${exam.session}`;
            stat.assignedSessions[sKey] = (stat.assignedSessions[sKey] || 0) + 1;
          }
          stat.roles[inv.role] = (stat.roles[inv.role] || 0) + 1;
        }
      }
    });
  }

  const newAssignments: Omit<InvigilatorSchedule, 'id' | 'created_at' | 'updated_at' | 'exam_schedule' | 'room' | 'teacher'>[] = [];
  const warnings: string[] = [];
  const conflicts: ConflictDetail[] = [];

  // Track session occupancy: sessionKey -> Set of teacherIds currently working in that session
  const sessionOccupancy = new Map<string, Set<string>>();
  // Track previous room for each teacher to avoid consecutive same rooms
  const teacherLastRoom = new Map<string, string>();

  // Room to building mapping
  const roomBuildingMap = new Map<string, string>();
  rooms.forEach((r) => roomBuildingMap.set(r.id, r.building_id));

  // Daily tracking per teacher
  // teacherId -> date -> buildingId
  const teacherDayBuildings = new Map<string, Map<string, string>>();
  // teacherId -> date -> roomId
  const teacherDayRooms = new Map<string, Map<string, string>>();
  // teacherId -> roomId -> Set of dates (to ensure daily room rotation across different dates)
  const teacherRoomAssignedDates = new Map<string, Map<string, Set<string>>>();
  // date -> roomId -> role -> teacherId (for consistent session matching)
  const roomDayRoleTeacher = new Map<string, Map<string, Map<string, string>>>();

  const recordDailyAssignment = (teacherId: string, date: string, roomId: string, role: string) => {
    const buildingId = roomBuildingMap.get(roomId);
    if (buildingId) {
      if (!teacherDayBuildings.has(teacherId)) teacherDayBuildings.set(teacherId, new Map());
      teacherDayBuildings.get(teacherId)!.set(date, buildingId);
    }

    if (!teacherDayRooms.has(teacherId)) teacherDayRooms.set(teacherId, new Map());
    teacherDayRooms.get(teacherId)!.set(date, roomId);

    if (!teacherRoomAssignedDates.has(teacherId)) teacherRoomAssignedDates.set(teacherId, new Map());
    const teacherRooms = teacherRoomAssignedDates.get(teacherId)!;
    if (!teacherRooms.has(roomId)) teacherRooms.set(roomId, new Set());
    teacherRooms.get(roomId)!.add(date);

    if (!roomDayRoleTeacher.has(date)) roomDayRoleTeacher.set(date, new Map());
    const dateMap = roomDayRoleTeacher.get(date)!;
    if (!dateMap.has(roomId)) dateMap.set(roomId, new Map());
    dateMap.get(roomId)!.set(role, teacherId);
  };

  // If keeping assignments, initialize session occupancy & daily tracking
  keptAssignments.forEach((inv) => {
    if (inv.teacher_id) {
      const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
      if (exam) {
        const sessionKey = `${exam.exam_date}_${exam.session}`;
        if (!sessionOccupancy.has(sessionKey)) {
          sessionOccupancy.set(sessionKey, new Set());
        }
        sessionOccupancy.get(sessionKey)!.add(inv.teacher_id);
        recordDailyAssignment(inv.teacher_id, exam.exam_date, inv.room_id, inv.role);
      }
    }
  });

  let totalRequiredSlots = 0;
  let totalAssignedSlots = keptAssignments.filter((a) => !!a.teacher_id).length;
  let totalUnassignedSlots = 0;

  // Kelompokkan jadwal ujian per sesi: (tanggal + sesi)
  // Contoh kasus pengguna: Hari Sabtu Sesi 2 memiliki 2 mapel bersamaan (Prakarya kls 7, 8 dan Seni Budaya kls 9).
  // Seluruh mapel di ruangan yang sama pada sesi tersebut cukup diawasi oleh 1 pengawas yang sama,
  // sehingga tidak terjadi bentrok dan beban kerja guru dihitung 1 sesi (bukan dobel).
  const sessionGroupMap = new Map<string, ExamSchedule[]>();
  for (const exam of targetExams) {
    const sessionKey = `${exam.exam_date}_${exam.session}`;
    if (!sessionGroupMap.has(sessionKey)) {
      sessionGroupMap.set(sessionKey, []);
    }
    sessionGroupMap.get(sessionKey)!.push(exam);
  }

  // Process session by session, room by room
  for (const [sessionKey, examsInSession] of sessionGroupMap.entries()) {
    const primaryExam = examsInSession[0];
    const examIdsInSession = examsInSession.map((e) => e.id);
    const multiSubjectLabel = examsInSession.length > 1
      ? ` (${examsInSession.map((e) => e.subject?.name || 'Mapel').join(' + ')})`
      : '';

    if (!sessionOccupancy.has(sessionKey)) {
      sessionOccupancy.set(sessionKey, new Set());
    }
    const currentSessionBusy = sessionOccupancy.get(sessionKey)!;

    for (const room of targetRooms) {
      const rolesNeeded: ('Pengawas 1' | 'Pengawas 2' | 'Cadangan')[] = [];
      for (let i = 1; i <= invigilatorsPerRoom; i++) {
        rolesNeeded.push(i === 1 ? 'Pengawas 1' : 'Pengawas 2');
      }

      totalRequiredSlots += rolesNeeded.length;

      // Track teachers in this room slot to prevent assigning same teacher twice in same room
      const roomAssignedTeacherIds = new Set<string>();

      for (let roleIndex = 0; roleIndex < rolesNeeded.length; roleIndex++) {
        const role = rolesNeeded[roleIndex];

        // Check if kept assignment exists in any of the exam schedules in this session
        if (!config.overwriteExisting) {
          const existing = keptAssignments.find(
            (k) => examIdsInSession.includes(k.exam_schedule_id) && k.room_id === room.id && k.role === role
          );
          if (existing && existing.teacher_id) {
            roomAssignedTeacherIds.add(existing.teacher_id);
            continue; // Already assigned
          }
        }

        // Check for priority teacher (consistent room across sessions on same day)
        let selectedTeacher: Teacher | null = null;
        if (config.consistentSessionsSameRoom) {
          const sameDaySameRoomTeacherId = roomDayRoleTeacher.get(primaryExam.exam_date)?.get(room.id)?.get(role);
          if (sameDaySameRoomTeacherId) {
            const matchedTeacher = candidatePool.find((t) => t.id === sameDaySameRoomTeacherId);
            if (
              matchedTeacher &&
              !currentSessionBusy.has(matchedTeacher.id) &&
              !roomAssignedTeacherIds.has(matchedTeacher.id) &&
              (!config.respectAvailability || (matchedTeacher.available_days || []).includes(primaryExam.day_name))
            ) {
              selectedTeacher = matchedTeacher;
            }
          }
        }

        if (!selectedTeacher) {
          // Find best eligible teacher from regular candidate pool (excluding panitia)
          let candidates = candidatePool.filter((t) => {
            // 1. Not already busy in this exam session
            if (currentSessionBusy.has(t.id)) return false;
            // 2. Not already assigned in this specific room
            if (roomAssignedTeacherIds.has(t.id)) return false;

            // 3. Respect availability day
            if (config.respectAvailability) {
              const days = t.available_days || [];
              if (!days.includes(primaryExam.day_name)) return false;
            }

            return true;
          });

          // Apply constraint: No building hopping on the same day
          if (config.noBuildingHopping && candidates.length > 0) {
            const candidatesNoHop = candidates.filter((t) => {
              const assignedBuilding = teacherDayBuildings.get(t.id)?.get(primaryExam.exam_date);
              return !assignedBuilding || assignedBuilding === room.building_id;
            });
            if (candidatesNoHop.length > 0) {
              candidates = candidatesNoHop;
            }
          }

          // Apply constraint: Setiap hari mengawasi ruang yang berbeda (Rotasi harian)
          if (config.rotateRoomsDaily && candidates.length > 1) {
            const candidatesDifferentRoom = candidates.filter((t) => {
              const assignedDatesForThisRoom = teacherRoomAssignedDates.get(t.id)?.get(room.id);
              if (!assignedDatesForThisRoom || assignedDatesForThisRoom.size === 0) return true;
              // Avoid if assigned to this room on a DIFFERENT date
              const hasSupervisedOnOtherDate = Array.from(assignedDatesForThisRoom).some((d) => d !== primaryExam.exam_date);
              return !hasSupervisedOnOtherDate;
            });
            if (candidatesDifferentRoom.length > 0) {
              candidates = candidatesDifferentRoom;
            }
          }

          if (candidates.length === 0) {
            // Fallback if strict availability caused shortage, or true shortage
            totalUnassignedSlots += 1;
            for (const exam of examsInSession) {
              newAssignments.push({
                exam_schedule_id: exam.id,
                room_id: room.id,
                teacher_id: null,
                role,
                status: 'Dijadwalkan',
                notes: 'Belum ada guru tersedia',
              });
            }
            continue;
          }

          // Score candidates based on workload, daily load, room variety, and consistency
          candidates.sort((a, b) => {
            // Consistent room preference
            if (config.consistentSessionsSameRoom) {
              const roomTodayA = teacherDayRooms.get(a.id)?.get(primaryExam.exam_date);
              const roomTodayB = teacherDayRooms.get(b.id)?.get(primaryExam.exam_date);
              const scoreA = roomTodayA === room.id ? -10 : roomTodayA ? 5 : 0;
              const scoreB = roomTodayB === room.id ? -10 : roomTodayB ? 5 : 0;
              if (scoreA !== scoreB) return scoreA - scoreB;
            }

            const loadA = loadMap.get(a.id)?.totalAssigned || 0;
            const loadB = loadMap.get(b.id)?.totalAssigned || 0;

            if (config.balanceWorkload && loadA !== loadB) {
              return loadA - loadB;
            }

            // Spread out across the same day
            const dayLoadA = loadMap.get(a.id)?.assignedDays[primaryExam.day_name] || 0;
            const dayLoadB = loadMap.get(b.id)?.assignedDays[primaryExam.day_name] || 0;
            if (dayLoadA !== dayLoadB) {
              return dayLoadA - dayLoadB;
            }

            // Avoid consecutive same room if consistentSessionsSameRoom is not forced
            if (config.avoidConsecutiveSameRoom && !config.consistentSessionsSameRoom) {
              const lastRoomA = teacherLastRoom.get(a.id);
              const lastRoomB = teacherLastRoom.get(b.id);
              const penaltyA = lastRoomA === room.id ? 1 : 0;
              const penaltyB = lastRoomB === room.id ? 1 : 0;
              if (penaltyA !== penaltyB) return penaltyA - penaltyB;
            }

            // Rotate rooms daily: prefer candidates who haven't been assigned to this room on other days
            if (config.rotateRoomsDaily) {
              const datesA = teacherRoomAssignedDates.get(a.id)?.get(room.id);
              const datesB = teacherRoomAssignedDates.get(b.id)?.get(room.id);
              const otherDaysCountA = datesA ? Array.from(datesA).filter((d) => d !== primaryExam.exam_date).length : 0;
              const otherDaysCountB = datesB ? Array.from(datesB).filter((d) => d !== primaryExam.exam_date).length : 0;
              if (otherDaysCountA !== otherDaysCountB) {
                return otherDaysCountA - otherDaysCountB;
              }
            }

            // Deterministic tie-breaker
            return a.name.localeCompare(b.name);
          });

          selectedTeacher = candidates[0];
        }

        // Assign teacher
        currentSessionBusy.add(selectedTeacher.id);
        roomAssignedTeacherIds.add(selectedTeacher.id);
        teacherLastRoom.set(selectedTeacher.id, room.id);
        recordDailyAssignment(selectedTeacher.id, primaryExam.exam_date, room.id, role);

        // Update workload (Dihitung 1 kali per sesi ruangan)
        const stat = loadMap.get(selectedTeacher.id)!;
        stat.totalAssigned += 1;
        stat.assignedDays[primaryExam.day_name] = (stat.assignedDays[primaryExam.day_name] || 0) + 1;
        stat.assignedSessions[sessionKey] = (stat.assignedSessions[sessionKey] || 0) + 1;
        stat.roles[role] = (stat.roles[role] || 0) + 1;

        totalAssignedSlots += 1;

        // Assign the same teacher to all exams happening in this session and room
        for (const exam of examsInSession) {
          newAssignments.push({
            exam_schedule_id: exam.id,
            room_id: room.id,
            teacher_id: selectedTeacher.id,
            role,
            status: 'Dijadwalkan',
            notes: examsInSession.length > 1
              ? `Otomatis ditugaskan sebagai ${role}${multiSubjectLabel}`
              : `Otomatis ditugaskan sebagai ${role}`,
          });
        }
      }
    }

    // Reserve invigilators per session if requested
    if (config.assignReserve && config.reserveCountPerSession > 0 && targetRooms.length > 0) {
      const primaryRoom = targetRooms[0];
      for (let rIdx = 0; rIdx < config.reserveCountPerSession; rIdx++) {
        const reserveCandidates = candidatePool.filter((t) => {
          if (currentSessionBusy.has(t.id)) return false;
          if (config.respectAvailability && !t.available_days.includes(primaryExam.day_name)) return false;
          return true;
        });

        if (reserveCandidates.length > 0) {
          reserveCandidates.sort((a, b) => {
            const loadA = loadMap.get(a.id)?.totalAssigned || 0;
            const loadB = loadMap.get(b.id)?.totalAssigned || 0;
            return loadA - loadB;
          });

          const reserveTeacher = reserveCandidates[0];
          currentSessionBusy.add(reserveTeacher.id);

          const stat = loadMap.get(reserveTeacher.id)!;
          stat.totalAssigned += 1;
          stat.assignedDays[primaryExam.day_name] = (stat.assignedDays[primaryExam.day_name] || 0) + 1;
          stat.roles['Cadangan'] = (stat.roles['Cadangan'] || 0) + 1;

          for (const exam of examsInSession) {
            newAssignments.push({
              exam_schedule_id: exam.id,
              room_id: primaryRoom.id,
              teacher_id: reserveTeacher.id,
              role: 'Cadangan',
              status: 'Dijadwalkan',
              notes: `Pengawas Cadangan Sesi ${primaryExam.session}${multiSubjectLabel}`,
            });
          }
        }
      }
    }
  }

  // Workload array and extremes
  const workloads = Array.from(loadMap.values()).filter((w) => w.active);
  workloads.sort((a, b) => b.totalAssigned - a.totalAssigned);

  const assignedTeachers = workloads.filter((w) => w.totalAssigned > 0);
  const maxLoadedTeacher = assignedTeachers.length > 0 ? { name: assignedTeachers[0].teacherName, count: assignedTeachers[0].totalAssigned } : null;
  const minLoadedTeacher = assignedTeachers.length > 0 ? { name: assignedTeachers[assignedTeachers.length - 1].teacherName, count: assignedTeachers[assignedTeachers.length - 1].totalAssigned } : null;

  if (totalUnassignedSlots > 0) {
    warnings.push(
      `Terdapat ${totalUnassignedSlots} slot pengawas yang belum dapat terisi karena keterbatasan jumlah guru atau jadwal ketersediaan hari.`
    );
  }

  return {
    newAssignments,
    totalSessions: targetExams.length,
    totalRooms: targetRooms.length,
    totalRequired: totalRequiredSlots,
    totalAssigned: totalAssignedSlots,
    totalUnassigned: totalUnassignedSlots,
    uniqueTeachersUsed: assignedTeachers.length,
    teacherWorkloads: workloads,
    maxLoadedTeacher,
    minLoadedTeacher,
    conflicts,
    warnings,
  };
};

/**
 * Validate teacher assignment for manual operations
 */
export const validateAssignment = (
  teacherId: string | null | undefined,
  examScheduleId: string,
  roomId: string,
  teachers: Teacher[],
  examSchedules: ExamSchedule[],
  existingAssignments: InvigilatorSchedule[],
  currentAssignmentId?: string
): { isValid: boolean; error?: string; warning?: string } => {
  if (!teacherId) {
    return { isValid: true };
  }

  const teacher = teachers.find((t) => t.id === teacherId);
  const exam = examSchedules.find((e) => e.id === examScheduleId);

  if (!teacher) {
    return { isValid: false, error: 'Guru tidak ditemukan di database' };
  }

  if (!teacher.active) {
    return { isValid: false, error: `Guru ${teacher.name} saat ini berstatus Tidak Aktif.` };
  }

  if (!exam) {
    return { isValid: false, error: 'Jadwal ujian tidak valid' };
  }

  // Double booking check: same teacher at the same exam date & session in a DIFFERENT room
  const doubleBooking = existingAssignments.find((inv) => {
    if (inv.id === currentAssignmentId) return false;
    if (inv.teacher_id !== teacherId) return false;
    const otherExam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
    if (!otherExam) return false;
    const isSameSession = otherExam.exam_date === exam.exam_date && otherExam.session === exam.session;
    if (!isSameSession) return false;

    // Jika di ruangan yang sama (misal ada mapel bersamaan di sesi tsb seperti Prakarya & Seni Budaya),
    // ini sah dan cukup diawasi 1 pengawas yang sama.
    if (inv.room_id === roomId) return false;

    return true;
  });

  if (doubleBooking) {
    return {
      isValid: false,
      error: `Guru ${teacher.name} sudah terjadwal mengawas di ruangan lain pada sesi yang sama (${exam.exam_date} - ${exam.session}).`,
    };
  }

  // Availability day warning: panitia is available every day as standby
  let warning: string | undefined;
  if (isPanitiaTeacher(teacher)) {
    warning = `Informasi: Guru ${teacher.name} berstatus Panitia Ujian (Standby Pengganti). Tersedia setiap hari untuk penggantian darurat.`;
  } else if (teacher.available_days && !teacher.available_days.includes(exam.day_name)) {
    warning = `Perhatian: Hari ${exam.day_name} tidak ada dalam daftar ketersediaan mengawas Guru ${teacher.name}.`;
  }

  return { isValid: true, warning };
};

/**
 * Group flat assignments into Room-Exam slots for tabular view
 */
export const groupAssignmentsByExamAndRoom = (
  examSchedules: ExamSchedule[],
  rooms: Room[],
  buildings: Building[],
  invigilatorSchedules: InvigilatorSchedule[],
  conflicts: ConflictDetail[],
  invigilatorsPerRoom: number = 2
): ExamRoomSlot[] => {
  const slots: ExamRoomSlot[] = [];

  // Kelompokkan jadwal ujian berdasarkan tanggal dan sesi
  // Misal: Hari Sabtu Sesi 2 ada Prakarya (kls 7 & 9) dan Seni Budaya (kls 9) -> disatukan dalam 1 slot per ruangan!
  const sessionGroupMap = new Map<string, ExamSchedule[]>();
  examSchedules.forEach((exam) => {
    const sKey = `${exam.exam_date}_${exam.session}`;
    if (!sessionGroupMap.has(sKey)) sessionGroupMap.set(sKey, []);
    sessionGroupMap.get(sKey)!.push(exam);
  });

  sessionGroupMap.forEach((examsInSession, sKey) => {
    const primaryExam = examsInSession[0];
    const examIdsInSession = new Set(examsInSession.map((e) => e.id));
    const activeRooms = rooms.filter((r) => r.active);

    // Bangun tampilan nama mata pelajaran dengan tingkatan kelasnya
    const subjectDisplay = examsInSession
      .map((e) => {
        const subName = e.subject?.name || 'Mata Pelajaran';
        const grades = getSubjectGradeLevels(e.subject);
        return `${subName} (${formatGradeLevelsLabel(grades)})`;
      })
      .join(' + ');

    activeRooms.forEach((room) => {
      const building = buildings.find((b) => b.id === room.building_id);

      // Cari penugasan pengawas untuk ruangan ini pada seluruh jadwal ujian di sesi ini
      const assignments = invigilatorSchedules.filter(
        (inv) => examIdsInSession.has(inv.exam_schedule_id) && inv.room_id === room.id
      );

      const invigilators: (InvigilatorSchedule | undefined)[] = [];
      for (let i = 1; i <= invigilatorsPerRoom; i++) {
        const role = i === 1 ? 'Pengawas 1' : 'Pengawas 2';
        // Ambil penugasan yang memiliki guru, atau penugasan pertama jika belum ada guru
        const found =
          assignments.find((a) => a.role === role && !!a.teacher_id) ||
          assignments.find((a) => a.role === role);
        invigilators.push(found);
      }

      // Cari cadangan pada sesi ini untuk ruangan utama
      const reserveMap = new Map<string, InvigilatorSchedule>();
      assignments
        .filter((a) => a.role === 'Cadangan')
        .forEach((a) => {
          if (a.teacher_id && !reserveMap.has(a.teacher_id)) {
            reserveMap.set(a.teacher_id, a);
          } else if (!a.teacher_id && !reserveMap.has('unassigned')) {
            reserveMap.set('unassigned', a);
          }
        });
      const reserveInvigilators = Array.from(reserveMap.values());

      const filledCount = invigilators.filter((inv) => !!inv?.teacher_id).length;
      const isComplete = filledCount >= invigilatorsPerRoom;

      let statusText = 'Belum Diisi';
      if (isComplete) {
        statusText = 'Lengkap';
      } else if (filledCount > 0) {
        statusText = `Kurang ${invigilatorsPerRoom - filledCount} Pengawas`;
      }

      // Deteksi konflik relevan untuk slot ini
      const relevantConflicts = conflicts.filter(
        (c) =>
          c.room_id === room.id &&
          (examIdsInSession.has(c.exam_schedule_id || '') || c.id.includes(sKey))
      );
      const conflictMessages = Array.from(new Set(relevantConflicts.map((c) => c.description)));

      slots.push({
        key: `${sKey}_${room.id}`,
        examSchedule: primaryExam,
        allExamSchedules: examsInSession,
        subjectDisplay,
        room,
        building,
        invigilators,
        reserveInvigilators,
        isComplete,
        statusText,
        hasConflict: conflictMessages.length > 0,
        conflictMessages,
      });
    });
  });

  // Urutkan slot berdasarkan tanggal, sesi/waktu mulai, dan nomor ruangan
  slots.sort((a, b) => {
    if (a.examSchedule.exam_date !== b.examSchedule.exam_date) {
      return a.examSchedule.exam_date.localeCompare(b.examSchedule.exam_date);
    }
    const timeCmp = (a.examSchedule.start_time || '').localeCompare(b.examSchedule.start_time || '');
    if (timeCmp !== 0) return timeCmp;
    return a.room.code.localeCompare(b.room.code, undefined, { numeric: true });
  });

  return slots;
};

/**
 * Export invigilator schedules in multiple formats
 */
export const exportInvigilatorScheduleData = (
  slots: ExamRoomSlot[],
  teachers: Teacher[],
  format: 'xlsx' | 'csv' = 'xlsx'
) => {
  const rows = slots.map((slot, index) => {
    const p1 = slot.invigilators[0]?.teacher_id
      ? teachers.find((t) => t.id === slot.invigilators[0]?.teacher_id)?.name || 'Ditugaskan'
      : '-';
    const p1Status = slot.invigilators[0]?.status || '-';

    const p2 = slot.invigilators[1]?.teacher_id
      ? teachers.find((t) => t.id === slot.invigilators[1]?.teacher_id)?.name || 'Ditugaskan'
      : '-';
    const p2Status = slot.invigilators[1]?.status || '-';

    const reserve = slot.reserveInvigilators
      .map((r) => (r.teacher_id ? teachers.find((t) => t.id === r.teacher_id)?.name : ''))
      .filter(Boolean)
      .join(', ');

    return {
      No: index + 1,
      Tanggal: slot.examSchedule.exam_date,
      Hari: slot.examSchedule.day_name,
      Sesi: slot.examSchedule.session,
      Gedung: slot.building?.name || '-',
      Ruang: `${slot.room.name} (${slot.room.code})`,
      'Mata Pelajaran': slot.subjectDisplay || slot.examSchedule.subject?.name || '-',
      Jam: `${slot.examSchedule.start_time.slice(0, 5)} - ${slot.examSchedule.end_time.slice(0, 5)}`,
      'Pengawas 1': p1,
      'Status P1': p1Status,
      'Pengawas 2': p2,
      'Status P2': p2Status,
      'Cadangan': reserve || '-',
      'Status Slot': slot.statusText,
    };
  });

  exportToSpreadsheet(rows, `Jadwal_Pengawas_Ujian_${Date.now()}`, format, 'Jadwal Pengawas');
};

/**
 * Export teacher personal invigilator recap
 */
export const exportTeacherWorkloadData = (
  workloads: TeacherWorkloadStat[],
  format: 'xlsx' | 'csv' = 'xlsx'
) => {
  const rows = workloads.map((w, idx) => ({
    No: idx + 1,
    'Nama Guru': w.teacherName,
    NIP: w.employeeNumber || '-',
    'Jenis Kelamin': w.gender,
    'Total Mengawas': w.totalAssigned,
    'Hari Tersedia': w.availableDays.join(', '),
    'Hari Bertugas': Object.entries(w.assignedDays)
      .map(([day, cnt]) => `${day} (${cnt})`)
      .join('; ') || '-',
    'Status Guru': w.active ? 'Aktif' : 'Nonaktif',
  }));

  exportToSpreadsheet(rows, `Rekap_Beban_Tugas_Guru_${Date.now()}`, format, 'Beban Guru');
};

/**
 * Informasi status guru harian (guru bebas tugas/libur vs panitia vs bertugas)
 * Digunakan untuk identifikasi pengawas pengganti sebelum panitia.
 */
export interface DailyOffDutyTeacher {
  teacher: Teacher;
  isUnavailableDay: boolean; // true jika hari ujian TIDAK ADA dalam available_days guru
  reason: 'HARI_LIBUR_TIDAK_TERSEDIA' | 'BEBAS_TUGAS_HARI_INI';
  reasonLabel: string;
  totalWorkload: number;
}

export interface DailyTeachersStatusResult {
  date: string;
  dayName: string;
  offDutyTeachers: DailyOffDutyTeacher[]; // Prioritas 1: Pengawas Pengganti Sebelum Panitia
  panitiaTeachers: Teacher[]; // Prioritas 2: Standby Darurat Panitia
  assignedTeachersToday: { teacher: Teacher; assignmentCount: number; sessions: string[] }[];
  totalActiveTeachers: number;
  totalAssignedToday: number;
  totalOffDutyToday: number;
  totalPanitia: number;
}

export const getDailyTeacherStatus = (
  dateStr: string,
  teachers: Teacher[],
  invigilatorSchedules: InvigilatorSchedule[],
  examSchedules: ExamSchedule[]
): DailyTeachersStatusResult => {
  const examsOnDate = examSchedules.filter((e) => e.exam_date === dateStr);
  const dayName = examsOnDate[0]?.day_name || 'Senin';
  const examIdsOnDate = new Set(examsOnDate.map((e) => e.id));

  // Track distinct duty slots: teacherId -> Set of distinct (date_session_room) keys
  // Agar guru yang mengawasi ruangan dengan 2 mapel bersamaan (misal Prakarya & Seni Budaya) dihitung 1 sesi tugas.
  const teacherDistinctSlots = new Map<string, Set<string>>();
  const todayDistinctSlots = new Map<string, Set<string>>();
  const todaySessions = new Map<string, Set<string>>();

  invigilatorSchedules.forEach((inv) => {
    if (!inv.teacher_id) return;
    const exam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
    if (!exam) return;

    const dutyKey = `${exam.exam_date}_${exam.session}_${inv.room_id}`;
    if (!teacherDistinctSlots.has(inv.teacher_id)) {
      teacherDistinctSlots.set(inv.teacher_id, new Set());
    }
    teacherDistinctSlots.get(inv.teacher_id)!.add(dutyKey);

    if (exam.exam_date === dateStr) {
      if (!todayDistinctSlots.has(inv.teacher_id)) {
        todayDistinctSlots.set(inv.teacher_id, new Set());
      }
      todayDistinctSlots.get(inv.teacher_id)!.add(dutyKey);

      if (!todaySessions.has(inv.teacher_id)) {
        todaySessions.set(inv.teacher_id, new Set());
      }
      todaySessions.get(inv.teacher_id)!.add(exam.session);
    }
  });

  const activeTeachers = teachers.filter((t) => t.active);
  const offDutyTeachers: DailyOffDutyTeacher[] = [];
  const panitiaTeachers: Teacher[] = [];
  const assignedTeachersToday: { teacher: Teacher; assignmentCount: number; sessions: string[] }[] = [];

  activeTeachers.forEach((t) => {
    if (isPanitiaTeacher(t)) {
      panitiaTeachers.push(t);
      return;
    }

    const todaySlotSet = todayDistinctSlots.get(t.id);
    const todaySessionsSet = todaySessions.get(t.id);
    const todayCount = todaySlotSet ? todaySlotSet.size : 0;

    if (todayCount > 0) {
      assignedTeachersToday.push({
        teacher: t,
        assignmentCount: todayCount,
        sessions: Array.from(todaySessionsSet || []),
      });
    } else {
      const availableDays = t.available_days || [];
      const isUnavailableDay = !availableDays.includes(dayName);
      offDutyTeachers.push({
        teacher: t,
        isUnavailableDay,
        reason: isUnavailableDay ? 'HARI_LIBUR_TIDAK_TERSEDIA' : 'BEBAS_TUGAS_HARI_INI',
        reasonLabel: isUnavailableDay
          ? `Libur / Tidak Tersedia (${dayName})`
          : 'Bebas Tugas Hari Ini',
        totalWorkload: teacherDistinctSlots.get(t.id)?.size || 0,
      });
    }
  });

  // Urutkan guru bebas tugas:
  // Guru dengan hari libur/tidak tersedia ditampilkan jelas, diurutkan berdasarkan beban kerja paling sedikit
  offDutyTeachers.sort((a, b) => {
    if (a.isUnavailableDay !== b.isUnavailableDay) {
      return a.isUnavailableDay ? -1 : 1;
    }
    if (a.totalWorkload !== b.totalWorkload) {
      return a.totalWorkload - b.totalWorkload;
    }
    return a.teacher.name.localeCompare(b.teacher.name);
  });

  return {
    date: dateStr,
    dayName,
    offDutyTeachers,
    panitiaTeachers,
    assignedTeachersToday,
    totalActiveTeachers: activeTeachers.length,
    totalAssignedToday: assignedTeachersToday.length,
    totalOffDutyToday: offDutyTeachers.length,
    totalPanitia: panitiaTeachers.length,
  };
};
