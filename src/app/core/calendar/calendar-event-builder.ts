import { RideCalendarEventPayload } from '../models/calendar';
import {
  addressCardLabel,
  addressHasNickname,
  addressStreetLine,
} from '../utils/address-display';
import { addHoursToTimeKey } from '../utils/date-time';

/** Build a professional calendar event body (minimal PII). */
export function buildCalendarEventContent(payload: RideCalendarEventPayload): {
  title: string;
  location: string;
  notes: string;
  startMs: number;
  endMs: number;
} {
  const destinationDisplay = addressCardLabel(
    payload.destinationLabel,
    payload.destinationLine1,
  );
  const title = payload.title?.trim()
    ? `Ride Angels — ${payload.title.trim()}`
    : `Ride Angels — Ride to ${destinationDisplay}`;
  const location =
    addressStreetLine(payload.destinationLabel, payload.destinationLine1) ||
    'Destination';

  const lines = [
    `Ride Angels`,
    `Appointment: ${payload.title}`,
    '',
    payload.riderName ? `Rider: ${payload.riderName}` : null,
    payload.angelName ? `Angel: ${payload.angelName}` : null,
    '',
    `Pickup: ${formatCalendarAddress(payload.pickupLabel, payload.pickupLine1)}`,
    `Destination: ${formatCalendarAddress(payload.destinationLabel, payload.destinationLine1)}`,
    payload.notes ? `Notes: ${payload.notes}` : null,
    '',
    `Open in Ride Angels: ${payload.deepLink}`,
  ].filter((line): line is string => line !== null);

  const endTime =
    payload.endTime && payload.endTime > payload.startTime
      ? payload.endTime
      : addHoursToTimeKey(payload.startTime, 1);

  return {
    title,
    location,
    notes: lines.join('\n'),
    startMs: toLocalMs(payload.date, payload.startTime),
    endMs: toLocalMs(payload.date, endTime),
  };
}

function formatCalendarAddress(label: string, line1?: string): string {
  const street = addressStreetLine(label, line1);
  if (addressHasNickname(label, line1 ?? '')) {
    return `${addressCardLabel(label, line1)} — ${street}`;
  }
  return street;
}

function toLocalMs(date: string, time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.getTime();
}
