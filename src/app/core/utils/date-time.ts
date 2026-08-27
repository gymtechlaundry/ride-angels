/** Local date/time helpers for form pickers (no timezone conversion). */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toTimeKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Build an ISO-like local value for ion-datetime (no Z suffix). */
export function toLocalIso(dateKey: string, timeKey = '12:00'): string {
  const time = /^\d{2}:\d{2}$/.test(timeKey) ? `${timeKey}:00` : timeKey;
  return `${dateKey}T${time}`;
}

export function parseDateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function parseTimeKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return null;
  }
  return `${match[1]}:${match[2]}`;
}

export function formatDateLong(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime12h(timeKey: string): string {
  const [h, m] = timeKey.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return timeKey;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDateTimeLong(dateKey: string, timeKey: string): string {
  return `${formatDateLong(dateKey)} · ${formatTime12h(timeKey)}`;
}

/** Agenda-style day heading for grouped ride lists. */
export function formatDayGroupHeading(
  dateKey: string,
  reference: Date = new Date(),
): { title: string; subtitle: string } {
  const d = new Date(`${dateKey}T12:00:00`);
  const todayKey = toDateKey(reference);
  const tomorrow = new Date(reference);
  tomorrow.setDate(reference.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);

  const weekdayLong = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (dateKey === todayKey) {
    return { title: 'Today', subtitle: `${weekdayLong} · ${monthDay}` };
  }
  if (dateKey === tomorrowKey) {
    return { title: 'Tomorrow', subtitle: `${weekdayLong} · ${monthDay}` };
  }
  return { title: weekdayLong, subtitle: monthDay };
}

export interface DayRideGroup<T extends { date: string }> {
  dateKey: string;
  title: string;
  subtitle: string;
  rides: T[];
}

/** Group already-sorted rides by calendar day for agenda-style lists. */
export function groupRidesByDay<T extends { date: string }>(
  rides: T[],
  reference: Date = new Date(),
): DayRideGroup<T>[] {
  const groups: DayRideGroup<T>[] = [];
  for (const ride of rides) {
    const last = groups[groups.length - 1];
    if (last && last.dateKey === ride.date) {
      last.rides.push(ride);
      continue;
    }
    const heading = formatDayGroupHeading(ride.date, reference);
    groups.push({
      dateKey: ride.date,
      title: heading.title,
      subtitle: heading.subtitle,
      rides: [ride],
    });
  }
  return groups;
}

/** Sensible default: tomorrow at 10:00 AM local. */
export function defaultAppointmentDateTime(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return { date: toDateKey(d), time: toTimeKey(d) };
}

export function addHoursToTimeKey(timeKey: string, hours: number): string {
  const [h, m] = timeKey.split(':').map(Number);
  const total = ((h + hours) * 60 + m + 24 * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/** Local wall-clock instant for an appointment date (`YYYY-MM-DD`) + time (`HH:mm`). */
export function localDateTimeMs(dateKey: string, timeKey: string): number {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, mi] = timeKey.split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) {
    return Number.NaN;
  }
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

/** True when the appointment start is strictly before `now` (local). */
export function isPastLocalDateTime(
  dateKey: string,
  timeKey: string,
  now: Date = new Date(),
): boolean {
  const ms = localDateTimeMs(dateKey, timeKey);
  if (Number.isNaN(ms)) {
    return false;
  }
  return ms < now.getTime();
}

/**
 * End of the Home/Calendar visibility window for a trip.
 * Prefer return pickup on the appointment date when it is at/after start;
 * if return is earlier (overnight wrap), treat it as the next local day;
 * otherwise start + 2 hours.
 */
export function appointmentListEndMs(
  dateKey: string,
  startTime: string,
  returnPickupTime?: string | null,
): number {
  const startMs = localDateTimeMs(dateKey, startTime);
  if (Number.isNaN(startMs)) {
    return Number.NaN;
  }
  const trimmed = returnPickupTime?.trim();
  if (trimmed) {
    const returnMs = localDateTimeMs(dateKey, trimmed);
    if (!Number.isNaN(returnMs)) {
      return returnMs >= startMs
        ? returnMs
        : returnMs + 24 * 60 * 60 * 1000;
    }
  }
  return startMs + 2 * 60 * 60 * 1000;
}

/** True when the list window has ended (strictly before `now`). */
export function isPastAppointmentListWindow(
  dateKey: string,
  startTime: string,
  returnPickupTime?: string | null,
  now: Date = new Date(),
): boolean {
  const endMs = appointmentListEndMs(dateKey, startTime, returnPickupTime);
  if (Number.isNaN(endMs)) {
    return false;
  }
  return endMs < now.getTime();
}
