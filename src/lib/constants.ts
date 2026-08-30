import { DestinationType, DestinationConfig, HallPass, PassStatistics } from '../types';

export const DESTINATIONS: Record<DestinationType, DestinationConfig> = {
  'Restroom': {
    name: 'Restroom',
    icon: 'Bath',
    color: 'emerald',
    defaultMaxMinutes: 7,
    description: 'Closest 8th-grade hall restroom'
  },
  'Office': {
    name: 'Office',
    icon: 'Building2',
    color: 'blue',
    defaultMaxMinutes: 10,
    description: 'Main Office / Attendance'
  },
  'Nurse': {
    name: 'Nurse',
    icon: 'HeartPulse',
    color: 'rose',
    defaultMaxMinutes: 15,
    description: 'Health & Clinic room'
  },
  'Counselor': {
    name: 'Counselor',
    icon: 'UserCheck',
    color: 'amber',
    defaultMaxMinutes: 15,
    description: 'Guidance & Counseling office'
  },
  'Another Classroom': {
    name: 'Another Classroom',
    icon: 'DoorOpen',
    color: 'purple',
    defaultMaxMinutes: 8,
    description: 'Delivering item / specific room'
  },
  'Library': {
    name: 'Library',
    icon: 'BookOpen',
    color: 'indigo',
    defaultMaxMinutes: 12,
    description: 'Media Center / Book check'
  },
  'Other': {
    name: 'Other',
    icon: 'HelpCircle',
    color: 'slate',
    defaultMaxMinutes: 10,
    description: 'Specific authorized location'
  }
};

export const DESTINATION_LIST: DestinationType[] = [
  'Restroom',
  'Office',
  'Nurse',
  'Counselor',
  'Another Classroom',
  'Library',
  'Other'
];

export function formatElapsedTime(timeOutMs: number, timeInMs?: number | null): string {
  const endMs = timeInMs || Date.now();
  const diffSec = Math.max(0, Math.floor((endMs - timeOutMs) / 1000));
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimeAmPm(timestampMs: number): string {
  if (!timestampMs) return '--:--';
  const date = new Date(timestampMs);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateShort(timestampMs: number): string {
  if (!timestampMs) return '';
  const date = new Date(timestampMs);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================
// PASS URGENCY THRESHOLDS
// ============================================================
//
// Single source of truth for "how long is too long out of class."
// Both getPassUrgency() and computeStatistics()'s overdue count
// read from these instead of each hardcoding their own cutoff,
// so the two can never drift out of sync again.
//
//   < NORMAL_MAX_MINUTES               -> normal
//   NORMAL_MAX_MINUTES .. EXTENDED_MAX -> extended
//   > EXTENDED_MAX_MINUTES             -> overdue
// ============================================================

export const PASS_NORMAL_MAX_MINUTES = 5;
export const PASS_EXTENDED_MAX_MINUTES = 8;

export function getPassUrgency(timeOutMs: number): {
  level: 'normal' | 'warning' | 'overdue';
  minutesOut: number;
  label: string;
  badgeClass: string;
  cardClass: string;
} {
  const diffMs = Date.now() - timeOutMs;
  const minutesOut = Math.floor(diffMs / (60 * 1000));

  if (minutesOut > PASS_EXTENDED_MAX_MINUTES) {
    return {
      level: 'overdue',
      minutesOut,
      label: `Overdue (${PASS_EXTENDED_MAX_MINUTES + 1}+ min)`,
      badgeClass: 'bg-rose-500 text-white font-semibold animate-pulse',
      cardClass: 'border-rose-400 bg-rose-50/70 shadow-rose-100'
    };
  }
  if (minutesOut >= PASS_NORMAL_MAX_MINUTES) {
    return {
      level: 'warning',
      minutesOut,
      label: `Extended (${PASS_NORMAL_MAX_MINUTES}-${PASS_EXTENDED_MAX_MINUTES} min)`,
      badgeClass: 'bg-amber-500 text-white font-semibold',
      cardClass: 'border-amber-400 bg-amber-50/50 shadow-amber-100'
    };
  }
  return {
    level: 'normal',
    minutesOut,
    label: 'Normal',
    badgeClass: 'bg-purple-600 text-white font-semibold',
    cardClass: 'border-purple-200 bg-white hover:border-purple-300'
  };
}

export function computeStatistics(allPasses: HallPass[]): PassStatistics {
  const activePasses = allPasses.filter(p => p.status === 'ACTIVE');
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const passesToday = allPasses.filter(p => p.timeOut >= startOfDay);
  const completedToday = passesToday.filter(p => p.status === 'COMPLETED' && p.durationMinutes);

  const totalDuration = completedToday.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
  const avgDuration = completedToday.length > 0 ? Math.round((totalDuration / completedToday.length) * 10) / 10 : 4.5;

  let overdueCount = 0;
  activePasses.forEach(p => {
    if (Date.now() - p.timeOut > PASS_EXTENDED_MAX_MINUTES * 60 * 1000) {
      overdueCount++;
    }
  });

  const destCounts: Record<string, number> = {};
  const hourCounts: Record<string, number> = {};

  passesToday.forEach(p => {
    destCounts[p.destination] = (destCounts[p.destination] || 0) + 1;
    const hour = new Date(p.timeOut).getHours();
    const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;
    hourCounts[hourLabel] = (hourCounts[hourLabel] || 0) + 1;
  });

  let mostCommon = 'Restroom';
  let maxCount = 0;
  Object.entries(destCounts).forEach(([dest, cnt]) => {
    if (cnt > maxCount) {
      maxCount = cnt;
      mostCommon = dest;
    }
  });

  return {
    totalActive: activePasses.length,
    totalToday: passesToday.length,
    avgDurationMinutes: avgDuration,
    overdueCount,
    mostCommonDestination: mostCommon,
    passesByDestination: destCounts,
    passesByHour: hourCounts
  };
}

// Play subtle web audio notification chime if requested
export function playNotificationTone(type: 'start' | 'end' | 'alert' = 'start') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'start') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'end') {
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // AudioContext may be restricted by browser until user gesture
  }
}
