# PRD: VIP Course Studio — Component-Driven Course Builder

**Status:** Draft v1  
**Target Audience:** VIP members (wallet-holding membership card holders)  
**Related Systems:** Main 12-week course (`/course`), Personal 4-week courses (`/course/personal`), Admin Content Studio (`/admin/content`), BlueChat, `CourseBuilderInline`  
**Goal:** Un-hardcode all course content, replace with a drag-and-drop component studio, eliminate the BlueChat inline card flow.

---

## 1. Executive Summary

The current course system has three problems:

1. **All 12-week content is hardcoded TypeScript** — `weekSections.tsx` (854 lines), `AccordionJournalCard.tsx` (1319 lines), and the `WEEKLY_READINGS` array in `course/page.tsx`. Changing any task requires a code deploy.
2. **Course creation is buried inside BlueChat** — the `CourseBuilderInline` component renders as a small card inside the chat panel, visually cramped and disconnected from the courses page.
3. **No component system** — the current `JournalSection` type supports only 10 hardcoded task types (`text`, `list`, `blurts`, `lives`, `checklist`, `time-map`, `enjoy-list`, `life-pie`, `numbered-list`, `affirmations`). There is no way to add rich media, quizzes, dropdowns, or modern interactive components.

**The fix:** Replace the entire hardcoded content layer with a database-driven component system. VIP users get a full-screen Course Studio on `/courses` that replaces the BlueChat inline card. The studio uses a drag-and-drop palette of reusable interactive components.

---

## 2. What Changes

### 2.1 Delete / Replace

| Current | Replacement |
|---|---|
| `components/accordion-journal/weekSections.tsx` (854 lines) | DB-driven content fetched from new `course_weeks` + `course_components` tables |
| `components/accordion-journal/AccordionJournalCard.tsx` week 1 & 2 hardcoded arrays | Same DB-driven content |
| `WEEKLY_READINGS` array in `app/course/page.tsx` | Readings stored as component type `rich_text` or `markdown_file` in the DB |
| `WEEK_TITLES` array in `app/course/page.tsx` | Stored per-week in `course_weeks.title` |
| `CourseBuilderInline` in BlueChat (`components/blue-chat/CourseBuilderInline.tsx`) | Full-screen modal on `/courses` page (see §3) |
| `__blueCourseBuilderOnOpen` flag + `toggleBlueChat` event | Direct modal open via React state |
| `lib/personal-course.ts` static `FOCUS_TRACKS` | Migrated to DB as prebuilt course templates |

### 2.2 Keep (but wire to new system)

| Component | Role |
|---|---|
| `WeekTasksView` | Still renders the week content, but receives components from DB instead of hardcoded arrays |
| `AccordionJournalCard` | Still renders individual journal sections, but receives `JournalComponent[]` from DB |
| `admin/content` (AdminContentStudio) | Still exists for admin-level CRUD on academy courses, but **VIP Course Studio** is a separate, more visual tool |

---

## 3. User Flow (VIP Mode)

### New "/courses" Page Flow

```
[courses page]
    │
    ├── Card: "Creative Healing" (existing, always visible)
    │
    ├── Card: Personal Course (existing if one exists)
    │
    └── Button: "Create Course" (replaces current "+" icon)
            │
            ▼
    [Full-screen modal opens]
    │
    ├── Header: "Course Studio" + close (X)
    │
    ├── LEFT PANEL: Component Palette
    │   ├── Drag source: Rich Text Box
    │   ├── Drag source: Multiple Choice
    │   ├── Drag source: Dropdown Menu
    │   ├── Drag source: Image Embed
    │   ├── Drag source: Video Embed
    │   ├── Drag source: File Upload
    │   ├── Drag source: Text Input
    │   ├── Drag source: Rating Scale
    │   ├── Drag source: Reflection Journal
    │   ├── Drag source: Quiz Block
    │   └── Drag source: Markdown File (.md upload)
    │
    ├── CENTER: Course Canvas
    │   ├── Week tabs (Week 1–4 or configurable N weeks)
    │   ├── Each week has:
    │   │   ├── Title field (editable inline)
    │   │   ├── Read section (drop a Rich Text or Markdown File component)
    │   │   └── Task list (drop any interactive component)
    │   ├── Reorder: drag components within a week
    │   └── Add week button
    │
    ├── RIGHT PANEL: Selected Component Inspector
    │   ├── Editable props based on component type
    │   ├── Preview of the component
    │   └── Delete component button
    │
    └── Footer: "Save Draft" | "Publish Course"
```

The current flow in BlueChat (`topic input → AI generation → preview → save`) is **replaced** by this direct visual builder. The AI draft feature can be added as a "Generate with AI" button inside the studio that pre-fills the canvas, but the primary mode is manual drag-and-drop construction.

---

## 4. Component Library Specifications

### 4.1 Data Model

```typescript
// === NEW: Core component type (replaces JournalSection) ===

type ComponentType =
  | 'rich_text'
  | 'multiple_choice'
  | 'dropdown'
  | 'image_embed'
  | 'video_embed'
  | 'file_upload'
  | 'text_input'
  | 'rating_scale'
  | 'reflection_journal'
  | 'quiz_block'
  | 'markdown_file';

interface CourseComponent {
  id: string;                    // UUID
  weekId: string;                // FK -> course_weeks.id
  sortOrder: number;
  componentType: ComponentType;
  title: string;                 // Display title
  config: Record<string, unknown>; // Type-specific props (see §4.2)
  required: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CourseWeek {
  id: string;
  courseId: string;              // FK -> courses.id (reuses academy_courses or new table)
  weekNumber: number;
  title: string;
  theme: string;
  components: CourseComponent[]; // Ordered by sortOrder
  status: 'draft' | 'published';
}

interface Course {
  id: string;
  userId: string;                // Owner (the VIP who created it)
  slug: string;
  title: string;
  focus: string;
  coverImageUrl: string | null;
  weeks: CourseWeek[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Per-Component Config Schemas

| Component Type | `config` fields |
|---|---|
| **rich_text** | `{ content: string, format: 'markdown' \| 'html' }` |
| **multiple_choice** | `{ question: string, options: [{ id: string, text: string, isCorrect: boolean }], allowMultiple: boolean, showFeedback: boolean }` |
| **dropdown** | `{ label: string, options: [{ id: string, value: string, displayText: string }], placeholder: string, required: boolean }` |
| **image_embed** | `{ url: string, alt: string, caption: string, width: string, alignment: 'left' \| 'center' \| 'right' }` |
| **video_embed** | `{ url: string, provider: 'youtube' \| 'vimeo' \| 'upload', transcript: string }` |
| **file_upload** | `{ acceptedTypes: string[], maxSizeMb: number, multiple: boolean }` |
| **text_input** | `{ placeholder: string, maxLength: number, inputType: 'text' \| 'email' \| 'number', validation: { min?: number, max?: number, pattern?: string, required: boolean } }` |
| **rating_scale** | `{ min: number, max: number, step: number, labels: Record<number, string> }` |
| **reflection_journal** | `{ prompt: string, minWords: number, saveEnabled: boolean }` |
| **quiz_block** | `{ timeLimitMinutes: number, passingScore: number, questions: MultipleChoiceConfig[] }` (reuses multiple_choice shape) |
| **markdown_file** | `{ url: string, originalName: string, content: string }` (content cached from uploaded .md) |

---

## 5. Rendering Pipeline

### Current (hardcoded):

```
weekSectionsMap[weekNumber] (TypeScript array)
    → AccordionJournalCard (renders based on JournalSection.type)
    → switch(type): text | list | blurts | lives | checklist | time-map | enjoy-list | life-pie | numbered-list | affirmations
```

### New (DB-driven):

```
/api/course/[courseId]/weeks (fetches CourseWeek[])
    → WeekTasksView (iterates components)
    → <ComponentRenderer component={...} />
    → switch(componentType):
        rich_text          → <RichTextEditor content={config.content} />
        multiple_choice    → <MultipleChoice question={config.question} options={config.options} />
        dropdown           → <DropdownMenu options={config.options} />
        image_embed        → <ImageEmbed url={config.url} caption={config.caption} />
        video_embed        → <VideoEmbed url={config.url} provider={config.provider} />
        file_upload        → <FileUpload ... />
        text_input         → <TextInput ... />
        rating_scale       → <RatingScale min={config.min} max={config.max} />
        reflection_journal → <ReflectionJournal prompt={config.prompt} />
        quiz_block         → <QuizBlock questions={config.questions} />
        markdown_file      → <MarkdownReader url={config.url} />
```

Each renderer component is a reusable presentational component that accepts a `CourseComponent` prop and renders the interactive UI. **Data persistence** (saving user answers for a given component within a week) goes through the existing `/api/ethereal-progress` endpoint, keyed by `component.id` instead of `JournalSection.id`.

---

## 6. Database Schema Changes

### New table: `course_weeks`

```sql
CREATE TABLE course_weeks (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id CHAR(36) NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  theme VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, week_number)
);
```

### New table: `course_components`

```sql
CREATE TABLE course_components (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id CHAR(36) NOT NULL REFERENCES course_weeks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  component_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}',
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### New column on `academy_courses` (or a new `vip_courses` table)

The simplest approach: reuse `academy_courses` by adding a `user_id` column (nullable — null means admin-created). This unifies the two course systems under one schema.

```sql
ALTER TABLE academy_courses ADD COLUMN user_id VARCHAR(36) NULL;
```

Alternatively, a separate `vip_courses` table if we want isolation from the admin CMS.

---

## 7. API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/vip/courses` | List VIP user's created courses |
| `POST` | `/api/vip/courses` | Create a new course |
| `GET` | `/api/vip/courses/[id]` | Get full course with weeks + components |
| `PATCH` | `/api/vip/courses/[id]` | Update course metadata |
| `DELETE` | `/api/vip/courses/[id]` | Delete course (cascade) |
| `POST` | `/api/vip/courses/[id]/weeks` | Add a week |
| `PATCH` | `/api/vip/courses/[id]/weeks/[weekId]` | Update week (title, theme) |
| `DELETE` | `/api/vip/courses/[id]/weeks/[weekId]` | Delete week |
| `POST` | `/api/vip/courses/[id]/weeks/[weekId]/components` | Add a component |
| `PATCH` | `/api/vip/courses/[id]/weeks/[weekId]/components/[compId]` | Update component config |
| `DELETE` | `/api/vip/courses/[id]/weeks/[weekId]/components/[compId]` | Delete component |
| `PUT` | `/api/vip/courses/[id]/weeks/[weekId]/components/reorder` | Batch reorder components |
| `POST` | `/api/vip/courses/[id]/publish` | Publish (make visible to user) |

All endpoints gated by `walletHoldsVipMembershipCard(user.walletAddress)`.

---

## 8. Migration: Hardcoded → DB

The existing 12-week "Creative Healing" course content must be migrated from TypeScript to DB:

1. Create a seed script (`scripts/seed-creative-healing.ts`) that:
   - Reads `weekSectionsMap` + inline week 1 & 2 from `AccordionJournalCard.tsx`
   - Reads `WEEKLY_READINGS` + `WEEK_TITLES` from `course/page.tsx`
   - Inserts rows into `academy_courses`, `course_weeks`, and `course_components`
   - Maps each `JournalSection.type` to the closest `ComponentType`:
     - `text` → `rich_text`
     - `list` → `text_input` with `config.multiple = true`
     - `checklist` → `multiple_choice` with `allowMultiple = true`
     - `blurts` → two `text_input` components paired
     - `time-map`, `life-pie`, `enjoy-list` → `rich_text` with structured template
     - `affirmations` → `text_input` × 3
2. After seeding, the rendering layer (`WeekTasksView`, `AccordionJournalCard`) switches from the hardcoded map to the DB fetch.
3. The old `weekSections.tsx` and `weekSectionsMap` are deleted.

---

## 9. UI / Visual Specification

### Course Studio Modal (replaces BlueChat inline card)

- **Trigger:** "+" button on `/courses` page — currently opens BlueChat, instead opens the modal directly
- **Size:** Full viewport (or `max-width: 1280px`, centered, with overlay backdrop)
- **Layout:** 3-column (palette | canvas | inspector), matching the structure of `AdminContentStudio` but visual and drag-enabled instead of form-based
- **Components palette** (left, ~220px): Vertical list of draggable component cards, each with icon + label
- **Canvas** (center, flex): Tabs for each week, each tab shows the week's components as a vertical drop zone list. Components show a preview of their rendered output
- **Inspector** (right, ~300px): When a component on the canvas is clicked, show its editable config. Each component type renders its own inspector form with the config fields from §4.2
- **Drag & Drop:** Uses `@dnd-kit/core` + `@dnd-kit/sortable` for smooth reordering within a week and moving components between weeks
- **File upload:** Dragging a `.md` file into the canvas creates a `markdown_file` component with the file content extracted client-side and uploaded to Supabase storage

### AI "Draft with Blue" button

In the studio header, a button "Draft with Blue" opens a small inline prompt input (like the old CourseBuilderInline's topic/goal fields). On submit, it calls the existing `/api/course/draft` endpoint, and the returned `CourseData` is converted into `CourseComponent[]` and placed on the canvas. The user can then manually edit.

---

## 10. Acceptance Criteria

| # | Criterion |
|---|---|
| 1 | VIP user clicks "+" on `/courses` — opens full-screen Course Studio (not BlueChat) |
| 2 | Non-VIP user clicks "+" — sees upsell modal for VIP membership |
| 3 | Can drag any component from palette onto a week canvas |
| 4 | Can reorder components within a week by dragging |
| 5 | Clicking a component on canvas opens its config in the right inspector |
| 6 | All 11 component types render correctly in preview on canvas |
| 7 | Can upload a `.md` file or paste markdown as a `rich_text` read |
| 8 | Can embed YouTube/Vimeo URLs as `video_embed` |
| 9 | Can add/remove weeks (min 1, max configurable) |
| 10 | Course saves as draft; can be published |
| 11 | Published course renders on `/course/[slug]` or in dynamic personal course area |
| 12 | The old `weekSections.tsx` file is deleted (content lives in DB) |
| 13 | The old `CourseBuilderInline.tsx` is deleted or gutted |
| 14 | The `__blueCourseBuilderOnOpen` window hack is removed |
| 15 | Seed script successfully migrates Creative Healing 12-week content to DB |
| 16 | `/course` page loads week content from DB (with fallback if DB empty) |
| 17 | Progress saving still works — user answers per component persisted via `ethereal-progress` |
| 18 | All endpoints gated behind VIP check |

---

## 11. Implementation Phases

### Phase 1 — Foundation (DB + API + Seed)
- Create `course_weeks` and `course_components` tables with `ensureCourseContentSchema`-style auto-migration
- Create `/api/vip/courses/*` CRUD endpoints with VIP gating
- Write seed script for Creative Healing 12-week content
- Update `course/page.tsx` to fetch from DB instead of `weekSectionsMap`

### Phase 2 — Component Renderers
- Build each of the 11 presentational component renderers (`<RichTextEditor>`, `<MultipleChoice>`, `<DropdownMenu>`, etc.)
- Build `<ComponentRenderer>` switch component
- Wire progress saving to component IDs

### Phase 3 — Course Studio UI
- Build the full-screen modal with 3-column layout
- Build the component palette (left)
- Build the week canvas with tabs + drop zones (center)
- Build the inspector panel (right)
- Integrate `@dnd-kit` for drag-and-drop
- Remove `CourseBuilderInline` and `__blueCourseBuilderOnOpen` hack

### Phase 4 — AI Draft Integration + Polish
- Add "Draft with Blue" button that converts AI response to canvas components
- Upload flow for markdown files to Supabase storage
- Publish flow
- Delete old hardcoded files

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Migration of 10 custom JournalSection types to 11 generic component types loses semantic meaning | Map explicitly per §8; the `time-map` / `life-pie` / `blurts` types become structured `rich_text` with templates preserved |
| Progress data breaks because component IDs change from hardcoded strings to DB UUIDs | Add compatibility layer: `ethereal-progress` maps old section IDs to new component IDs during migration |
| VIP gating adds latency to every page load | Cache VIP status client-side with 60s TTL (already exists in `vip-membership-card.ts`) |
| Drag-and-drop state complexity | Use `@dnd-kit` with a flat component array + `sortOrder`; backend persists on reorder |
| File uploads need storage | Already have Supabase; reuse existing upload pattern from `image_embed` |
