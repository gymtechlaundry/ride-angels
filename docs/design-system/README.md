# Hyperion design system (from Ride Angels)

Living checklist for patterns we reuse across Hyperion Ionic apps via the
personal Cursor skill **`hyperion-app-shell`** (`~/.cursor/skills/hyperion-app-shell`).

## Goals

1. Keep layout/spacing/card chrome consistent across apps.
2. Reuse the Feedback & Ideas discussion board as a product module.
3. Let each app keep its own brand tokens (Ride Angels `--ra-*`, ColorPing `--cp-*`).

## How to use in Cursor

1. Skill is personal → available in every workspace once created.
2. In the target app chat, say: **“Use hyperion-app-shell to replace the discussion board with the Ride Angels Feedback & ideas pattern.”**
3. Point the agent at Ride Angels paths if the target repo isn’t open:
   - `src/app/features/discussion/`
   - `src/app/core/services/feedback.service.ts`
   - `docs/design-system/`

## Extracted patterns

| Pattern | Ride Angels reference | Notes |
|---------|----------------------|--------|
| Design tokens | `src/theme/variables.scss` | Copy structure; remap colors |
| Page shell / pad | `src/global.scss` | `.ra-page-shell`, `.ra-page-pad` |
| Sticky header chrome | `ion-header.ra-chrome` | Title + CTA stay fixed |
| Discussion board | `src/app/features/discussion/` | First reusable module |
| Feedback backend | `feedback.service.ts` + migrations `00019`–`00026` | Includes reply edit RLS; adapt table names if needed |

## Next modules to extract (later)

- Auth OTP phone/email chooser + verify
- Profile settings card stack spacing
- Calendar day drill-in
- Soft primary button + page header primitives as a tiny shared kit

## ColorPing kickoff

Replace `src/app/features/discussion/` UI with the sticky-header + inline-reply
board (compose, reply, **edit** own posts/replies, delete). Prefer keeping
ColorPing’s `DiscussionService` if the API already supports categories,
screenshots, replies, and author updates (`updated_at` + UPDATE RLS).
