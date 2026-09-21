import {
  ExamSchedule,
  Room,
  Teacher,
  InvigilatorSchedule,
  Building,
  ConflictDetail,
} from '../types/database';
import { exportToSpreadsheet } from './excelHelper';
import { formatIndonesianDate } from './scheduleHelper';

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
}

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

  // Initialize teacher load tracking
  const loadMap = new Map<string, TeacherWorkloadStat>();
  teachers.forEach((t) => {
    loadMap.set(t.id, {
      teacherId: t.id,
      teacherName: t.name,
      employeeNumber: t.employee_number,
      gender: t.gender,
      active: t.active,
      availableDays: t.available_days || [],
      totalAssigned: 0,
      assignedDays: {},
      assignedSessions: {},
      roles: {},
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

  // Process exam by exam, room by room
  for (const exam of targetExams) {
    const sessionKey = `${exam.exam_date}_${exam.session}`;
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

        // Check if kept assignment exists
        if (!config.overwriteExisting) {
          const existing = keptAssignments.find(
            (k) => k.exam_schedule_id === exam.id && k.room_id === room.id && k.role === role
          );
          if (existing && existing.teacher_id) {
            roomAssignedTeacherIds.add(existing.teacher_id);
            continue; // Already assigned
          }
        }

        // Check for priority teacher (consistent room across sessions on same day)
        let selectedTeacher: Teacher | null = null;
        if (config.consistentSessionsSameRoom) {
          const sameDaySameRoomTeacherId = roomDayRoleTeacher.get(exam.exam_date)?.get(room.id)?.get(role);
          if (sameDaySameRoomTeacherId) {
            const matchedTeacher = activeTeachers.find((t) => t.id === sameDaySameRoomTeacherId);
            if (
              matchedTeacher &&
              !currentSessionBusy.has(matchedTeacher.id) &&
              !roomAssignedTeacherIds.has(matchedTeacher.id) &&
              (!config.respectAvailability || (matchedTeacher.available_days || []).includes(exam.day_name))
            ) {
              selectedTeacher = matchedTeacher;
            }
          }
        }

        if (!selectedTeacher) {
          // Find best eligible teacher
          let candidates = activeTeachers.filter((t) => {
            // 1. Not already busy in this exam session
            if (currentSessionBusy.has(t.id)) return false;
            // 2. Not already assigned in this specific room
            if (roomAssignedTeacherIds.has(t.id)) return false;

            // 3. Respect availability day
            if (config.respectAvailability) {
              const days = t.available_days || [];
              if (!days.includes(exam.day_name)) return false;
            }

            return true;
          });

          // Apply constraint: No building hopping on the same day
          if (config.noBuildingHopping && candidates.length > 0) {
            const candidatesNoHop = candidates.filter((t) => {
              const assignedBuilding = teacherDayBuildings.get(t.id)?.get(exam.exam_date);
              return !assignedBuilding || assignedBuilding === room.building_id;
            });
            if (candidatesNoHop.length > 0) {
              candidates = candidatesNoHop;
            }
          }

          if (candidates.length === 0) {
            // Fallback if strict availability caused shortage, or true shortage
            totalUnassignedSlots += 1;
            newAssignments.push({
              exam_schedule_id: exam.id,
              room_id: room.id,
              teacher_id: null,
              role,
              status: 'Dijadwalkan',
              notes: 'Belum ada guru tersedia',
            });
            continue;
          }

          // Score candidates based on workload, daily load, room variety, and consistency
          candidates.sort((a, b) => {
            // Consistent room preference
            if (config.consistentSessionsSameRoom) {
              const roomTodayA = teacherDayRooms.get(a.id)?.get(exam.exam_date);
              const roomTodayB = teacherDayRooms.get(b.id)?.get(exam.exam_date);
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
            const dayLoadA = loadMap.get(a.id)?.assignedDays[exam.day_name] || 0;
            const dayLoadB = loadMap.get(b.id)?.assignedDays[exam.day_name] || 0;
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

            // Deterministic tie-breaker
            return a.name.localeCompare(b.name);
          });

          selectedTeacher = candidates[0];
        }

        // Assign teacher
        currentSessionBusy.add(selectedTeacher.id);
        roomAssignedTeacherIds.add(selectedTeacher.id);
        teacherLastRoom.set(selectedTeacher.id, room.id);
        recordDailyAssignment(selectedTeacher.id, exam.exam_date, room.id, role);

        // Update workload
        const stat = loadMap.get(selectedTeacher.id)!;
        stat.totalAssigned += 1;
        stat.assignedDays[exam.day_name] = (stat.assignedDays[exam.day_name] || 0) + 1;
        stat.assignedSessions[sessionKey] = (stat.assignedSessions[sessionKey] || 0) + 1;
        stat.roles[role] = (stat.roles[role] || 0) + 1;

        totalAssignedSlots += 1;

        newAssignments.push({
          exam_schedule_id: exam.id,
          room_id: room.id,
          teacher_id: selectedTeacher.id,
          role,
          status: 'Dijadwalkan',
          notes: `Otomatis ditugaskan sebagai ${role}`,
        });
      }
    }

    // Reserve invigilators per session if requested
    if (config.assignReserve && config.reserveCountPerSession > 0 && targetRooms.length > 0) {
      const primaryRoom = targetRooms[0];
      for (let rIdx = 0; rIdx < config.reserveCountPerSession; rIdx++) {
        const reserveCandidates = activeTeachers.filter((t) => {
          if (currentSessionBusy.has(t.id)) return false;
          if (config.respectAvailability && !t.available_days.includes(exam.day_name)) return false;
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
          stat.assignedDays[exam.day_name] = (stat.assignedDays[exam.day_name] || 0) + 1;
          stat.roles['Cadangan'] = (stat.roles['Cadangan'] || 0) + 1;

          newAssignments.push({
            exam_schedule_id: exam.id,
            room_id: primaryRoom.id,
            teacher_id: reserveTeacher.id,
            role: 'Cadangan',
            status: 'Dijadwalkan',
            notes: `Pengawas Cadangan Sesi ${exam.session}`,
          });
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

  // Double booking check: same teacher at the same exam date & session (different room or role)
  const doubleBooking = existingAssignments.find((inv) => {
    if (inv.id === currentAssignmentId) return false;
    if (inv.teacher_id !== teacherId) return false;
    const otherExam = examSchedules.find((e) => e.id === inv.exam_schedule_id);
    if (!otherExam) return false;
    return otherExam.exam_date === exam.exam_date && otherExam.session === exam.session;
  });

  if (doubleBooking) {
    return {
      isValid: false,
      error: `Guru ${teacher.name} sudah terjadwal mengawas pada sesi yang sama (${exam.exam_date} - ${exam.session}).`,
    };
  }

  // Availability day warning
  let warning: string | undefined;
  if (teacher.available_days && !teacher.available_days.includes(exam.day_name)) {
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

  examSchedules.forEach((exam) => {
    const activeRooms = rooms.filter((r) => r.active);

    activeRooms.forEach((room) => {
      const building = buildings.find((b) => b.id === room.building_id);

      // Find assignments for this exam & room
      const assignments = invigilatorSchedules.filter(
        (inv) => inv.exam_schedule_id === exam.id && inv.room_id === room.id
      );

      const invigilators: (InvigilatorSchedule | undefined)[] = [];
      for (let i = 1; i <= invigilatorsPerRoom; i++) {
        const role = i === 1 ? 'Pengawas 1' : 'Pengawas 2';
        const found = assignments.find((a) => a.role === role);
        invigilators.push(found);
      }

      const reserveInvigilators = assignments.filter((a) => a.role === 'Cadangan');

      const filledCount = invigilators.filter((inv) => !!inv?.teacher_id).length;
      const isComplete = filledCount >= invigilatorsPerRoom;

      let statusText = 'Belum Diisi';
      if (isComplete) {
        statusText = 'Lengkap';
      } else if (filledCount > 0) {
        statusText = `Kurang ${invigilatorsPerRoom - filledCount} Pengawas`;
      }

      // Conflict detection for this slot
      const relevantConflicts = conflicts.filter(
        (c) => c.exam_schedule_id === exam.id && c.room_id === room.id
      );
      const conflictMessages = relevantConflicts.map((c) => c.description);

      slots.push({
        key: `${exam.id}_${room.id}`,
        examSchedule: exam,
        room,
        building,
        invigilators,
        reserveInvigilators,
        isComplete,
        statusText,
        hasConflict: relevantConflicts.length > 0,
        conflictMessages,
      });
    });
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
      'Mata Pelajaran': slot.examSchedule.subject?.name || '-',
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
