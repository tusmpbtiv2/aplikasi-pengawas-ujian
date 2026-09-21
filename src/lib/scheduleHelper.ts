export const INDONESIAN_DAYS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Returns Indonesian day name from date string (YYYY-MM-DD)
 */
export const getDayNameFromDate = (dateStr: string): string => {
  if (!dateStr) return 'Senin';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return INDONESIAN_DAYS[d.getDay()];
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return INDONESIAN_DAYS[d.getDay()];
  }
  return 'Senin';
};

/**
 * Format YYYY-MM-DD to Indonesian format e.g. "22 September 2026"
 */
export const formatIndonesianDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${INDONESIAN_MONTHS[monthIndex]} ${year}`;
    }
  }
  return dateStr;
};

/**
 * Parses user or spreadsheet date input to standard YYYY-MM-DD
 * Supports: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, Excel serial date numbers
 */
export const parseInputDate = (input: any): string | null => {
  if (input === null || input === undefined || input === '') return null;

  // Handle Excel date serial number (e.g. 45557)
  if (typeof input === 'number' || (!isNaN(Number(input)) && !String(input).includes('/') && !String(input).includes('-'))) {
    const serial = Number(input);
    if (serial > 20000 && serial < 80000) {
      // Excel epoch starts at 1899-12-30
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(input).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Try standard JS Date parsing fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
};

/**
 * Normalizes time string to HH:MM:SS format
 */
export const normalizeTime = (timeInput: any): string | null => {
  if (!timeInput) return null;
  const str = String(timeInput).trim();

  // Handle Excel fraction of a day if passed as number (e.g. 0.3125 -> 07:30)
  if (typeof timeInput === 'number' && timeInput >= 0 && timeInput < 1) {
    const totalMinutes = Math.round(timeInput * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }

  // HH:MM or HH.MM or HH:MM:SS
  const match = str.match(/^(\d{1,2})[:\.](\d{1,2})(?:[:\.](\d{1,2}))?$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60 && s >= 0 && s < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  return null;
};

/**
 * Normalizes session label, e.g. "1" -> "Sesi 1"
 */
export const normalizeSession = (sessionInput: any): string => {
  if (!sessionInput) return 'Sesi 1';
  const str = String(sessionInput).trim();
  if (/^\d+$/.test(str)) {
    return `Sesi ${str}`;
  }
  return str;
};

/**
 * Check if two time ranges on the same date overlap
 */
export const isTimeOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  const sA = startA.slice(0, 5);
  const eA = endA.slice(0, 5);
  const sB = startB.slice(0, 5);
  const eB = endB.slice(0, 5);

  return sA < eB && sB < eA;
};

export type ScheduleStatus = 'Belum Dijadwalkan' | 'Sebagian Terjadwal' | 'Lengkap';

/**
 * Calculate invigilator metrics for an exam schedule
 */
export interface ScheduleMetrics {
  activeRoomsCount: number;
  invigilatorsPerRoom: number;
  totalRequired: number;
  totalFilled: number;
  totalMissing: number;
  status: ScheduleStatus;
}

export const calculateScheduleMetrics = (
  activeRoomsCount: number,
  invigilatorsPerRoom: number,
  totalFilled: number
): ScheduleMetrics => {
  const totalRequired = activeRoomsCount * invigilatorsPerRoom;
  const totalMissing = Math.max(0, totalRequired - totalFilled);

  let status: ScheduleStatus = 'Belum Dijadwalkan';
  if (totalRequired === 0) {
    status = totalFilled > 0 ? 'Lengkap' : 'Belum Dijadwalkan';
  } else if (totalFilled >= totalRequired) {
    status = 'Lengkap';
  } else if (totalFilled > 0) {
    status = 'Sebagian Terjadwal';
  } else {
    status = 'Belum Dijadwalkan';
  }

  return {
    activeRoomsCount,
    invigilatorsPerRoom,
    totalRequired,
    totalFilled,
    totalMissing,
    status,
  };
};
