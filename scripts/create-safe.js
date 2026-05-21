/**
 * Create a 2-of-3 Safe on Base via the Safe Protocol Kit. No web app.
 *
 * Install once:  npm install @safe-global/protocol-kit
 *
 * Env (.env.local):
 *   BASE_RPC_URL                 (defaults to https://mainnet.base.org)
 *   SAFE_DEPLOYER_PRIVATE_KEY    key that pays gas to deploy (James). Falls back
 *                                to JAMES_PRIVATE_KEY.
 *   OWNER_JAMES                  James's signer address
 *   OWNER_BLUE                   defaults to Blue's wallet 0x0920...4f8a
 *   OWNER_AI                     the AI signer address (generate one first)
 *   SAFE_THRESHOLD               defaults to 2
 *
 * Output: contracts/migration/safe.json  { safeAddress, owners, threshold, ... }
 *
 * Run:  node scripts/create-safe.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createWalletClient, createPublicClient, http, isAddress, getAddress } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const RPC = process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const BLUE_DEFAULT = '0x0920553CcA188871b146ee79f562B4Af46aB4f8a';

function reqAddr(name, fallback) {
  const v = (process.env[name] || fallback || '').trim();
  if (!isAddress(v)) throw new Error(`${name} is not a valid address (got "${v}")`);
  return getAddress(v);
}

(async () => {
  const { default: Safe } = await import('@safe-global/protocol-kit').catch(() => {
    throw new Error('Missing dependency. Run: npm install @safe-global/protocol-kit');
  });

  // Any hot key can deploy the Safe (owners are just config). Default to Blue's
  // key since it's already in env and funded — a Ledger can't sign from a script.
  const rawKey =
    process.env.SAFE_DEPLOYER_PRIVATE_KEY ||
    process.env.JAMES_PRIVATE_KEY ||
    process.env.BLUE_PRIVATE_KEY ||
    process.env.AZURA_PRIVATE_KEY;
  if (!rawKey) throw new Error('No deployer key found (SAFE_DEPLOYER_PRIVATE_KEY / BLUE_PRIVATE_KEY / AZURA_PRIVATE_KEY).');
  const deployerKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

  const owners = [reqAddr('OWNER_JAMES'), reqAddr('OWNER_BLUE', BLUE_DEFAULT), reqAddr('OWNER_AI')];
  const unique = new Set(owners.map((a) => a.toLowerCase()));
  if (unique.size !== owners.length) throw new Error('Owners must be three distinct addresses.');
  const threshold = parseInt(process.env.SAFE_THRESHOLD || '2', 10);
  if (!(threshold >= 1 && threshold <= owners.length)) throw new Error('Bad SAFE_THRESHOLD.');

  const account = privateKeyToAccount(deployerKey);
  console.log('Network: Base (8453)');
  console.log('Deployer (pays gas):', account.address);
  console.log('Owners:', owners.join(', '));
  console.log('Threshold:', `${threshold}-of-${owners.length}`);

  const protocolKit = await Safe.init({
    provider: RPC,
    signer: deployerKey,
    predictedSafe: { safeAccountConfig: { owners, threshold } },
  });

  const safeAddress = await protocolKit.getAddress();
  console.log('\nPredicted Safe address:', safeAddress);

  const pub = createPublicClient({ chain: base, transport: http(RPC) });
  if ((await pub.getBytecode({ address: safeAddress }))) {
    console.log('A Safe already exists at this address — nothing to deploy.');
  } else {
    const deployTx = await protocolKit.createSafeDeploymentTransaction();
    const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });
    console.log('Broadcasting Safe deployment...');
    const hash = await wallet.sendTransaction({
      to: deployTx.to,
      data: deployTx.data,
      value: BigInt(deployTx.value || 0),
    });
    console.log('tx:', hash);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    console.log('mined in block', receipt.blockNumber, 'status', receipt.status);
    const code = await pub.getBytecode({ address: safeAddress });
    if (!code) throw new Error('Deployment sent but no code at the Safe address — check the tx.');
  }

  const out = { safeAddress, owners, threshold, chainId: 8453, rpc: RPC, deployer: account.address };
  const outDir = path.join(__dirname, '..', 'contracts', 'migration');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'safe.json'), JSON.stringify(out, null, 2));
  console.log('\nSafe ready:', safeAddress);
  console.log('Wrote', path.join(outDir, 'safe.json'));
  console.log('\nNext: run the ownership transfer (TransferOwnership.s.sol) with Blue as the current owner.');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
