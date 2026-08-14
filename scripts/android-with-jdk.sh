#!/usr/bin/env bash
# Pick a full JDK (with jlink) for Android/Capacitor builds.
# Cursor/VS Code Red Hat Java JREs are incomplete and break AGP transforms.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
LOCAL_PROPS="$ANDROID_DIR/local.properties"

candidates=(
  "${JAVA_HOME:-}"
  "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  "$HOME/Library/Java/JavaVirtualMachines/ms-17.0.16/Contents/Home"
)

chosen=""
for home in "${candidates[@]}"; do
  if [[ -n "$home" && -x "$home/bin/jlink" && -x "$home/bin/javac" ]]; then
    # Skip known-broken Red Hat language-support JREs shipped with editor extensions.
    if [[ "$home" == *"/redhat.java"* || "$home" == *".vscode/extensions"* || "$home" == *".cursor/extensions"* ]]; then
      continue
    fi
    chosen="$home"
    break
  fi
done

if [[ -z "$chosen" ]]; then
  echo "[android-jdk] No full JDK with jlink found." >&2
  echo "Install Microsoft OpenJDK 17 or use Android Studio's JBR, then retry." >&2
  exit 1
fi

export JAVA_HOME="$chosen"
export PATH="$JAVA_HOME/bin:$PATH"
echo "[android-jdk] Using JAVA_HOME=$JAVA_HOME"

# Keep local.properties in sync (Cap/AGP + teammates' machines).
if [[ -f "$LOCAL_PROPS" ]]; then
  if grep -q '^org.gradle.java.home=' "$LOCAL_PROPS"; then
    # portable in-place edit
    tmp="$(mktemp)"
    sed "s|^org.gradle.java.home=.*|org.gradle.java.home=$JAVA_HOME|" "$LOCAL_PROPS" >"$tmp"
    mv "$tmp" "$LOCAL_PROPS"
  else
    printf '\norg.gradle.java.home=%s\n' "$JAVA_HOME" >>"$LOCAL_PROPS"
  fi
fi

# Drop any daemon still bound to a broken editor JRE.
if [[ -x "$ANDROID_DIR/gradlew" ]]; then
  (cd "$ANDROID_DIR" && ./gradlew --stop >/dev/null 2>&1 || true)
fi

exec "$@"
