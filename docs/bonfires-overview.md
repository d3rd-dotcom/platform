# Bonfires.ai — Overview

> Research notes compiled from the official docs (docs.bonfires.ai) on 2026-06-04.
> Purpose: understand what Bonfires is, how it works, and where it might intersect with Mental Wealth Academy.

## TL;DR

Bonfires.ai is a **knowledge coordination platform**: it turns a community's group chat into a queryable, AI-accessible knowledge graph that acts as shared, persistent memory for the group. An agent sits in your Telegram/Discord, extracts structured knowledge every ~20 minutes, and you (or external AI tools) query it back out. It layers a crypto economy on top — a Genesis NFT for access, a `$KNOW` token for the wider network, and `x402` micropayments for monetizing published content.

Core insight: **the group, not the individual, is the unit that should have memory.** Conventional chatbots reset between sessions; a Bonfire accumulates and compounds community context over time.

---

## The Problem It Targets

Group conversations generate real value — decisions, rationale, insights — but nearly all of it disappears into chat history. When a new member joins or someone asks "why did we decide X?", the team has to excavate old messages or rely on whoever happens to remember. Bonfires treats that lost context as infrastructure worth building.

---

## How It Works (the loop)

1. An **agent** joins a group chat (Telegram or Discord) and listens continuously.
2. Every **~20 minutes**, a background process captures recent conversation and **extracts structured knowledge** — even messages no one replied to.
3. Knowledge is written into a **knowledge graph** (entities, relationships, episodes) plus a vector store.
4. Users **query the agent** (or other tools) to retrieve answers grounded in community history.
5. Understanding **compounds** as more data accumulates.

---

## Core Components

| Component | What it does |
|---|---|
| **Agent** | Lives in the group chat, listens continuously, responds when tagged |
| **Knowledge Graph** | Neo4j via Graphiti; stores entities, relationships, and episodes |
| **Vector Store** | Weaviate embeddings for semantic (meaning-based) search |
| **Documents & Chunks** | Uploaded PDFs/text/transcripts, split into chunks for processing |
| **Taxonomy & Labels** | Auto-classification propagated from summaries down to chunks |
| **Semantic Search ("Delve")** | Unified meaning-based querying rather than keyword matching |
| **HyperBlogs** | AI-generated, monetizable articles synthesized from the graph |
| **MCP Integration** | Connects external AI tools (Claude Desktop, Cursor, etc.) to the graph |

### Three ways knowledge gets in
- **Conversation capture** — the 20-minute background extraction from agent messages.
- **Document ingestion** — manual upload of PDFs/text; chunked, summarized, embedded.
- **Episode updates** — external systems write directly to the graph via API.

### Five ways to get knowledge out
Delve (unified semantic search), raw vector search, agent chat, visual graph exploration (`graph.bonfires.ai`), and MCP-compatible tools.

---

## HyperBlogs (content monetization)

AI-generated articles, reports, and analyses synthesized from a Bonfire's knowledge graph — "static anchors from a living graph." They let outsiders pay for community knowledge without joining the group.

- **Formats:** synthesis reports, event recaps, research summaries, governance records, trend analysis, expert roundups.
- **Payment:** readers pay via **x402 micropayments in USDC on Base**. Revenue today, no token launch required.
- **Engagement:** voting, comments, view analytics, AI-generated banner images — feedback loops that surface the most valuable knowledge.
- **Target users:** research communities, conferences, DAOs (governance records), expert networks, individual creators.

---

## The Crypto / Economic Layer

### Genesis NFT (current access gate)
- **Price:** 0.1 ETH · **Supply:** 20,000 · mint at `mint.bonfires.ai`.
- **Grants:** one Bonfire + one agent, **one year of hosted operation** (compute + infra managed). Basic plan = ~72 episodes/day plus a daily query allowance.
- **Token allocation:** each NFT = 0.002% of total `$KNOW` supply (40% of supply across all 20,000 holders).
- **Early-mover edge:** fewer Bonfires early = higher relative retrieval rates; reputation accrues before token emissions.
- **Activation:** mint → join community → request deployment → deposit NFT → connect Telegram group → build the graph. NFTs are tradeable on secondary markets until deposited.
- **After year one:** buy compute credits, subscribe to a tier, or self-host the open protocol for free.

### $KNOW token (network currency)
Native currency of the "Knowledge-Backed Economy." Uses:
- Deploy/maintain Bonfires (covers compute + storage; per-query, credit, or time-based pricing).
- **Staking** into a Bonfire → wrapped `wKNOW` + community-specific internal currencies.
- **Incentives** for contributing knowledge, proportional to a Bonfire's performance score.
- **Bounties** that steer network attention toward specific knowledge needs.
- **Custom retrieval pricing** per Bonfire.
- **Governance** (upgrades, inflation params, funding).
- Supply fixed at genesis; 40% to Genesis NFT holders; minting rate adjusts to network KPIs.
- (Note: docs give conflicting TGE dates — "Q1 2026" on the NFT page vs "September 2025" on the token page. Treat timing as unsettled.)

### Knowledge Network (the long game)
A shared layer connecting individual Bonfires into a global, queryable intelligence system. **"Privacy by default, monetization by choice."** Four exposure tiers operators can mix per-topic:
1. **Taxonomy only** — reveal topic coverage, not content.
2. **HyperBlog generation** — external queries trigger paid synthesized content.
3. **Chat interface** — direct agent chat, optional access gates.
4. **Data rooms** — targeted knowledge segments via micro-subscriptions.

**Bonfire Score** (drives `$KNOW` rewards) = *gravitational energy* (semantic alignment with active knowledge targets/bounties) + *retrieval score* (query frequency). Self-hosters get identical incentives without infra fees; fully permissionless, community-funded Bonfires (via "IBOs") targeted for **Q4 2026**.

---

## Vision / Philosophy

Roots in DeSciWorld's 2021 thesis that handing determination of humanity's future to any single entity is folly. The structural fix: decentralize power over intelligence systems before it becomes absolute. Reframes AI from individual assistant to **communal memory** — organizational decisions become permanently accessible rather than dependent on individual note-taking. Framed as a 20-year choice between centrally-owned collective intelligence vs. decentralized, cooperatively-owned "collective consciousness."

---

## Current Status (as of docs snapshot)
- **23+ live deployments**
- **36,700+ knowledge-graph nodes**
- **5,700+ episodic records**
- Access is gated: **Genesis NFT** (self-serve) or **Bonfires Labs** (custom deployment). Permissionless token-based deployment is planned, not yet live.

---

## Relevance to Mental Wealth Academy

Speculative — for evaluation, not a commitment:

- **MCP server is the lowest-effort hook.** It would let Blue (or dev tools) query community history without MWA building its own graph-extraction pipeline. Aligns with how the app already leans on an AI assistant.
- **Stack overlap:** HyperBlogs use **x402 + USDC on Base**, and MWA already operates on Base with USDC quest payouts — same rails, so a content-monetization tie-in wouldn't be foreign infra.
- **Tension to flag:** Bonfires is heavily token/NFT-gated (Genesis NFT, `$KNOW`). That's a dependency and a cost surface; weigh against MWA's own on-chain-first direction before adopting.
- **Community memory angle:** if MWA runs an active Discord/Telegram, a Bonfire could serve as institutional memory for decisions/curriculum discussion — but the 0.1 ETH gate and unsettled token timeline are real adoption frictions today.

---

## Source Map (Obsidian-published docs)
- Introduction — `docs.bonfires.ai/bonfires/files/Overview/Introduction`
- Vision — `.../files/Overview/Vision`
- Bonfire (knowledge engine) — `.../files/Technical/Bonfires`
- HyperBlogs — `.../files/Integrations & Use Cases/HyperBlogs`
- Genesis NFT — `.../files/Genesis NFT`
- $KNOW — `.../files/Knowledge Economy/$KNOW`
- Knowledge Network — `.../files/Knowledge Economy/Knowledge Network`
- Graph explorer — `graph.bonfires.ai` · Mint — `mint.bonfires.ai`

> Pages that did not resolve at guessed paths during research: a dedicated Agents page and a standalone MCP-integration page. MCP is referenced as a supported access method but lacks (or hides) a dedicated setup doc at the obvious URL — worth re-checking if you pursue an integration.
