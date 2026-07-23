# visual-identity.md — color, typography, image/video specs

Source: [LinkedIn Content Architecture](https://app.notion.com/p/3a297ad57299817ab638fdd08d68d565) (Notion)

This file tells you what MWA content should look like on LinkedIn.

## Authority — and a documentation drift you need to know about

The color and typeface values below are pulled from the **live runtime source files**, for two confirmed reasons:

1. **`EDITORIAL.md`'s typography section is reversed relative to the live system.** It states "Headlines: Commit Mono Bold, Body: Space Grotesk." The actual live design system is the opposite: **Space Grotesk is the display/heading face, Commit Mono is the body face.** `EDITORIAL.md` also names "Roboto Mono or Departure Mono" for accents — neither exists in the live stack, which uses Patrick Hand.
2. **Blue's documented appearance palette doesn't match the live color system.** `mwa-blue/references/appearances.md` lists a palette (Review Blue `#4A90D9`, Deep Space `#0D1B2A`, Quantum White `#F0F4F8`, Warning Gold `#FFB800`) that matches nothing in the live `styles/color-system.css`. Use the values below instead.

## Color — real, current values

| Name | Hex / value | Use |
| --- | --- | --- |
| Academy Blue | `#5168FF` | Flagship brand shade |
| Action Blue | `#465BE0` | Accessible primary actions, small text on filled controls |
| Blackpill / Ink | `#1A1B24` | Bluish-black text |
| Canvas | `oklch(98% 0.008 270)` (light mode) | The cool blue-white foundation |
| Academy Indigo | `#50599B` | Rewards, progress, positive signals |
| Study Violet | `#7A56C6` | Restrained emphasis, secondary accents |
| Neon Pink | `#EC4899` | Card accent |
| Streak Green | `#8BE4AC` | Momentum, streaks, gamification |
| Gold | `#B58A00` | Warning / achievement signals |
| Danger | `#BA1A1A` | Error / danger states |
| Night (unified landing dark) | `#0A0C1F` | Black with a 12% Academy Blue tint — the landing page's dark base |

**For AI-image prompts:** lead with Academy Blue as the dominant brand color. Academy Indigo and Study Violet work as supporting/secondary tones. Streak Green and Gold evoke momentum, achievement, or reward as accents. Avoid Neon Pink as a dominant tone.

## Typography — real, current assignment

- **Display / headings / labels: Space Grotesk.**
- **Body / long-form text: Commit Mono.**
- **Accent / hand-drawn flourish: Patrick Hand** — sparingly, field-notes style content only.

Banned as primary faces: Arial, Helvetica, Times New Roman, bare system-default fonts.

## Atmospheric visual themes (from the landing page's cinematic language)

The landing page's motion mechanics don't apply to static LinkedIn content, but its recurring visual motifs are a legitimate, reusable source of imagery:

- **Ascent through indigo clouds toward a floating glass academy** — the arrival/hero motif.
- **Branching luminous paths forming worlds** — the "simulate your world" motif.
- **Orbital glass structures, a living network of light** (teal-tinted, `#44E990`) — the "ecosystem" motif.
- **Warm light through a library atrium, drifting pages** (amber-tinted, `#FF7729`) — the "belonging" motif.
- **Sunrise breaking over a cloud sea, light ascending** — the "invitation" motif.

The teal and amber tints are specific to the landing film's act structure, not the core brand palette — use only when deliberately evoking these motifs.

## Image specs for LinkedIn

- **Default to 4:5 vertical (1080×1350)** for standalone image posts and carousel slides — mobile-performance-optimized.
- **Use 1:1 square (1080×1080)** for a safe, no-cropping-risk middle ground.
- **Use 1.91:1 (1200×627) only** for link-preview-style display — unlikely for a native post.

## Current AI image models

Gemini / "Nano Banana" (Google), Flux Pro / Kontext (Black Forest Labs), Ideogram 3.0 (best text-in-image), GPT Image (OpenAI — DALL-E 3 is deprecated, don't reference it), Midjourney v7, Recraft V3 (vector/brand-consistent illustration).

Prompt structure: Subject + Setting + Style + Lighting + Composition + Technical.

## Current AI video tools

Veo 3 (Google), Sora 2 (OpenAI), Kling 2.5/3.0, Runway Gen-4, HeyGen (has an official MCP server).

**Caption rule:** max 2 lines on screen, 3–5 words per line — most social video is watched without sound.
