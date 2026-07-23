# LinkedIn Marketing System Architecture

Source: [LinkedIn Marketing System Architecture](https://app.notion.com/p/3a297ad572998120bae7f8f5326c6d1f) (Notion)

A ten-step system split into two phases: build a platform-specific knowledge folder once, then draw from it repeatedly to generate on-brand, publish-ready content.

**Example platform:** LinkedIn (`/linkedin`)
**Storage format:** Markdown files
**Research tools:** Claude + Gemini
**Output cadence:** 5 batches × 10 posts

## Setup — build the folder (once)

Run once, then refresh occasionally as the platform or brand voice evolves.

**1. Deep research** — *Phase 1: Deep Research*
Claude + Gemini deep research on the platform itself: top-performing post breakdowns, algorithm and ranking advice, growth blog posts, platform rules and best practices. This builds a knowledge base of how the platform actually works, before copying anyone.

**2. Reference mining** — *Phase 2: Reference Mining*
Identify 3–5 reference accounts that match your style and brand — enough to avoid overfitting to a single voice.

**3. Pull post data** — *Phase 2: Reference Mining*
Collect hooks, structure, cadence, and engagement patterns from each reference account.

**4. Extract patterns** — *Phase 3: Structure the Folder*
Feed everything collected so far to Claude and extract the repeatable patterns — not just raw examples, but what actually makes them work.

**5. Brand filter logic** — *Phase 3: Structure the Folder*
Build the cleaning layer that strips the reference accounts' borrowed voice and re-applies your own brand rules — for MWA, that means no crypto vocabulary, no emojis, no hashtags, and "Diamonds" or "credits" only for currency.

**6. Save to folder** — *Phase 3: Structure the Folder*
Save all of it as markdown files inside the platform folder — research notes, reference data, the pattern library, and the brand-filter rules. This becomes the system's permanent knowledge base.

> 📁 **/linkedin** — everything from steps 1–5, saved as markdown, read by every runtime pass below.

## Runtime — use the folder (every time)

Run every time you need new content. No re-research required.

**7. Batch generation** — *Phase 4: Batch Generation*
Generate in batches — for example, 5 batches of 10 posts each — filtered through the brand rules already saved in the folder.

**8. Review and pick** — *Phase 4: Batch Generation*
You review each batch and select the strongest options. Human-in-the-loop, not automatic selection.

**9. Clean picked content** — *Phase 5: Publish*
Claude points back to the platform folder and cleans the picked content, applying the saved brand-filter rules so it reads as fully on-brand.

**10. Upload / schedule** — *Phase 5: Publish*
Publish-ready content goes out — manually or via a scheduler.

> ↻ **Optional feedback loop**
> Track which published posts actually perform, and feed that back into step 5's brand-filter rules. Without this, the system never improves after the initial setup.

## Same system, different folders

The ten steps don't change — only the platform-specific research in step 1 and the reference accounts in step 2.

| Folder | Tone | Notes |
| --- | --- | --- |
| `/linkedin` | Professional, B2B | MWA case studies, hackathon updates, career-facing content. Strict brand rules on vocabulary. |
| `/general` | Reusable core | Platform-agnostic version of the pipeline, for testing on any new channel before building it a dedicated folder. |

*Setup runs once per platform folder. Runtime runs every time a new batch of content is needed. Refresh the setup phase when platform algorithms shift or brand guidelines change.*
