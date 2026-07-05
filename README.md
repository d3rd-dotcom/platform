<div align="center">

# Mental Wealth Academy

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?style=for-the-badge)](https://base.org/)

A gamified educational gameworld built on behavioral psychology, with blockchain-backed ownership, accompanied by Blue.

</div>

---

<img width="1676" height="863" alt="Screenshot 2026-06-19 at 3 28 34 PM" src="https://github.com/user-attachments/assets/e0191dcb-6079-4c89-af0d-5986b356a7e1" />


## 🧿 What This Is

Mental Wealth Academy is a gamified educational gameworld built on behavioral psychology, with blockchain-backed ownership of what you earn, accompanied by Blue — the AI companion who reviews, rewards, and keeps the record.

Knowledge is structured in ascending levels, so you level up instead of grinding through tutorial hell. Each level cleared kills learning fatigue and pays out like a quest — you always know the next rung, and you always know why you're on it.

---

## 📚 Knowledge Ecosystem

One definitive, verified guide per topic — a one-stop shop for knowledge. No duplicate tutorials, no contradictory advice, no guessing which source to trust.

- **One guide per topic.** Every subject has a single canonical guide. Spin-offs for genuine niches are tagged and grouped, never scattered.
- **Level-gated.** Guides form an acyclic prerequisite graph. Level N+1 stays locked until you clear every level-N guide beneath it — knowledge in ascending order, no fatigue.
- **Verifier jury.** Each guide is reviewed by an odd-numbered panel drawn from users who passed the verifier test for that subject and level. Votes are rubric-bound and require written justification; an AI juror (Chainlink CRE) adds a DON-signed advisory score. Approved work goes on-chain, and every decision is a public audit log.

*Coming from the BlueLearn integration — see [`docs/bluelearn-integration-plan.md`](docs/bluelearn-integration-plan.md).*

---

## 🔬 Scientific Use Cases & Environments

We bypass traditional institutional barriers by building specialized digital sandboxes designed to experiment with, test, and model collective human intelligence.

### 1. We Simulate Science
The platform functions as a decentralized research ecosystem. Instead of standard passive reading materials, users interact with live multi-agent environments designed to stress-test cognitive frameworks, model self-efficacy, and track systems thinking in real time.

### 2. The R-Tool (Research Statistical Workbench)
Our native statistical engine featuring integrated AI data interpretation. The R-Tool enables researchers to rapidly analyze community cognitive benchmarks, process decentralized research streams, and share immutable open-source outputs without central gatekeepers.

### 3. Ontologies [Pocket World]
A modular, game-like digital canvas built to visualize knowledge systems. Pocket Worlds allow users and AI agents to map multi-dimensional cognitive structures, model behavior dynamics, and visually trace evolving conceptual frameworks over time.

---

## ⛓️ Core Protocol Architecture

The underlying network logic is consolidated into a clean, minimal contract framework on Base Mainnet.

| Component / Identity | Contract Address (Base Mainnet) |
| :--- | :--- |
| **Diamond Contract** | `0x2cbb90a761ba64014b811be342b8ef01b471992d` |
| **Blue's Wallet Contract** | `0xBc16E984D72091219b16D54605175960d7b2752A` |

> *Note: All core governance weightings, operational rules, and modular logic endpoints map directly through the multi-facet Diamond proxy for complete system upgradeability.*

---

## ⚙️ Running Locally

```bash
# Clone and enter the frontend
npm install && npm run dev

# Compile or run protocol tests
cd contracts && forge build && forge test
```
---


## 🌍 Where This Fits

The Platform is one piece of a larger picture. Open infrastructure for open-sourced knowledge, tools, and collective intelligence. No single company controls it; it belongs to the network.

## 🤝 Get Involved
Read the docs → docs.mentalwealthacademy.world

Say hello → research@mentalwealthacademy.net

Mental Wealth Foundation — open AI infrastructure, built by everyone, for everyone.

Open protocol · Community governed · Apache-2.0 · © 2026
