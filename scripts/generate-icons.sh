#!/usr/bin/env bash
# Regenerate native/PWA icons without replacing hand-tuned portrait splash screens.
# capacitor-assets otherwise rewrites Splash.imageset to a square canvas that iOS stretches.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP="$(mktemp -d "${TMPDIR:-/tmp}/ra-splash-backup.XXXXXX")"
cleanup() { rm -rf "$BACKUP"; }
trap cleanup EXIT

mkdir -p "$BACKUP/android-splashes"

if [[ -d ios/App/App/Assets.xcassets/Splash.imageset ]]; then
  cp -R ios/App/App/Assets.xcassets/Splash.imageset "$BACKUP/Splash.imageset"
fi

while IFS= read -r -d '' f; do
  rel="${f#android/app/src/main/res/}"
  dest="$BACKUP/android-splashes/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$f" "$dest"
done < <(find android/app/src/main/res -type f -name 'splash.png' -print0 2>/dev/null)

npx capacitor-assets generate \
  --iconBackgroundColor '#6C47FF' \
  --iconBackgroundColorDark '#1E1B4B' \
  --splashBackgroundColor '#F5F6FA' \
  --splashBackgroundColorDark '#1E1B4B'

mkdir -p src/assets/pwa
mv -f src/assets/icons/icon-*.webp src/assets/pwa/ 2>/dev/null || true

if [[ -d "$BACKUP/Splash.imageset" ]]; then
  rm -rf ios/App/App/Assets.xcassets/Splash.imageset
  cp -R "$BACKUP/Splash.imageset" ios/App/App/Assets.xcassets/Splash.imageset
fi

if [[ -d "$BACKUP/android-splashes" ]]; then
  while IFS= read -r -d '' f; do
    rel="${f#"$BACKUP/android-splashes/"}"
    dest="android/app/src/main/res/$rel"
    mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest"
  done < <(find "$BACKUP/android-splashes" -type f -name 'splash.png' -print0 2>/dev/null)
fi

# Adaptive launcher foreground: keep the mark inside Android's ~66% safe zone
# (capacitor-assets alone leaves wing tips too close to the mask edge).
python3 "$ROOT/scripts/rebuild-android-adaptive-icon.py"

echo "Icons generated; portrait splash assets restored; Android adaptive safe-zone applied."
