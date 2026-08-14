# Calendar Integration (V1)

Client-side **device calendar** sync for the current user’s rides via
`@capgo/capacitor-calendar`. Calendar failures never block create / claim / update / cancel.

- **iOS:** EventKit (Apple Calendar; iCloud / TimeTree when linked by the OS)
- **Android:** CalendarContract (Google Calendar / OEM calendars on device)
- **Riders:** appointments sync as soon as they are created (title, date, time, notes, pickup/destination). Edits and cancel update or remove the event.
- **Angels:** events sync while they are assigned (claimed / needs reconfirm), and are removed if they leave the ride.

Provider id in the database remains `apple` for schema compatibility; Profile UI
says **Apple Calendar** on iOS and **Device calendar** on Android.

Google Calendar (OAuth PKCE) is implemented in code but **disabled for V1** (`googleCalendar.enabled: false`).

Profile’s Calendar card is a **multi-row provider list** (same pattern as Connected apps): it can show Apple/device and, when enabled, Google as separate rows—one, the other, or both. Sync still uses a single `preferredProvider` in `calendar_preferences` until dual-connection / dual-sync is built.

## Architecture

- Ride services call `CalendarSyncService` after successful RPCs (`AppointmentService`, `RideOfferService`).
- Preferences + sync tracking live in Supabase (`calendar_preferences`, `ride_calendar_events`).
- Events are created via `@capgo/capacitor-calendar`. No Edge Functions or custom REST API in V1.
- Each device syncs the **current user** only (rider and angel each sync their own calendar).

## Apply migration

Run `supabase/migrations/20260811000009_calendar_sync.sql` in the Supabase SQL Editor (after `00008`).

See also [`supabase/README.md`](../supabase/README.md).

## Connect (iOS / Android)

1. Build on a physical device (calendar APIs are native-only).
2. iOS: Info.plist already includes calendar usage strings and the `org.rideangels.app` URL scheme.
3. Android: `AndroidManifest.xml` includes `READ_CALENDAR` / `WRITE_CALENDAR` and the same URL scheme intent-filter.
4. Profile → **Connect Apple Calendar** / **Connect device calendar** → grant access → pick a calendar.
5. After **Add Appointment**, the rider’s calendar gets an event. After claim/accept, the angel’s calendar gets one too. Edits update existing events; cancel removes them.

TimeTree: there is no direct API. Users who link TimeTree to Apple Calendar receive events through Apple.

## Google Calendar (deferred)

Not offered in the V1 Profile UI (`googleCalendar.enabled: false` hides the Google row). To enable later:

1. Set `googleCalendar.enabled: true` in `environment*.ts` and add OAuth client IDs.
2. Profile will show a **Google Calendar** row beside Apple/device (connect / disconnect / change calendar).
3. Follow the previous Google Cloud setup (Calendar API, iOS OAuth client, redirect `org.rideangels.app://google-calendar-oauth`).
4. Dual simultaneous sync (write the same ride to both calendars) still needs a prefs/schema pass—V1 remains single-target `preferredProvider`.

## V1 limits

- Device calendar only (native iOS + Android). Google OAuth deferred.
- Deep links open the app via custom URL scheme; universal / App Links can come later.
- No server-side calendar job queue — sync runs after mutations and on `DomainSyncService.refreshForCurrentUser`.

## Test notes

- Create appointment with calendar connected → event appears with title / time / notes.
- Edit appointment → same event updates (no duplicate).
- Claim/accept → angel device gets an event; rider event updates with angel name when available.
- Cancel → event removed.
- Profile disconnect clears connection status without failing rides.
- Appointment detail shows “Added to your calendar” or “Calendar sync failed [Retry]”.
- Denied calendar permission should surface a clear Profile status, not a ride error.

See also [`android-testing.md`](./android-testing.md) for the Android release path.
