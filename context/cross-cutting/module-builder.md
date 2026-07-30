# Cross-cutting: Module Builder

Drag-and-drop visual page builder — not engine-specific, spans all
property-level engines' front-end presentation.

## Source of truth

- `frontend/src/**/DynamicModuleRenderer.tsx`
- `frontend/src/**/BuilderCanvasV2.tsx`
- `frontend/src/**/ComponentToolbarV2.tsx`
- `frontend/src/**/module-builder-store.ts`

## Status (as of last chat-session update, 2026-07-14)

Phases 0–3 done: canvas, toolbar, inline editing via `ep()` helper.
Next up: Property Panel V2, theme scope work. Not yet re-verified
against current `main` — confirm before resuming.
