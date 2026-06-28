# Course Builder Bug Report

## Critical

### 1. No ownership checks on mutation API routes
**Files:** All routes under `app/api/vip/courses/[id]/` and sub-routes  
**Status:** Fixed

`assertCourseUser()` only verifies authentication — any authenticated user could read, modify, publish, or delete any course by ID. Added `assertCourseOwner(courseId)` that additionally checks `course.userId === userId`. Applied to all PATCH/DELETE/POST/PUT routes.

### 2. Stored XSS in RichTextRenderer
**File:** `components/course-renderers/RichTextRenderer.tsx:20`  
**Status:** Fixed

`dangerouslySetInnerHTML` renders HTML content with no sanitization. Any author could inject `<script>` tags or event handlers (`onload`, etc.) into course content. Added a `sanitizeHtml()` function that strips script tags, event handlers, and `javascript:` URLs.

---

## High

### 3. Seed reading components show "No content"
**File:** `scripts/seed-creative-healing.ts:449-454`  
**Status:** Fixed

The seed script stored reading content under `config.url` (a file path reference), but `RichTextRenderer` expects `config.content`. The weekly reading components rendered as "No content" for all 13 weeks. Changed to write `content: week.readingFile.description` so at least a summary renders. The full markdown content still needs to be loaded from the file path at `config.url`.

### 4. SQL injection in reorderCourseComponents
**File:** `lib/vip-course-db.ts:546-548`  
**Status:** Fixed

The `CASE` expression was built with string interpolation and single-quote escaping (`orderedIds.map(id => \`WHEN id = '${id.replace(/'/g, "''")}' THEN ...\`)`). Replaced with parameterized positional parameters (`$1, $2, ...`).

### 5. No UNIQUE constraint on vip_courses.slug
**File:** `lib/ensureVipCourseSchema.ts`  
**Status:** Fixed

`vip_courses.slug` had no uniqueness constraint. Duplicate slugs could exist, and `getVipCourseBySlug` silently returned only the first match. Added `UNIQUE (slug)` constraint.

### 6. Week 0 sort order produces -1
**File:** `components/course-studio/CourseStudioModal.tsx:467`  
**Status:** Fixed

`previewCourse` used `w.weekNumber - 1` for sort order. The seed script uses week 0 for an intro week, resulting in `sortOrder: -1`. Changed to `Math.max(0, w.weekNumber - 1)`.

---

## Medium (Fixed)

### 7. ComponentPanel description bypasses getConfigValue
**File:** `components/course-studio/ComponentPanel.tsx:384`  
**Status:** Fixed

The description textarea read `component.config?.description` directly instead of using `getConfigValue('description')`, creating inconsistency with other config fields that participate in the dual-source (localConfig + props) pattern. Changed to use `getConfigValue` and `handleFieldChange`.

### 8. Cross-week component selection not cleared
**File:** `components/course-studio/CourseStudioModal.tsx:608`  
**Status:** Fixed

Switching weeks did not clear `selectedComponentId`, so the inspector panel could show a component from a different week. Added `setSelectedComponentId(null)` to the week selection handler.

### 9. selectedWeekId can become empty string after save
**File:** `components/course-studio/CourseStudioModal.tsx:441`  
**Status:** Fixed

After saving content, `setSelectedWeekId` only used `savedCourse.weeks[0]?.id ?? ''`. If the response had no weeks, the ID became `''`. Added fallback to `weeks[0]?.id` from current state.

---

## Known Remaining Issues

### Not fixed (lower severity or out of scope)

- **RichTextRenderer markdown parser is minimal** — only handles `#`, `##`, `-`, and paragraphs. Bold, italic, links, images, code blocks render as plain text.
- **No publish validation** — empty courses can be published (no weeks/components required).
- **pgcrypto extension error silently swallowed** — if the DB user can't create extensions, `gen_random_uuid()` fails later with a confusing error.
- **No dirty-form guard on browser tab close** — unsaved changes are lost without warning.
- **`deriveSlug` returns empty string** for non-ASCII titles (Chinese, emoji, etc.), causing silent save failure.
- **Auto-fill writes `description` as orphaned config key** — not a recognized `CONFIG_FIELDS` key, cannot be cleared via normal UI.
- **No slug uniqueness enforcement in client** — the server has the constraint now, but the UI doesn't surface duplicate slug errors gracefully.
