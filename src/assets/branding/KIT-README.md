# Ride Angels — FINAL APPROVED BRAND KIT

## Source of truth
`reference/ride-angels-approved-brand-board.png` is the exact design approved for Ride Angels.
Do not redraw, reinterpret, simplify, or restyle the mark, wings, heart, halo, wordmark, or icon.

## Included assets
`logos-raster/` contains high-resolution raster exports taken directly from the approved design.
`app-icons/` contains 1024×1024 icon variants based directly on the approved icon treatments.
`brand-guide/` contains the approved palette.

## Primary application icon
Use:
`app-icons/app-icon-1024.png`

## In-app branding
Auth / splash screens use the clean vertical splash lockup:
`src/assets/branding/logos/ride-angels-splash-lockup.png` (`variant="splash"`)

Use the light horizontal lockup on light surfaces:
`logos-raster/ride-angels-horizontal-light-approved.png`

Use the dark horizontal lockup on dark/navy surfaces:
`logos-raster/ride-angels-horizontal-dark-approved.png`

Use the vertical lockup where a centered/stacked treatment is required:
`logos-raster/ride-angels-vertical-approved.png`

## Cursor instructions
Treat this folder as the official Ride Angels branding source of truth.

1. Inspect `reference/ride-angels-approved-brand-board.png` first.
2. Do not redesign, redraw, simplify, recolor, or substitute the approved logo.
3. Preserve the exact visual identity: purple/lavender wings, centered person, heart motif, gold halo, navy/purple Ride Angels wordmark, and gold accent.
4. Copy only the assets needed at runtime into `src/assets/branding/`; keep this entire kit intact as the master source.
5. Use `app-icons/app-icon-1024.png` as the master icon source for the iOS and Android native asset-generation workflow.
6. Use the supplied light/dark/vertical raster lockups in the corresponding application contexts.
7. Preserve aspect ratio. Never stretch or crop a logo lockup.
8. Do not replace these assets with Ionic icons, CSS approximations, AI-generated variants, or Figma approximations.
9. Preserve the Figma-derived UI and use the brand colors in `brand-guide/colors.json`.
10. After integration, build the Angular app and verify the native iOS/Android icon configuration.

IMPORTANT: These assets are raster exports from the exact approved visual reference. They are intentionally supplied this way to preserve the approved design rather than introducing a different vector redraw.
