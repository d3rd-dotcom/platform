/**
 * Activate Blue's voting power: self-delegate on the new MWG token.
 * ERC20Votes balances only count as votes once delegated. One-time per holder.
 *
 * Run:  node scripts/delegate-self.js
 * Signs with BLUE_PRIVATE_KEY / AZURA_PRIVATE_KEY from .env.local.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const TOKEN = process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS || '0x0Eb5956b043A3Cd95C0f050a86faff48B7aA28E7';
const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const ABI = [
  { name: 'delegate', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'd', type: 'address' }], outputs: [] },
  { name: 'delegates', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'address' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getVotes', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

(async () => {
  const raw = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!raw) throw new Error('Set BLUE_PRIVATE_KEY / AZURA_PRIVATE_KEY in .env.local');
  const account = privateKeyToAccount(raw.startsWith('0x') ? raw : `0x${raw}`);
  const pub = createPublicClient({ chain: base, transport: http(RPC) });

  const [bal, current] = await Promise.all([
    pub.readContract({ address: TOKEN, abi: ABI, functionName: 'balanceOf', args: [account.address] }),
    pub.readContract({ address: TOKEN, abi: ABI, functionName: 'delegates', args: [account.address] }),
  ]);
  console.log('Wallet:', account.address, '| MWG balance:', bal.toString());
  if (current.toLowerCase() === account.address.toLowerCase()) {
    console.log('Already self-delegated. Votes:', (await pub.readContract({ address: TOKEN, abi: ABI, functionName: 'getVotes', args: [account.address] })).toString());
    return;
  }

  const wallet = createWalletClient({ account, chain: base, transport: http(RPC) });
  const hash = await wallet.writeContract({ address: TOKEN, abi: ABI, functionName: 'delegate', args: [account.address] });
  console.log('delegate tx:', hash);
  await pub.waitForTransactionReceipt({ hash });
  const votes = await pub.readContract({ address: TOKEN, abi: ABI, functionName: 'getVotes', args: [account.address] });
  console.log('Done. Voting power now:', votes.toString());
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
