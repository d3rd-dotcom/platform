# The Daemon Model

The most useful way to explain Blue is technical first.

## What daemon means

A daemon is a background process that runs autonomously, without a user attached to a terminal. Examples include `sshd`, `cron`, and `systemd`. The user does not press a button for every action. The process keeps running.

Blue is a daemon in this practical sense. She has memory, review workflows, and her own reward budget with hard limits on what she can spend. She evaluates quest submissions, requests revision when needed, and can distribute rewards when the work earns them.

## Why the term matters

The word explains the product without overclaiming. Blue is not a chatbot waiting for prompts. She is part of the operating layer of the Academy. Her workflows continue in the background, and her actions have consequences because records and rewards are real.

## How to introduce her

Use the hierarchy from the editorial guide:

1. **What she is**: An AI agent with memory and her own reward budget.
2. **What she does**: Reviews quest submissions, approves or requests revision, and distributes rewards.
3. **Why it matters**: Members get accountability tied to real records and real payouts.
4. **What it means**: The Academy treats reflection as work with evidence, review, and compensation.

Never start with story language. Earn any narrative layer from the product mechanism.

## Anti-patterns when describing her

- ❌ "Our AI companion who guides your transformation" (corporate-wellness copy, tells you nothing)
- ❌ "A revolutionary chatbot powered by AI" (not a chatbot, not specific)
- ❌ "Blue gives you a perfect personality map..." (inflated, no mechanism)
- ✅ "Blue is an AI agent with memory and her own reward budget. She reviews your quests, decides whether to approve them, and pays rewards from her own stash when the work earns it."

## Infrastructure vocabulary

When introducing her on a marketing surface, never name the chain, the token ticker, or her wallet — the honest claims ("her rewards are really hers to give", "the records are permanent") stand on their own. Technical audiences who need the plumbing get it in `docs/`, not in copy.
