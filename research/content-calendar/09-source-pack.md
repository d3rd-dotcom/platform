# Content-calendar audit source pack

Access date for every item: **2026-07-17**. Files were collected only from the publisher's authoritative public URL. SHA-256 values were computed after download. `file`, `pdfinfo`, and byte counts were used to verify the local artifacts.

## Downloaded primary sources

| Publisher | Source and publication date | Authoritative URL | Local file | Verified type and size | SHA-256 | Audit purpose |
|---|---|---|---|---|---|---|
| Federal Trade Commission | *Bringing Dark Patterns to Light*, September 2022 | https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf | [`source-files/ftc-bringing-dark-patterns-to-light-2022.pdf`](source-files/ftc-bringing-dark-patterns-to-light-2022.pdf) | PDF 1.6, 48 pages, 2,166,521 bytes | `eaa9111ab5ec5f658d998a845386eb177f122721410aab287bb97a7134193d5b` | Audit every scarcity, countdown, demand, urgency, and limited-availability claim; especially the practices cited on pages 20–22 in memos 02 and 04. |
| National Center for Education Statistics, Institute of Education Sciences | *U.S. Adults With Low Literacy and Numeracy Skills: 2012/14 to 2017* (NCES 2022-004), May 2022 | https://nces.ed.gov/pubs2022/2022004.pdf | [`source-files/nces-adult-literacy-united-states-2022-004.pdf`](source-files/nces-adult-literacy-united-states-2022-004.pdf) | PDF 1.7, 2 pages, 132,627 bytes | `e192993dbe70585b581a1133eb4ff787204476e69b4f2ebe3947399b9db2286b` | Replace the unsupported national “sixth-grade average” claim with the report's defined population, year, proficiency measure, and limitations, as required by memos 03 and 04. |
| Federal Trade Commission | *BetterHelp: Final Decision and Order*, July 14, 2023 | https://www.ftc.gov/system/files/ftc_gov/pdf/2023169betterhelpfinalorder.pdf | [`source-files/ftc-betterhelp-final-order-2023.pdf`](source-files/ftc-betterhelp-final-order-2023.pdf) | PDF 1.7, 23 pages, 355,448 bytes | `f57edb08ff5f1340bae51b9d6a44d4854ff613f0eb2064beb3bb46ebfec6c96f` | Audit privacy, consent, sensitive-data advertising, retention, and disclosure recommendations drawn from the BetterHelp comparison in memo 06. |
| Coursera | *Global Skills Report 2025* report page, June 4, 2025 | https://www.coursera.org/skills-reports/global/pdf/gsr-2025 | [`source-files/coursera-global-skills-report-2025.html`](source-files/coursera-global-skills-report-2025.html) | HTML document, 310,163 bytes | `a4e4af7371e6710e18b68b6a92f58a34a3ac47644530113393431192afc513f5` | Preserve Coursera's authoritative report shell and methodology/scale context for the 170-million-plus learner and 100-plus-country claims cited in memo 05. |

## Download limitation

Coursera's authoritative `.../pdf/gsr-2025` URL returned a 310,163-byte HTML document rather than a PDF, even after redirects and a standard browser user agent. The publisher's report flow is client-rendered and presents a “Get report” interaction; no direct public PDF response was exposed at the cited authoritative URL. The response was therefore preserved with its correct `.html` extension. No unofficial mirror or third-party copy was substituted.

## Scope

The pack excludes marketing images, course material, secondary news copies, and live pages whose relevant evidence is already captured in the research memos. Project-reported blockchain campaign totals and competitor scale metrics remain attribution-dependent even when the originating page is first party.
