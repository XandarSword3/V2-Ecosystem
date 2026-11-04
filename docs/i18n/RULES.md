# Internationalization Rules — `frontend/messages/*.json`

These rules are **enforced by CI** (`.github/workflows/ci.yml` → `Check translation parity`).
A PR that breaks them must not be merged.

---

## 1. File layout

| Rule | Detail |
|------|--------|
| One file per locale | `frontend/messages/{locale}.json` — currently `en`, `ar`, `fr`, `de`, `it` |
| `en.json` is the source of truth | New keys are added to `en.json` **first**, then to every other locale in the **same PR** |
| Full key parity | Every locale must contain exactly the same key set as `en.json`. No missing keys, no extras |
| Same JSON shape | Keys nest the same way in every file. Values are always **strings** (no nested objects as values) |
| Structure mirroring | When generating a locale file, mirror `en.json`'s key order and nesting so diffs stay reviewable |

Verification: `cd frontend && npm run check:translations` (CI step `Check translation parity`).
The locale list in `frontend/scripts/i18n-tool.cjs` (`SUPPORTED_LANGUAGES`) must stay in sync with
`locales` in `frontend/src/i18n/request.ts`.

## 2. No hardcoded brand or business names

**Never hardcode a brand, resort, gym, or business name in a message file.** The platform is
white-label: the brand comes from CMS settings (`settings.siteName`) and can change per property.

Wrong (this is how "Iron Paradise Gym" leaked into 52 strings):

```json
{ "copyright": "© {year} Iron Paradise Gym. All rights reserved." }
```

Right — use the `{brandName}` ICU placeholder:

```json
{ "copyright": "© {year} {brandName}. All rights reserved." }
```

Rules:

- Any string that names the business uses `{brandName}`.
- Components passing those keys must supply the value:
  `t('copyright', { year, brandName: settings.siteName || DEFAULT_BRAND_NAME })`
  (import `DEFAULT_BRAND_NAME` from `@/lib/settings-context` — it is the single fallback when no
  CMS name is configured).
- If the brand adds nothing (legal boilerplate, subtitles, privacy/terms text), prefer a neutral,
  brandless phrasing: "our services", "the resort", "we".
- Property **location** names are content/DB data, not translations — do not bake a place name
  into `messages/*.json`.
- `src/lib/translate.ts`'s `dynamicTranslationDictionary` must not contain brand entries either.

The legacy-audit tool (`tools/legacy-audit.js`) already fails CI on legacy brand terms.

## 3. Placeholders & interpolation

- Use ICU syntax: `{name}`, `{count}`, and plurals
  `{count, plural, one {item} other {items}}`.
- **Every locale must use the same placeholder names** in a given key (translations may move a
  placeholder within the sentence; they may not rename or drop it).
- Never concatenate translated fragments in code — translate whole sentences per key.

## 4. Adding a new key (checklist)

1. Add the key + English value to `frontend/messages/en.json` under the correct namespace.
2. Add translations for `ar`, `fr`, `de`, `it` in the same PR.
3. If the key mentions the business, use `{brandName}` and wire the param at the call site.
4. Run `npm run check:translations` — it must pass.
5. Run `npm run i18n:scan` to confirm you didn't introduce raw hardcoded JSX strings instead of
   using `useTranslations`/`getTranslations`.

## 5. Layered loading (why DB overrides exist)

`src/i18n/request.ts` loads `messages/{locale}.json` as the baseline, then — when
`ENABLE_DYNAMIC_TRANSLATIONS=true` — overlays published rows from the
`/api/v1/admin/translations/ui` endpoint (DB wins). Static files remain the safe fallback and the
review artifact for PRs; the DB layer is for runtime corrections only.

## 6. Grammar notes per locale (learned from this cleanup)

- **de**: brand takes its correct article in the sentence ("Willkommen bei {brandName}") — do not
  split article and brand across keys.
- **fr**: space before `?`, `!`, `:` (thin space rules); "à {brandName}" not "au {brandName}"
  when the brand is unknown/variable.
- **it**: preposition follows the brand's gender, which is unknowable for a variable brand —
  prefer constructions that avoid agreement ("in {brandName}", not "al/alla {brandName}").
- **ar**: brand stays in Latin script inside Arabic sentences unless a CMS-provided Arabic name
  exists (DB layer is the right place for a localized brand spelling).
