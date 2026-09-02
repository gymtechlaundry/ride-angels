# Ride reminders

Scheduled push/inbox reminders for confirmed drives and unclaimed rides.

## What fires

| When | Who | Type | Copy idea |
| --- | --- | --- | --- |
| Day before a **confirmed** drive | Assigned Angel | `appointment_reminder` | Drive tomorrow… |
| ~1 hour before pickup | Assigned Angel | `pickup_reminder` | Pickup in about an hour… |
| Day before an **open** ride (no Angel yet) | Rider | `appointment_reminder` | Ride still needed… |
| Same | Accepted circle (no pending offer on that ride) | `appointment_reminder` | …still needs a Ride Angel… |

Deduped in `ride_reminder_sends` (one send per ride + recipient + kind).

Wall-clock times use **`America/New_York`** for V1 (appointments store local date/time without a per-user timezone).

## How it runs

Migration `20260902000030_ride_reminders.sql` defines `dispatch_ride_reminders()` and schedules:

```text
*/15 * * * *  →  select public.dispatch_ride_reminders();
```

via `pg_cron` (job name `ride-angels-dispatch-reminders`). Each notification insert still triggers `dispatch-push`.

Manual smoke (SQL editor as service / postgres):

```sql
select public.dispatch_ride_reminders();
```

## Prefs

Profile → Notifications → **Reminders**:

- Day-before reminders (`appointment_reminder`)
- Hour-before pickup (`pickup_reminder`)

Users with Apple Calendar sync still get the device’s 60‑minute EventKit alert; hour-before push is intentional backup (can be toggled off).
