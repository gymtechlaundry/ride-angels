# Android internal testing

Parity checklist for Ride Angels Android vs the working iOS build.
Package ID: `org.rideangels.app`.

Public Play Store listing (copy, Data safety, AAB, production track): [store-publish.md](./store-publish.md).

## One-time Firebase / FCM setup

Push registration already works in the Capacitor client. Delivery needs Firebase
**HTTP v1** (new projects no longer expose a legacy Server key):

1. Firebase Console → add Android app with package `org.rideangels.app`.
2. Download `google-services.json` → place at `android/app/google-services.json`
   (see `android/app/google-services.json.example`). Do **not** commit real keys if
   your team treats them as secret; the file is gitignored.
3. Rebuild / sync so the Google Services plugin applies (`android/app/build.gradle`
   already applies it when the JSON exists).
4. Firebase → Project settings → **Service accounts** → **Generate new private key**
   (downloads a JSON file for `firebase-adminsdk@…`).
5. Set the Edge secret from that file and redeploy:

```bash
# From the downloaded service-account JSON path:
supabase secrets set \
  FCM_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/your-firebase-adminsdk.json)" \
  --project-ref zuvfzmpdmjwewcuyxtac

supabase functions deploy dispatch-push --project-ref zuvfzmpdmjwewcuyxtac --no-verify-jwt
```

Without steps 2–5, Android can still use calendar and core flows; OS push banners will not arrive.

### Optional: notification channel

Android 8+ shows banners through a channel. Capacitor Push creates a default channel;
if banners are silent, confirm the app notification channel is allowed in system settings.

## Build / run

```bash
# Dev sync + open Android Studio
npm run android

# Production web assets + sync (for internal testing APK/AAB)
npm run android:release

# Device / emulator
npm run android:run
```

### If Gradle fails with missing `jlink` or `IBM_SEMERU`

Use a **full JDK 21** (Temurin recommended). Capacitor/AGP need JDK 21, and
Cursor/VS Code Red Hat Java JREs lack `jlink`.

`npm run android:run` goes through `scripts/android-with-jdk.sh`, which prefers:

1. `/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home`
2. Android Studio JBR
3. Other full JDKs with `jlink`

Also ensure `android/settings.gradle` uses foojay-resolver **1.0.0+** (Gradle 9
incompatible with 0.10.x).

Signing: copy `android/key.properties.example` → `android/key.properties` and point
at your keystore before generating a release AAB.

## Feature parity smoke

1. **Auth** — OTP sign-in (phone/email). For phone SMS via Twilio Verify, see
   [`phone-otp.md`](./phone-otp.md). QA test
   numbers: [`supabase/seed/QA_TRIO.md`](../supabase/seed/QA_TRIO.md).
2. **Rides** — create / claim / offer / calendar tab + list.
3. **Push** — Profile → Enable push → allow permission → confirm `device_push_tokens`
   row with `platform = android` → insert a test `notifications` row (see
   [`push-notifications.md`](./push-notifications.md)) → banner arrives.
4. **Calendar** — Profile → Connect device calendar → grant Calendar permission →
   pick a calendar → create appointment → event appears on the phone calendar.
5. **Camera** — avatar + Feedback & ideas screenshot.
6. **Deep link** — `org.rideangels.app://` opens the app (calendar event URLs).

## Known intentional differences

- Calendar provider id remains `apple` in the database for schema compatibility;
  Android UI labels it **Device calendar**.
- Google Calendar OAuth remains disabled (`googleCalendar.enabled: false`).
- FCM still uses HTTP v1 (`FCM_SERVICE_ACCOUNT_JSON`); legacy `FCM_SERVER_KEY` is a fallback only.
