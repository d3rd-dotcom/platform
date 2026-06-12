<div align="center">

<img width="1536" height="769" alt="gtihbuatv" src="https://github.com/user-attachments/assets/b5616451-38b0-4a84-ac0d-cdcf2c1e4424" />

# Mental Wealth Academy

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-375BD2?style=for-the-badge&logo=chainlink&logoColor=white)](https://chain.link/)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?style=for-the-badge)](https://base.org/)

</div>

Decentralized education infrastructure — a micro-university where humans and machines grow through collectively owned online spaces.


---

## 🧿 What This Is

The Platform is the Academy's main learning environment — an agentic LMS that goes further than most. It explores the intersection of cyber-psychology, on-chain governance, and AI-driven decision-making, all within a community-owned structure with real stakes.

At its core: a learning app with a transparent treasury, governed by members, scored by AI, and executed autonomously by Chainlink CRE workflows.

```text
Governance contract: 0x2cbb90a761ba64014b811be342b8ef01b471992d on Base Mainnet
```
---
⚙️ How It Works

Two primary surfaces carry the weight of the Academy's innovation:

### `/community`

Members submit funding proposals, vote on-chain, and interact with **Blue**, our AI governance agent. The system runs with minimal bureaucratic overhead by design.

- **AI Proposal Review** — Every proposal is scored by Azura via the ElizaOS API across six dimensions: clarity, impact, feasibility, budget, ingenuity, and chaos. Scores are written back on-chain through a Chainlink CRE DON, making them tamper-proof. Azura's approval level (0–4) determines her voting weight (0%–40%). Level 0 kills the proposal outright.
- **On-chain Voting** — Token-weighted community votes with a 50% threshold. When a proposal clears it, it executes automatically — transferring USDC to the recipient, no intermediaries required.


### `/trades` — Autonomous Trading Dashboard

A Bayesian market scanner powered by Quantum Math Scripts for volume and book-orders.

- **Black-Scholes Binary Pricer** -- Compares Kalshi market prices against a short-dated Black-Scholes model fed by live CoinGecko spot. Edges over 3% become signals.
- **Quarter-Kelly Sizing** -- Conservative position sizing caps notional at 5% of the trading treasury per position, 40% total exposure.
- **Conservative Risk Management** — Positions are capped at 5% of the trading treasury per trade.
- **Live Orderbooks** — Real-time CLOB data from Polymarket displayed alongside the DON's active positions and trade history.
- **Governance Path** — Trade proposals can route through the community on /community, giving the DAO direct input on where capital flows.
---

## 🔧 CRE Integration

Four CRE workflows run in the Chainlink DON,  automating the full pipeline from governance to execution:

### 1. `blue-review` -- AI Proposal Scoring
**Trigger:** `ProposalCreated` event on-chain

When a proposal is submitted, this workflow reads the proposal from the contract, calls the Eliza AI API for scoring across 6 dimensions (clarity, impact, feasibility, budget, ingenuity, chaos), computes an approval level (0-4), and writes the review back on-chain via a DON-signed report (`actionType 2`).

Blue's level determines her voting weight: Level 1 = 10%, Level 2 = 20%, Level 3 = 30%, Level 4 = 40%. Level 0 kills the proposal outright. Because the AI scoring runs inside the DON, no single server can fake scores.

### 2. `auto-execute` -- Proposal Execution
**Trigger:** Cron (every 10 minutes)

Scans all active proposals. When one has reached the 50% vote threshold, it submits a DON-signed report (`actionType 1`) to execute the proposal on-chain, transferring USDC to the recipient.

### 3. `trade-execute` -- Governance-Triggered Trading
**Trigger:** `ProposalExecuted` event on-chain

When a trade proposal passes governance and the recipient is the trader contract, this workflow infers trade direction from the proposal text and submits a DON-signed report to `BlueMarketTrader.onReport()`, routing the trading treasury's USDC into a prediction market position.

> The autonomous market scanner is a Vercel cron, not a CRE workflow. CRE is reserved for governance paths where DON signatures gate on-chain state changes.

### Pipeline

```📝 Proposal Created
   → CRE: azura-review  →  DON scores proposal, writes level on-chain
   → 🗳️ Community Votes
      ├── 50% threshold reached  →  CRE: auto-execute  →  💰 USDC to Recipient
      └── Trade proposal         →  CRE: trade-execute  →  🎯 AzuraMarketTrader

⏰ Every 30 min
   → CRE: polymarket-trader  →  Claude Bayesian analysis  →  🎯 AzuraMarketTrader
```

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| **BlueKillStreak** | Governance: proposals, token-weighted voting, CRE `onReport()` receiver (actionType 1 = auto-execute, 2 = AI review). All reports DON-signed via KeystoneForwarder. |
| **BlueMarketTrader** | Separate trading treasury: owner and CRE-triggered trades on prediction markets. Own `onReport()` receiver, `deposit()`/`withdraw()` for treasury management. |
| **MockPredictionMarket** | Binary outcome market accepting USDC -- mock target for trade execution testing. |
| **EtherealHorizonPathway** | 14-milestone on-chain seal system for the 12-week educational pathway. |

### Tests

```bash
cd contracts && forge test
# 70 tests pass: 31 governance, 23 market trader, 16 pathway
```

Key test coverage:
- AI review at all levels (0-4), including CRE-delivered reviews
- Community voting with snapshot-based anti-manipulation
- Trader contract: buy YES/NO, CRE onReport, deposit/withdraw, insufficient balance
- Mock prediction market position tracking
- Revert conditions: unauthorized, below threshold, no market set, zero amount

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Contracts** | Solidity 0.8.24, Foundry, Base Mainnet |
| **Automation** | Chainlink CRE (3 governance workflows), KeystoneForwarder |
| **Markets** | Kalshi public API, CoinGecko spot prices |
| **AI Agent** | Blue via Eliza Cloud API (reviews), Anthropic Claude (chat) |
| **Frontend** | Next.js 14, TypeScript |
| **Wallet** | Coinbase SDK |

---

## Project Structure

```
contracts/
  src/
    BlueKillStreak.sol         -- Governance + CRE receiver
    BlueMarketTrader.sol       -- Trading treasury + CRE receiver
    MockPredictionMarket.sol    -- Trade target for testing
    EtherealHorizonPathway.sol  -- Educational milestones
  test/
    BlueKillStreak.t.sol       -- 31 governance tests
    BlueMarketTrader.t.sol     -- 23 trader tests
    EtherealHorizonPathway.t.sol

cre-workflows/
  blue-review/         -- Event-triggered AI scoring
  auto-execute/        -- Cron-based proposal execution
  trade-execute/       -- Event-triggered governance trade routing
  shared/
    abi.ts             -- Governance contract ABI fragments
    trader-abi.ts      -- Trader contract ABI fragments
```

---

## Running Locally

```bash
# Frontend
npm install && npm run dev

# Contracts
cd contracts && forge build && forge test

# CRE workflows (simulate)
cd cre-workflows
cre workflow simulate --workflow blue-review
cre workflow simulate --workflow auto-execute
```

---
 
## 🌍 Where This Fits
 
The Platform is one piece of a larger picture. Mental Wealth is building open infrastructure for education and collective intelligence — the way the internet is open infrastructure for communication. No one company controls it. No one company profits from it. It just gets better, for everyone, together.
 
| Repo | What it does |
| --- | --- |
| [**platform**](https://github.com/Mental-Wealth-Academy/platform) | This repo — agentic LMS with on-chain governance and AI |
| [**treasury**](https://github.com/Mental-Wealth-Academy/treasury) | Community-owned USDC treasury with autonomous trading model |
| [**genetics**](https://github.com/Mental-Wealth-Academy/genetics) | Privacy-first, browser-native genomics lab |
| [**research**](https://github.com/Mental-Wealth-Academy/research) | Statistical workbench with AI interpretation |
| [**knowledge**](https://github.com/Mental-Wealth-Academy/knowledge) | Central hub for aggregating and synthesizing knowledge via LLM workflows |
 
---
 
## 🤝 Get Involved
 
Read the docs → [docs.mentalwealthacademy.world](https://docs.mentalwealthacademy.world)
 
Say hello → [research@mentalwealthacademy.net](mailto:research@mentalwealthacademy.net)
 
---
 
*Mental Wealth Foundation — open AI infrastructure, built by everyone, for everyone.*
*Open protocol · Community governed · Apache-2.0 · © 2026*
