#!/usr/bin/env bash
# Pre-flight checks before App Store / Play uploads (Capacitor).
# Usage: from repo root → npm run store:preflight
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

ok() { printf '  OK  %s\n' "$*"; }
warn() { printf ' WARN %s\n' "$*"; }
bad() { printf ' FAIL %s\n' "$*"; FAIL=1; }

echo "Ride Angels store preflight"
echo

# --- Capacitor: no live-reload URL in store binaries ---
if [[ -f capacitor.config.ts ]]; then
  if rg -q "url:\s*['\"]https?://" capacitor.config.ts || rg -q "url:\s*['\"]http://" capacitor.config.ts; then
    bad "capacitor.config.ts appears to set server.url (store builds white-screen)"
  else
    ok "capacitor.config.ts has no server.url"
  fi
fi

for cfg in \
  android/app/src/main/assets/capacitor.config.json \
  ios/App/App/capacitor.config.json
do
  if [[ -f "$cfg" ]]; then
    if rg -q '"url"\s*:' "$cfg"; then
      bad "$cfg still has server url — run production sync before upload"
    else
      ok "$cfg has no server url"
    fi
  else
    warn "$cfg missing (run npm run build:ios:release / build:android:release first)"
  fi
done

# --- Production web flag ---
if [[ -f src/environments/environment.prod.ts ]]; then
  if rg -q "production:\s*true" src/environments/environment.prod.ts; then
    ok "environment.prod.ts production: true"
  else
    bad "environment.prod.ts should set production: true"
  fi
fi

# --- Android release hardening ---
if rg -q "minifyEnabled\s+true" android/app/build.gradle; then
  ok "Android release minifyEnabled true"
else
  bad "Android release minifyEnabled is not true (Play obfuscation warning)"
fi

VC=$(sed -nE 's/.*versionCode[[:space:]]+([0-9]+).*/\1/p' android/app/build.gradle | head -1)
VN=$(sed -nE 's/.*versionName[[:space:]]+"([^"]+)".*/\1/p' android/app/build.gradle | head -1)
ok "Android versionName=${VN:-?} versionCode=${VC:-?} (must be higher than any uploaded AAB)"

if [[ -f android/key.properties ]]; then
  ok "android/key.properties present (gitignored)"
else
  warn "android/key.properties missing — release AAB will not be signed locally"
fi

if [[ -f android/app/google-services.json ]]; then
  ok "android/app/google-services.json present (FCM)"
else
  warn "google-services.json missing — Android push will not work"
fi

# --- iOS versions / export compliance ---
IOS_BUILD=$(sed -nE 's/.*CURRENT_PROJECT_VERSION = ([0-9]+);/\1/p' ios/App/App.xcodeproj/project.pbxproj | head -1)
IOS_MKT=$(sed -nE 's/.*MARKETING_VERSION = ([0-9.]+);/\1/p' ios/App/App.xcodeproj/project.pbxproj | head -1)
ok "iOS marketing=${IOS_MKT:-?} build=${IOS_BUILD:-?} (build must be higher than any uploaded IPA)"

if rg -q "ITSAppUsesNonExemptEncryption" ios/App/App/Info.plist; then
  ok "Info.plist has ITSAppUsesNonExemptEncryption (confirm false for HTTPS-only)"
else
  warn "Confirm ITSAppUsesNonExemptEncryption=false for App Store export compliance"
fi

# --- Legal URLs reachable ---
for path in privacy terms support; do
  code=$(curl -sL --max-time 15 -o /dev/null -w "%{http_code}" "https://hyperionappstudio.com/rideangels/${path}/" || true)
  if [[ "$code" == "200" ]]; then
    ok "https://hyperionappstudio.com/rideangels/${path}/ → $code"
  else
    bad "https://hyperionappstudio.com/rideangels/${path}/ → ${code:-curl-failed}"
  fi
done

ok "Upload with: npm run release:ios  /  npm run android:bundle (not npm run ios/android)"
ok "After android:bundle, upload mapping.txt to Play: android/app/build/outputs/mapping/release/mapping.txt"

echo
if [[ "$FAIL" -ne 0 ]]; then
  echo "Preflight FAILED — fix items above before uploading."
  exit 1
fi
echo "Preflight passed. Smoke on device with docs/SMOKE.md, then upload."
