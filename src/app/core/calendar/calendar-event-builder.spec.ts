import { buildCalendarEventContent } from './calendar-event-builder';
import { RideCalendarEventPayload } from '../models/calendar';

describe('buildCalendarEventContent', () => {
  const base: RideCalendarEventPayload = {
    rideRequestId: 'ride-1',
    appointmentId: 'appt-1',
    title: 'Oncology follow-up',
    destinationLabel: 'Memorial Clinic',
    pickupLabel: 'Home',
    pickupLine1: '12 Oak St',
    destinationLine1: '100 Health Ave',
    date: '2026-09-01',
    startTime: '10:30',
    riderName: 'Alex Rider',
    angelName: 'Jordan Angel',
    notes: 'Wheelchair assist',
    deepLink: 'org.rideangels.app://appointment/appt-1',
  };

  it('builds a Ride Angels title from the appointment title', () => {
    const content = buildCalendarEventContent(base);
    expect(content.title).toBe('Ride Angels — Oncology follow-up');
    expect(content.location).toBe('100 Health Ave');
  });

  it('includes rider, angel, notes, and deep link in notes', () => {
    const content = buildCalendarEventContent(base);
    expect(content.notes).toContain('Rider: Alex Rider');
    expect(content.notes).toContain('Angel: Jordan Angel');
    expect(content.notes).toContain('Notes: Wheelchair assist');
    expect(content.notes).toContain(base.deepLink);
  });

  it('defaults end time to one hour after start when return is missing', () => {
    const content = buildCalendarEventContent(base);
    expect(content.endMs - content.startMs).toBe(60 * 60 * 1000);
  });

  it('uses return pickup time when later than start', () => {
    const content = buildCalendarEventContent({
      ...base,
      endTime: '12:00',
    });
    expect(content.endMs - content.startMs).toBe(90 * 60 * 1000);
  });
});
