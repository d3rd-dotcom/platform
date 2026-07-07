<div align="center">

# Mental Wealth Academy

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Base](https://img.shields.io/badge/Base-Mainnet-0052FF?style=for-the-badge)](https://base.org/)

A gamified educational gameworld built on behavioral psychology, with blockchain-backed ownership, accompanied by Blue.

</div>

---

## What This Is

Mental Wealth Academy is a gamified educational gameworld built on behavioral psychology, with blockchain-backed ownership of what you earn, accompanied by Blue — the AI companion who reviews, rewards, and keeps the record.

Knowledge is structured in ascending levels, so you level up instead of grinding through tutorial hell. Each level cleared kills learning fatigue and pays out like a quest — you always know the next rung, and you always know why you're on it.

---

## Token & Reflection Protocol (Project Diamond)

Diamonds ($BLUE) is an ERC-20 on Base that members earn for mental-wealth activity, spend to unseal field notes and shop items (real burns to 0xdEaD), and hold to earn Bitcoin reflections.

![Diamonds Token Economy](./blue-token-economy-diagram.svg)

| Component | Base Mainnet | Base Sepolia (Testnet) |
| :--- | :--- | :--- |
| **Diamonds ($BLUE)** | `0x4A25Cea1f05C6725dC90849FBaafF00d67342B3f` | `0xd116e780ca9ec3984e7682e095aab50006a9c160` |
| **Reflection Vault** | _deploying_ | `0xc8FfD11F157C71F58477Cc49a2bf25bc69683b20` |
| **Reward Token (cbBTC)** | native cbBTC | `0x71a92f9b94646e5119f82cd7b01c69da8ec3a352` (mock) |
| **Blue's Agent Wallet** | `0x0920553CcA188871b146ee79f562B4Af46aB4f8a` |

**Trust guarantees (compiled-in, unchangeable):**
- Fee capped at 2% (compile-time constant, no admin override)
- Renouncing ownership permanently ends minting for everyone
- Blue's 200M stash excluded from reflection dividends

---

## Knowledge Ecosystem

One definitive, verified guide per topic — a one-stop shop for knowledge.

- **One guide per topic.** Every subject has a single canonical guide. Spin-offs for genuine niches are tagged and grouped.
- **Level-gated.** Guides form an acyclic prerequisite graph. Level N+1 stays locked until you clear every level-N guide beneath it.
- **Verifier jury.** Each guide is reviewed by an odd-numbered panel drawn from users who passed the verifier test for that subject and level.

---

## Running Locally

```bash
npm install && npm run dev
cd contracts && forge build && forge test
```

Set `NEXT_PUBLIC_USE_TESTNET=true` in `.env.local` to route Diamonds flows to Base Sepolia for integration testing.

---

## Where This Fits

Open infrastructure for open-sourced knowledge, tools, and collective intelligence. No single company controls it; it belongs to the network.

## Get Involved
Docs → docs.mentalwealthacademy.world
Email → research@mentalwealthacademy.net

Open protocol · Community governed · Apache-2.0 · © 2026
