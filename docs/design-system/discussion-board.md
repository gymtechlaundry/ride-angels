# Discussion board module

Canonical UI: `src/app/features/discussion/discussion.page.*`

## Behavior

- Sticky `ion-header` with page header + **Start a discussion** (hidden while composing)
- Compose card: kind · title · body · screenshots · Post/Cancel
- Feed with inline replies (no separate thread route required)
- Authors can edit their own posts (kind, title, body) and replies (body) inline
- Show **Edited** when `updated_at` is meaningfully after `created_at`

## Backend

- Service: `src/app/core/services/feedback.service.ts` (`updatePost`, `updateReply`)
- Migrations: `supabase/migrations/20260813000019_feedback_discussion.sql` and follow-ons for replies / creator moderation / notifications / reply edit RLS (`20260817000026_feedback_edit_replies.sql`)

## Porting

Follow `~/.cursor/skills/hyperion-app-shell/SKILL.md`. Do not copy Ride Angels brand purple into other products — only structure, density, and interaction model.
