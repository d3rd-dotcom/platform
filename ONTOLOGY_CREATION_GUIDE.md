# Build an ontology people can actually use

An ontology turns messy information into a map of people, places, things, events, and relationships.

This guide helps you prepare the right documents, ask the right question, and get a better simulation report. It is written for one goal: every heading, table, and paragraph should make the reader want to read the first sentence.

## Start with one clear question

A good ontology starts with one question the system can follow.

Bad question: "Tell me what is going on with my network."

Better question: "Which people in my Artizen work network are most likely to help move a project forward, and where are the trust gaps?"

## Know what an ontology is good for

An ontology is best when the answer depends on relationships.

| Use an ontology for this | Why it helps |
| --- | --- |
| Mapping people and teams | It shows who works with whom, who trusts whom, and who influences decisions. |
| Reading a community | It shows groups, roles, topics, conflicts, and shared goals. |
| Simulating outcomes | It gives agents enough context to act like part of the same world. |
| Finding hidden gaps | It can reveal missing links, weak ties, repeated issues, and unclear ownership. |
| Building memory for AI | It gives an AI a structured map instead of a pile of notes. |

## Know the main benefits

A good ontology helps people and AI remember the same world.

The benefit is simple: faster recall, better reports, clearer decisions, and fewer missed details. Instead of reading every document again, the system can follow the map of who did what, when it happened, and why it matters.

## Know what an ontology is not for

An ontology is not magic, and it does not fix weak source material.

If the documents are vague, the graph will be vague. If the names are inconsistent, the graph may split one person into two nodes. If the goal is unclear, the report may answer the wrong question.

## Use the right file formats

The current upload flow accepts PDF, Markdown, and plain text files.

Use these formats when you prepare your source pack:

| Format | Best use |
| --- | --- |
| `.pdf` | Reports, bios, essays, public pages saved as PDFs, meeting notes exported from docs. |
| `.md` or `.markdown` | Clean structured notes with headings, lists, tables, and relationship maps. |
| `.txt` | Simple raw notes, transcripts, copied emails, and short briefs. |

## Turn messy files into clean text

Clean documents give the graph better nodes and better edges.

If you have spreadsheets, slides, screenshots, or messy docs, turn the important parts into Markdown or text first. The system reads text. It does not understand a screenshot as well as a clean note with names, roles, dates, and relationships.

## Prepare a simple source pack

A strong source pack is small, clear, and focused.

For most projects, prepare 3 to 7 short documents. One long dump can work, but a few focused files are easier for the system to read.

Recommended files:

| File | What it should include |
| --- | --- |
| `01_overview.md` | The goal, the world, and the main question. |
| `02_people.md` | Names, roles, skills, projects, and notes about each person. |
| `03_relationships.md` | Who works with whom, who trusts whom, who blocks whom, and why. |
| `04_events.md` | Meetings, launches, conflicts, wins, deadlines, and key moments. |
| `05_terms.md` | Important words, project names, inside jokes, tools, and acronyms. |

## Name people the same way every time

Consistent names help the graph avoid duplicate people.

Pick one name for each person and reuse it everywhere. If a person has a nickname, include it once in the people file. Example: "James, also called J, is the project lead."

## Give relationships real verbs

Relationships are the edges of the graph, so make them clear.

Use verbs like `WORKS_WITH`, `TRUSTS`, `FUNDS`, `MENTORS`, `BLOCKS`, `INTRODUCED`, `REPORTS_TO`, `COLLABORATES_ON`, or `DISAGREES_WITH`. A clear verb tells the system what kind of link exists between two things.

## Add time when time matters

Dates help the graph understand change.

Write dates when a relationship started, changed, or ended. Example: "In March 2026, Maya introduced James to the Artizen review team." This helps the report separate old context from current context.

## Say what you want the report to decide

The report is better when it has a decision to make.

Instead of asking for a general summary, ask for a forecast, ranking, risk map, or next-step plan. Example: "Rank the top 10 collaborators by likely project impact over the next 90 days."

## Price the report clearly

People should know the cost before they generate a report.

Current platform access is tied to the VIP Membership, which is a one-time $89.90 purchase. Each simulation report is charged separately at the price shown before generation.

**Pricing copy to finalize before launch:**

| Item | Price | What the user gets |
| --- | ---: | --- |
| VIP Membership | $89.90 once | Access to the platform and gated simulation workflow. |
| Simulation report | $___ per report | One generated report from the finished simulation and graph. |

Replace `$___` with the live report price before sharing this guide with users.

## Make every line pull the reader forward

Every heading, subheading, paragraph, and data visual has one job: get the reader to read the first sentence.

Use plain words. Put the useful point first. Cut any line that only sounds smart. If a chart or table needs a long explanation, rewrite the chart.

## Use data visuals as invitations

A data visual should make the next sentence easier to read.

Good visual rule: the title tells the reader why the visual matters, not just what it is.

Bad title: "Relationship chart"

Better title: "Who can move the project forward?"

Example relationship map:

```text
James -> WORKS_WITH -> Artizen team
James -> NEEDS_HELP_FROM -> Grant reviewers
Artizen team -> FUNDS -> Public goods projects
Grant reviewers -> EVALUATE -> Project story and proof
```

## Check the ontology before you build the graph

A fast review saves a weak report.

Before building the graph, check the entity types and relationship types. If the system missed an important kind of person, event, or relationship, improve the source docs and rebuild.

## Add new context after the graph is built

A finished graph can keep learning when new facts appear.

Open the completed world, select **Knowledge graph**, and use **Add new context**. Write one clear fact per line, such as `Maya Chen -> REVIEWS -> Artizen application`. The graph will refresh with extracted nodes and relationships. An older setup run or report will not change unless you run it again.

## Best practices for good results

Good results come from clear context, not huge files.

Use these rules:

- Write one clear main question.
- Keep each document focused on one job.
- Use the same name for each person, place, project, and group.
- Add dates when timing changes the meaning.
- Write relationships as clear verbs.
- Include conflicts, risks, and unknowns.
- Remove filler, repeated text, and old drafts.
- Tell the system what kind of answer you want.

## Common mistakes to avoid

Most weak reports come from weak inputs.

Avoid these mistakes:

- Uploading screenshots instead of readable text.
- Mixing ten different goals in one project.
- Calling the same person by five names.
- Leaving out the actual decision you need.
- Hiding conflict because it feels messy.
- Uploading huge files with only a few useful pages.

## Final checklist before upload

This checklist helps you catch problems before the system does.

- Do I have one clear world name?
- Do I have one clear question?
- Did I upload PDF, Markdown, or TXT files?
- Did I list the main people, groups, projects, and events?
- Did I explain the key relationships?
- Did I include dates for important moments?
- Did I say what the final report should decide?
- Did I remove private information I do not want processed?
- Did I confirm the per-report price shown to the user?

# Artizen template: people I work with ontology

Use this template when you want to map collaborators, funders, reviewers, friends, mentors, and project partners.

Copy this section into a new Markdown file named `artizen_people_ontology.md`, then fill it in.

## 1. World name

Give the ontology a name people understand in one glance.

**World name:** Artizen work network ontology

## 2. Main question

Write the decision you want the report to help with.

**Main question:** Which people in my Artizen network are most likely to help move my work forward, and what relationships need care?

## 3. Short description

Explain the world in five sentences or less.

**Description:** This ontology maps the people I work with through Artizen and related creative projects. It includes collaborators, funders, reviewers, mentors, builders, artists, and community members. The goal is to understand trust, influence, project fit, communication gaps, and next steps.

## 4. People and roles

List each person once, with the name you want the graph to use.

| Person | Role | Main skills | Projects connected to them | Notes |
| --- | --- | --- | --- | --- |
| [Name] | [Founder, artist, reviewer, funder, builder, mentor] | [Skills] | [Projects] | [Important context] |
| [Name] | [Role] | [Skills] | [Projects] | [Notes] |
| [Name] | [Role] | [Skills] | [Projects] | [Notes] |

## 5. Groups and organizations

List the teams, communities, and institutions in the network.

| Group | What it does | People connected to it | Why it matters |
| --- | --- | --- | --- |
| Artizen | Funds and supports creative public goods projects. | [Names] | It connects my work to funders, reviewers, and collaborators. |
| [Group] | [What it does] | [Names] | [Why it matters] |

## 6. Projects

List the projects people are connected to.

| Project | Goal | People involved | Status | Risks |
| --- | --- | --- | --- | --- |
| [Project name] | [Goal] | [Names] | [Idea, active, paused, shipped] | [Risks] |
| [Project name] | [Goal] | [Names] | [Status] | [Risks] |

## 7. Relationship types

Use clear verbs so the graph knows what each connection means.

| Relationship type | Meaning | Example |
| --- | --- | --- |
| WORKS_WITH | Two people actively work together. | James WORKS_WITH [Name]. |
| TRUSTS | One person trusts another person's judgment. | James TRUSTS [Name]. |
| FUNDS | A person or group gives funding. | Artizen FUNDS [Project]. |
| REVIEWS | A person evaluates work or gives feedback. | [Name] REVIEWS [Project]. |
| INTRODUCED | One person connected two people. | [Name] INTRODUCED James to [Name]. |
| BLOCKS | A person, issue, or group slows progress. | [Issue] BLOCKS [Project]. |
| MENTORS | One person guides another. | [Name] MENTORS James. |
| COLLABORATES_ON | A person works on a specific project. | [Name] COLLABORATES_ON [Project]. |

## 8. Known relationships

Write real relationship lines in plain text.

```text
James WORKS_WITH [Name] on [Project].
[Name] INTRODUCED James to [Name] in [Month Year].
[Name] REVIEWS [Project] because [Reason].
Artizen FUNDS [Project] through [Program or round].
[Issue] BLOCKS [Project] because [Reason].
James TRUSTS [Name] for [Kind of advice].
```

## 9. Important events

Events help the graph understand timing.

| Date | Event | People involved | Why it matters |
| --- | --- | --- | --- |
| [Month Year] | [Event] | [Names] | [Why it changed the network] |
| [Month Year] | [Event] | [Names] | [Why it matters] |

## 10. Trust and communication notes

This section helps the report see the human side of the network.

Answer these prompts:

- Who do I trust for strategy?
- Who do I trust for execution?
- Who gives honest feedback?
- Who is hard to reach?
- Who has helped before?
- Who has unclear incentives?
- Where has communication broken down?

## 11. Risks and unknowns

Name the weak spots so the report can reason about them.

| Risk or unknown | Who it affects | Why it matters | What I want to know |
| --- | --- | --- | --- |
| [Risk] | [Names or project] | [Reason] | [Question] |
| [Unknown] | [Names or project] | [Reason] | [Question] |

## 12. Desired report output

Tell the system what kind of answer you want.

Choose one or more:

- Rank my strongest collaborators.
- Find the biggest trust gaps.
- Map who can help each project next.
- Predict which relationships need care.
- Suggest 5 next actions for my Artizen network.
- Find missing people or groups I should reach out to.

## 13. Upload pack for Artizen

Use this file list when you are ready to build the ontology.

| File | Status |
| --- | --- |
| `01_artizen_overview.md` | Ready / Not ready |
| `02_people.md` | Ready / Not ready |
| `03_relationships.md` | Ready / Not ready |
| `04_projects.md` | Ready / Not ready |
| `05_events_and_risks.md` | Ready / Not ready |

## 14. Final prompt to paste into the simulation requirement box

Use this prompt when you create the world.

```text
Build an ontology of my Artizen work network. Map people, groups, projects, events, trust links, review links, funding links, collaboration links, and blockers. Use the graph to identify the strongest collaborators, weak ties, trust gaps, project risks, and next actions. The final report should help me decide who to work with next and which relationships need care.
```
