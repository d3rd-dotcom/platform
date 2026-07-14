/**
 * One-time: grant the minter role to Blue's smart account on the Sepolia
 * Diamonds token via the PUBLIC RPC (the configured Alchemy app filters
 * some write selectors), then prove both mint paths:
 *   - sponsored user operation through the fixed ERC-7677 paymaster config
 *   - direct owner mint through the verified RPC (the runtime fallback)
 */
import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env.local') });

import { createPublicClient, createWalletClient, http, parseUnits, parseGwei, parseAbi, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const PUBLIC_RPC = 'https://sepolia.base.org';

async function main() {
  const { getChainConfig, resolveVerifiedRpcUrl } = await import('../lib/chain-config');
  const { getBlueSmartAccount, mintDiamondsSponsored } = await import('../lib/diamonds-paymaster');

  const cfg = getChainConfig();
  if (cfg.chainId !== 84532) throw new Error('Not on Base Sepolia.');
  const token = cfg.diamondsTokenAddress as `0x${string}`;

  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY!;
  const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`);
  const chain: Chain = baseSepolia;

  const abi = parseAbi([
    'function minters(address) view returns (bool)',
    'function setMinter(address minter, bool allowed)',
    'function mint(address to, uint256 amount)',
    'function balanceOf(address) view returns (uint256)',
  ]);

  const publicRead = createPublicClient({ chain, transport: http(PUBLIC_RPC) });
  const publicWallet = createWalletClient({ account, chain, transport: http(PUBLIC_RPC) });

  const { account: smart } = await getBlueSmartAccount();
  console.log('[smart]', smart.address);

  // 1. grant minter via the public RPC
  const isMinter = await publicRead.readContract({ address: token, abi, functionName: 'minters', args: [smart.address] });
  if (!isMinter) {
    const block = await publicRead.getBlock();
    const baseFee = block.baseFeePerGas ?? parseGwei('0.05');
    const grantHash = await publicWallet.writeContract({
      address: token, abi, functionName: 'setMinter', args: [smart.address, true],
      maxPriorityFeePerGas: parseGwei('0.001'), maxFeePerGas: baseFee * 2n + parseGwei('0.001'),
    });
    const r = await publicRead.waitForTransactionReceipt({ hash: grantHash });
    console.log('[1 setMinter via public RPC]', r.status, grantHash);
  } else {
    console.log('[1 setMinter] already granted');
  }

  // 2. sponsored mint (1 BLUE to Blue) through the fixed paymaster
  try {
    const { txHash } = await mintDiamondsSponsored(token, account.address, parseUnits('1', 18));
    console.log('[2 sponsored mint] OK tx:', txHash);
  } catch (e: any) {
    console.log('[2 sponsored mint] FAILED:', (e?.message ?? String(e)).slice(0, 400));
  }

  // 3. owner mint through the verified RPC (runtime fallback path)
  try {
    const rpc = await resolveVerifiedRpcUrl();
    const verifiedWallet = createWalletClient({ account, chain, transport: http(rpc) });
    const verifiedRead = createPublicClient({ chain, transport: http(rpc) });
    const block = await verifiedRead.getBlock();
    const baseFee = block.baseFeePerGas ?? parseGwei('0.05');
    const mintHash = await verifiedWallet.writeContract({
      address: token, abi, functionName: 'mint', args: [account.address, parseUnits('1', 18)],
      maxPriorityFeePerGas: parseGwei('0.001'), maxFeePerGas: baseFee * 2n + parseGwei('0.001'),
    });
    const r = await verifiedRead.waitForTransactionReceipt({ hash: mintHash });
    console.log('[3 owner mint via verified RPC]', r.status, mintHash);
  } catch (e: any) {
    console.log('[3 owner mint via verified RPC] FAILED:', (e?.message ?? String(e)).slice(0, 200));
  }
}

main().catch((e) => { console.error('FATAL:', e?.message ?? e); process.exit(1); });
