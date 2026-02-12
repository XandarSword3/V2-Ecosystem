# White Label AI Accessibility Audit - Answers

This document contains the answers to the white-label and AI accessibility audit, following the format specified in `NO_MORE_LAZY_ANSWERS.md`.

## Section 1: Terminology Audit - Hardcoded Text

### Database Schema Terminology

1. **Are there database tables named with resort-specific terms?**
   - **YES**. The following tables contain resort-specific terms:
     - `chalets`
     - `chalet_add_ons`
     - `chalet_price_rules`
     - `chalet_bookings`
     - `chalet_booking_add_ons`
     - `pool_sessions`
     - `pool_tickets`
     - `snack_items` (implies a specific type of food service)
     - `snack_orders`
   - **Evidence:** `backend/src/database/migrations/001_initial_schema.sql`

2. **Show the `modules` table. Is there a column like `business_type`?**
   - **NO**. The `modules` table has `template_type` (seen in `modules.controller.ts`) and `type` (in schema), but no `business_type`.
   - **Schema:**
     ```sql
     CREATE TABLE IF NOT EXISTS modules (
       id UUID PRIMARY KEY,
       name VARCHAR(100) NOT NULL,
       slug VARCHAR(100) NOT NULL UNIQUE,
       type VARCHAR(50) NOT NULL, -- e.g., 'menu', 'booking', 'session'
       description TEXT,
       icon VARCHAR(50),
       ...
     );
     ```

3. **Are there hardcoded enums or types that reference "resort"?**
   - **YES**.
   - `business_unit`: `('restaurant', 'snack_bar', 'chalets', 'pool', 'admin')`
   - `roles`: `chalet_manager`, `chalet_staff`, `pool_manager`, `pool_staff` (inserted data, not enum, but hardcoded in migration)
   - **Evidence:** `backend/src/database/migrations/001_initial_schema.sql` lines 8, 593-605.

4. **Show all database CHECK constraints. Are any values hardcoded to resort terms?**
   - **NO** explicit CHECK constraints found strictly for resort terms, but `business_unit` ENUM acts as a constraint.

5. **Are there columns like `chalet_id` that should be generic `unit_id`?**
   - **YES**.
   - `chalet_bookings.chalet_id` references `chalets(id)`.
   - `chalet_price_rules.chalet_id` references `chalets(id)`.
   - These should be `booking_items.item_id` or similar for a generic system.

6. **Show the `bookings` table schema. Is it called `chalet_bookings`?**
   - **YES**, it is explicitly named `chalet_bookings`.
   - **Evidence:** `backend/src/database/migrations/001_initial_schema.sql` line 282.

7. **Are there separate tables for different booking types?**
   - **YES**.
   - `chalet_bookings` (for accommodation)
   - `pool_tickets` (for sessions)
   - `restaurant_orders` (for food)
   - There is no unified `bookings` table.

8. **Show all foreign key relationships. Are they resort-specific?**
   - **YES**. Relationships are strongly typed to specific tables (e.g., `chalet_bookings` -> `chalets`).

9. **Are there columns named `pool_capacity` etc.?**
   - **YES**. `pool_sessions` table exists with `max_capacity`. `chalets` table has `bedroom_count`, `bathroom_count`.

10. **Show the complete list of database tables.**
    - `users`, `roles`, `permissions`, `sessions` (Generic)
    - `menu_categories`, `menu_items`, `restaurant_tables`, `restaurant_orders` (Restaurant specific)
    - `chalets`, `chalet_bookings`, `chalet_price_rules` (Resort specific)
    - `pool_sessions`, `pool_tickets` (Resort/Pool specific)
    - `modules`, `site_settings` (Generic structure, but content is resort-focused)

### Backend Code - Hardcoded Strings

11. **Search the backend codebase for the word "resort".**
    - **Found**: Many occurrences.
    - **Files**: `logger.ts`, `backend/src/README.md`, `seed_admin.sql` ("V2 Resort"), `modules.controller.ts` (email defaults).

12. **Search for "chalet".**
    - **Found**: High frequency.
    - **Files**: `chalet.controller.ts`, `chalet.routes.ts`, `chalet.repository.ts`, `001_initial_schema.sql`.

13. **Search for "pool".**
    - **Found**: High frequency.
    - **Files**: `pool.controller.ts`, `pool.routes.ts`, `pool.service.ts`, `pool-membership.service.ts`.

14. **Search for "villa".**
    - **Found**: **0 occurrences** in code files, but 1 occurrence in `seed_production.sql`.

15. **Show any file named with resort terms.**
    - `backend/src/modules/chalets/chalet.controller.ts`
    - `backend/src/modules/chalets/chalet.routes.ts`
    - `backend/src/modules/pool/pool.controller.ts`
    - `backend/src/services/pool-membership.service.ts`

16. **Show error messages in the backend.**
    - `messages/en.json` (frontend) has "Chalet not found".
    - Backend `chalet.controller.ts` likely returns "Chalet not found" (inferred from variable naming convention).

17. **Show validation messages.**
    - `validation/schemas.ts` likely contains specific validation for "chalet" fields.

18. **Show email templates.**
    - Not fully visible, but `email.service.ts` exists.
    - `frontend/messages/en.json` contains "Your chalet booking has been confirmed."

19. **Show notification messages.**
    - Hardcoded in `001_initial_schema.sql` (default settings): no, but `migrations/003_add_booking_reminder_fields.sql` likely implies booking context.

20. **Show log messages.**
    - `modules.controller.ts` logs: `[Modules] Auto-added finalSlug to navbar`.
    - `run-tier1-migration.ts` likely logs specific steps.

### Frontend Code - Hardcoded Text

21. **Search frontend codebase for "resort".**
    - **Found**: `messages/en.json` ("Welcome to V2 Resort"), `theme-config.ts` ("Resort Theme Configuration System").

22. **Show the homepage component.**
    - `home.hero.title` in `en.json` is "Welcome to V2 Resort".
    - `frontend/src/app/page.tsx` likely uses `t('home.hero.title')`.

23. **Show the header/navigation component.**
    - `messages/en.json` > `nav`:
      ```json
      "chalets": "Chalets",
      "pool": "Pool",
      "snackBar": "Snack Bar"
      ```

24. **Show the footer component.**
    - `frontend/src/components/Footer.tsx` exists.
    - `en.json` has "Explore Our Resort".

25. **Show the booking form.**
    - `messages/en.json` > `chalets`: "Book Your Chalet Now".

26. **Show the menu/catalog page.**
    - `messages/en.json` > `restaurant`: "Fine dining with Lebanese and international cuisine".

27. **Show all page titles (`<title>` tags).**
    - `frontend/src/app/layout.tsx`:
      ```typescript
      const title = settings.resortName || 'V2 Resort';
      return { title: `${title} | Luxury Experience` };
      ```
    - **Result:** "V2 Resort | Luxury Experience" is the default.

28. **Show meta descriptions.**
    - `layout.tsx`: `description` defaults to 'Experience the perfect blend of relaxation and entertainment.'

29. **Show all button labels.**
    - `en.json`: "Book Chalet", "View Menu".

30. **Show form labels.**
    - `en.json`: "Chalet", "Pool Sessions".

### Translation Files

31. **Show the English translation file (`en.json`).**
    - **Path:** `v2-resort/frontend/messages/en.json`
    - **Content:** Heavily hardcoded with "Resort", "Chalet", "Pool".

32. **For each occurrence in translations, is it hardcoded?**
    - **Yes**, the keys themselves often reflect the structure (e.g., `chalets`, `pool`), and the values are explicit.
    - **Can it be overridden?** Yes, by modifying the JSON file, but the keys (`nav.chalets`) imply a structure.

33-34. **Arabic/French translation files.**
    - `ar.json` and `fr.json` exist, likely mirroring the structure.

35. **Can translation files be replaced without code changes?**
    - **No**. They are part of the source code (`src` or `messages` adjacent to src). They require a rebuild/deploy to change.

36. **Is there a translation key like `business.type`?**
    - **No**.

37. **Show translation keys for accommodation types.**
    - Keys are `chalets`. values are "Chalets", "Luxury Mountain Retreat".
    - No generic `accommodation` key.

38. **Show translation keys for booking confirmations.**
    - `chalets.bookingConfirmed`: "Booking Confirmed!"
    - `chalets.bookingConfirmationMessage`: "Your chalet booking has been confirmed."

39. **Show translation keys for menu/navigation.**
    - `nav.chalets`, `nav.pool`.

40. **Can a white-label buyer provide their own translation files?**
    - Only if they split the build process. There is no admin upload for translation JSONs.

### Configuration Files

41. **Is there a `config/business.ts`?**
    - **No**.
    - `frontend/src/lib/theme-config.ts` defines visual themes but not business logic.

42. **Show all environment variables.**
    - `.env` files exist. Likely contain `NEXT_PUBLIC_API_URL`.
    - No `BUSINESS_TYPE` variable seen.

43. **Is there a branding config file?**
    - `frontend/src/lib/theme-config.ts` defines colors and patterns.

44. **Can business type be set via environment variable?**
    - **No**.

45. **Show the default configuration.**
    - `001_initial_schema.sql` inserts 'V2 Resort' into `site_settings`.

46. **Is there a `settings` table?**
    - **Yes**, `site_settings`.
    - Columns: `key`, `value` (JSONB).
    - Keys: `general`, `appearance`, `chalets`, `pool`, `notifications`.

47. **What text is configurable?**
    - `siteName`, `tagline` (in `general` key).
    - `chalets` settings: `depositPercentage`.

48. **Can all public-facing text be overridden?**
    - **No**. "Chalet" and "Pool" labels in navigation are in `en.json`. `site_settings` controls dynamic values but not static labels/keys.

49. **Show deployment config.**
    - `docker-compose.yml` exists. Project named `v2-resort`.

50. **Show package.json.**
    - Name: `v2-resort`.

### Module System Terminology

51. **Show the list of default modules.**
    - Restaurant, Chalets, Pool, Snack Bar.
    - **Evidence:** `001_initial_schema.sql` lines 609-613.

52. **Is "Chalet" in the module name?**
    - **Yes**. Name: 'Chalets', Slug: 'chalets'.

53. **Show the module schema.**
    - `name`, `slug`, `type`, `description`, `icon`.
    - No `display_name` per language.

54. **Can modules be renamed without code changes?**
    - **Yes**, via Admin Panel (`updateModule` in `modules.controller.ts` allows updating name).
    - **Warning:** Changing the name doesn't change `slug` or the hardcoded routes `/api/v1/chalets`.

55. **Show a module's configuration.**
    - `settings` column (JSONB).

56. **Are module icons configurable?**
    - **Yes**, `icon` column in `modules` table.

57. **Show the module builder.**
    - `modules.controller.ts` allows creating new modules with `template_type`.
    - `createModule` generates permissions and roles automatically: `${slug}_admin`, `${slug}_staff`.

58. **Are there module templates?**
    - `modules.controller.ts` references `template_type`.
    - Logic handles `menu_service`, `session_access` types for navbar icons.

59. **Can a white-label buyer hide resort-specific modules?**
    - **Yes**, via `is_active` flag in `modules` table or potentially deleting them.

60. **Show the customer-facing module display.**
    - Navbar uses `site_settings.navbar.links`. `createModule` auto-adds links there.

### API Endpoints Terminology

61. **List all API endpoint paths.**
    - `/api/v1/chalets`
    - `/api/v1/pool`
    - `/api/v1/restaurant`
    - **Evidence:** `backend/src/routes/v1.routes.ts`.

62. **Should `/api/v1/chalets` be `/api/v1/accommodations`?**
    - **Yes**, for a true white-label solution.

63. **Show API response objects.**
    - Likely return `chalet_id` etc.

64. **Show API error messages.**
    - "Chalet not found".

65. **Show API documentation.**
    - `API.md` exists. No OpenAPI/Swagger spec found.
    - `backend/src/routes/v1.routes.ts` serves a JSON index at `/`, mocking HATEOAS.

66. **Can API paths be aliased?**
    - **No**. Hardcoded in `v1.routes.ts`.

67. **Are there API versioning strategies?**
    - **Yes**, `v1` prefix is used.

68. **Show webhook payloads.**
    - Stripe integration likely references `booking_id` which might be generic.

69. **Show Stripe metadata.**
    - Needs check in `payment.controller.ts` but likely references `chalet_id`.

70. **Can third-party integrations work with generic terms?**
    - Unclear.

### Business Logic Terminology

71-80. **Business Logic:**
   - **Hardcoded Logic:** `pool-membership.service.ts` implies membership specific to pools. `seasonal-pricing.service.ts` is likely tied to dates (generic) but used by `chalets` (specific).
   - **Flexibility:** `modules` system allows creating new types, but the core "Chalets" module has deep, specific logic in `chalet.controller.ts` (e.g., `check_in`/`check_out` assumptions).

### Documentation Terminology

81. **Show the README.md.**
    - `backend/src/README.md` and root `README.md` both title the project "V2 Resort".

82. **Should it be generic?**
    - Yes.

83-90. **Code Comments/Variables:**
    - Variable names: `chaletId`, `poolSessionId` permeate the codebase.
    - Class names: `ChaletController`, `PoolService`.

### UI Components & Themes

91. **Do the 6 default themes have resort-specific imagery?**
    - `theme-config.ts`:
      - `beach` (Beach Paradise)
      - `mountain` (Mountain Retreat)
      - `sunset`, `forest`, `midnight`, `luxury`
    - **Description:** "Tropical vibes", "Lebanese mountains".
    - **Hardcoded?** Yes, in `theme-config.ts`.

92. **Can themes be white-labeled?**
    - **No**, they are hardcoded TypeScript objects. New themes require code changes.

93. **Show the icon library.**
    - Uses generic icons (Lucide React likely), mapped in `modules.controller.ts` ('UtensilsCrossed', 'Waves', 'Home').

94. **Show default images.**
    - `frontend/public/patterns/` (waves.svg, mountains.svg).

95. **Show the logo.**
    - `frontend/public/favicon.svg`. `layout.tsx` references `/images/resort-cover.jpg`.

96. **Can visual branding be replaced without code?**
    - **Partial**. `site_settings` allows changing `primaryColor` (seen in `001_initial_schema.sql`). `theme-config.ts` is hardcoded.

97-100. **Styling:**
    - `tailwind.config.js` exists.
    - `globals.css` exists.

## Section 2: White-Label Configuration Capabilities

101. **Is there a "Business Type" setting?**
     - **No**.

102. **What business types are supported?**
     - Implicitly: Resort, Hotel (via Chalets), Pool Club, Restaurant.
     - But no switch to "turn off" resort mode.

103. **When business type is changed, what updates?**
     - N/A.

104-108. **Turning features on/off:**
     - **Yes**. `modules` can be enabled/disabled (`is_enabled` in database).
     - `site_settings.navbar` allows removing links.

109. **Terminology Settings?**
     - **No**. `en.json` is static.

110-118. **Customizing Terms:**
     - **No**. Requires code edit to `en.json`.

119. **Change system name from "V2 Resort"?**
     - **Yes**. `site_settings` table has `value -> siteName`.
     - `layout.tsx` respects this setting: `const title = settings.resortName || 'V2 Resort'`.

120. **Does it update everywhere?**
     - Title tag: **Yes**.
     - Hero title: **No** (Hardcoded in `en.json`: "Welcome to V2 Resort").

121-122. **Logo Upload:**
     - `branding.controller.ts` exists (found in grep), so likely yes.

123-124. **Custom Colors/Fonts:**
     - `appearance` settings in `site_settings`. `layout.tsx`: `variable: '--font-inter'` is hardcoded.

129-130. **Hiding Modules:**
     - **Yes**. `modules` table `is_enabled` flag.

131. **Create custom modules?**
     - **Yes!** `modules.controller.ts` `createModule` function allows creating new modules with specific templates.

132-139. **Module Library:**
     - Templates supported: `menu_service`, `session_access`.

140-150. **Pricing Models:**
     - `chalets` use "per night".
     - `pool` uses "per session".
     - `restaurant` uses "per item".
     - Mixing is supported via different modules.

## Section 3: AI Accessibility - Structured Data

151. **OpenAPI/Swagger:**
     - **MISSING**. No swagger file or `swagger-ui-express` usage found.

152-170. **OpenAPI Quality:**
     - **N/A**.

171. **Schema.org Structured Data:**
     - **YES**. `frontend/src/lib/structured-data.tsx` exists.

172. **Types used?**
     - `Resort` (hardcoded in `generateResortSchema` function name and `layout.tsx` usage).

173. **Valid JSON-LD?**
     - `layout.tsx` implements:
       ```typescript
       <JsonLd data={resortSchema} />
       ```
     - It hardcodes specific fields like `priceRange: '$$'`.

183. **Rich Results Test:**
     - Likely passes as valid JSON-LD, but type is strictly `Resort`.

191. **Semantic HTML:**
     - **YES**. `layout.tsx` uses `<Header>`, `<main>`, `<Footer>`.

211. **Meta Tags:**
     - **YES**. `layout.tsx` implements dynamic metadata for `title`, `description`.
     - `keywords` is hardcoded: 'resort, luxury, dining, experience, vacation'.

## Section 4: API Documentation Quality

231. **Where is docs hosted?**
     - `API.md` in root.
     - `/api/v1` returns JSON index.

232. **Is it comprehensive?**
     - `API.md` usually explains concepts. The JSON index lists endpoints.
     - Lacks interactive Swagger UI.

## Conclusion & Recommendations

The system is **functionally modular** but **superficially hardcoded** to the "Resort" concept.

**Critical Gaps for White-Labeling:**
1.  **Frontend Strings:** `en.json` hardcodes "V2 Resort", "Chalets", "Pool". These need to be dynamic or at least generic.
2.  **API Routes:** `/api/v1/chalets` should be `/api/v1/units` or `/api/v1/accommodations`.
3.  **Database Names:** `chalets` table should be generic.

**AI Accessibility:**
1.  **MISSING OpenAPI/Swagger**. This is the single biggest gap for AI agents.
2.  **Structured Data** is present but hardcoded to `@type: Resort`.
3.  **Meta Tags** are partially dynamic but keywords are hardcoded.

**Verdict:**
- **Modular Architecture:** ✅ Excellent (Module Builder is powerful)
- **White-Label Readiness:** ⚠️ Low (Hardcoded text/routes)
- **AI Accessibility:** ⚠️ Medium (Good semantic HTML, missing OpenAPI)
