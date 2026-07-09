# Open-source raw material for guides DAG

Raw, unedited source material pulled from open-license sources, staged here for a
future editorial rewrite pass before anything becomes a published guide. Nothing
in this directory is user-facing and nothing here has been written into the
`guides` table — see [mwa-guides-dag skill](../../.agents/skills/mwa-guides-dag)
before that step.

Every file must carry a metadata header: source name, source URL, license,
retrieval date. No paraphrasing at collection time — capture the source text
as-is so the later rewrite pass has the original to work from.

## Sources and licenses

| Source | Folder | License | Notes |
|---|---|---|---|
| NIMH (nimh.nih.gov) | `nimh/` | Public domain (US govt work) | No attribution required, but keep source URL for our own citation trail |
| MedlinePlus (medlineplus.gov) | `medlineplus/` | Public domain (US govt / NLM) | Same as above |
| CDC (cdc.gov) | `cdc/` | Public domain (US govt work) | Same as above |
| OpenStax Psychology (openstax.org) | `openstax-psychology/` | CC BY 4.0 | Requires attribution on eventual publish |
| MIT OpenCourseWare | `mit-ocw/` | CC BY-NC-SA (per-course, verify each) | **NonCommercial** — flag before using in any credit-gated or paywalled guide; reference/structuring use only until confirmed |

## Status
Initial collection pass complete (2026-07-09): 33 files staged — NIMH 7, MedlinePlus 9,
CDC 5, OpenStax Psychology 7, MIT OCW 5. See `nimh-medlineplus-cdc-collection-log.md`
and `openstax-mitocw-collection-log.md` for per-file sources and known gaps (no clean
standalone "habit formation" or "mindfulness basics" source page found; nothing invented
to fill those gaps). Editorial rewrite pass, guide creation, and prerequisite mapping
into the DAG are all still pending — this directory is raw material only.
