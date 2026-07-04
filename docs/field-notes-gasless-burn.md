# Field notes unseal — the road to a gasless burn

## Where we are today

Unsealing field notes burns 400 $BLUE. The user's wallet signs a real ERC20
`transfer` of 400 $BLUE to `0x…dEaD` on Base, and `app/api/daily-notes/unseal`
verifies that transfer on-chain before returning the notes. This is correct and
custodial-free, but it is **not gasless**: the user must hold a little ETH on
Base to pay for the transfer, and without it the burn fails.

The frictionless improvements already shipped (pre-flight diamond balance,
pre-flight ETH-gas warning, clear errors) make that failure legible. They do not
make it disappear.

## Why truly gasless is impossible right now

`contracts/src/Diamonds.sol` is a plain OpenZeppelin `ERC20 + Ownable`. It
exposes **only** `mint` (for authorized minters and the owner). It has:

- no `burn` / `burnFrom` (ERC20Burnable)
- no `permit` (ERC20Permit / EIP-2612)
- no admin-burn entry point

Removing tokens from a user therefore requires the *user* to send at least one
transaction — a `transfer` to the dead address, or an `approve` — and on Base
that transaction costs gas. The CDP Paymaster (`lib/diamonds-paymaster.ts`) only
sponsors Blue's own smart-account operations (mints); it cannot sponsor an
arbitrary user EOA's transfer. So no amount of client work makes the current
contract's burn gasless. A **contract change + redeploy** is the only path.

## Two paths to a gasless burn (both need a redeploy)

### Path A — ERC20Burnable + ERC20Permit, pulled by a relayer

Add `ERC20Permit` and `ERC20Burnable` to Diamonds. Then:

1. The user signs an off-chain EIP-2612 `permit` (a gasless signature, no tx)
   authorizing a relayer to spend 400 $BLUE.
2. A relayer (Blue's paymaster-sponsored account) submits `permit` +
   `burnFrom(user, 400)` in one sponsored transaction.

The user pays nothing and signs nothing on-chain. This is the cleanest,
most standard design and keeps the burn a genuine supply reduction.

### Path B — owner `adminBurn(address, uint256)` gated by an EIP-712 authorization

Add an owner-only `adminBurn(address from, uint256 amount)`. The user signs an
EIP-712 "authorize unseal burn" message (off-chain, gasless). The server
verifies that signature, then Blue's paymaster-sponsored owner account calls
`adminBurn`. Simpler ABI than Path A, but it hands the owner a unilateral
burn power over any balance — a larger trust surface that must be tightly
scoped (nonce + amount + expiry in the signed payload, verified server-side).

## Trade-offs / recommendation

- **Prefer Path A.** Permit + burnFrom is the industry-standard, least-trust
  design; `adminBurn` concentrates power in the owner key.
- Either path costs a **redeploy + token migration** (holders, minter grants,
  `NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS`, the verify route, and all mint call
  sites). Memory already tracks a pending Base redeploy (Phases 3-4 — Safe
  transfer + CRE redeploy), so fold the Burnable/Permit upgrade into that work
  rather than doing a standalone migration.
- Until then, keep the current user-signed transfer burn with the pre-flight
  balance and gas surfaces — it fails loudly and legibly instead of cryptically.
