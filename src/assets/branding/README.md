# Ride Angels — runtime branding

Master kit (do not edit): `ride-angels-final-exact-brand-kit/` at the project root.

Visual source of truth: `reference/ride-angels-approved-brand-board.png`

## Rules
- Do not redraw, recolor, or substitute approved artwork.
- Preserve aspect ratio. Never stretch lockups.
- In-app logos: `logos/*-approved.png` (board presentation captions trimmed where present).
- Native icon master: `resources/icon.png` — full-bleed 1024² from kit `app-icon-purple-compact.png` on `#6C47FF` (avoids pre-rounded fringe in `app-icon-1024.png`).
- Kit originals remain under `icons/` including `app-icon-1024.png`.
- Splash masters: `resources/splash.png` (`#F5F6FA` + mark + horizontal lockup) and `resources/splash-dark.png` (`#1E1B4B` + dark lockup). Never use a stretched app icon as splash.

## Regenerate native icons/splash
```bash
npm run generate:icons
```
This regenerates icons, then **restores** the hand-tuned portrait splash assets
(`ios/.../Splash.imageset` and Android `splash.png` drawables). Do not let
`capacitor-assets` leave square splash images in place — iOS stretches those
outside the viewport. To intentionally rebuild splash from `resources/splash.png`,
run `npx capacitor-assets generate …` separately and verify portrait sizes
(e.g. ~1284×2778), not 2732×2732 squares.
PWA webp icons are moved to `src/assets/pwa/` so they do not mix with UI SVGs in `src/assets/icons/`.
