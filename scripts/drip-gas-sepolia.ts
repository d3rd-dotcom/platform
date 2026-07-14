/**
 * Drip Base Sepolia ETH (and optionally $BLUE) from Blue's wallet to user
 * wallets so the test cohort can sign diamond burns — spends (chat, unseal,
 * shop) are user-signed transfers, and testnet users start with zero gas.
 *
 * Usage:
 *   npx tsx scripts/drip-gas-sepolia.ts 0xabc...,0xdef... --eth=0.00006
 *   npx tsx scripts/drip-gas-sepolia.ts 0xabc... --eth=0.0001 --blue=100
 */
import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env.local') });

import { createPublicClient, createWalletClient, http, parseEther, parseUnits, parseGwei, parseAbi, formatEther, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

async function main() {
  const { getChainConfig } = await import('../lib/chain-config');
  const cfg = getChainConfig();
  if (cfg.chainId !== 84532) throw new Error('Refusing: not in testnet mode.');

  const [addressesArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ethArg = process.argv.find((a) => a.startsWith('--eth='))?.split('=')[1];
  const blueArg = process.argv.find((a) => a.startsWith('--blue='))?.split('=')[1];
  if (!addressesArg || (!ethArg && !blueArg)) {
    console.log('Usage: npx tsx scripts/drip-gas-sepolia.ts <0xaddr,0xaddr,...> [--eth=0.00006] [--blue=100]');
    process.exit(1);
  }
  const recipients = addressesArg.split(',').map((a) => a.trim()).filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
  if (recipients.length === 0) throw new Error('No valid recipient addresses.');

  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) throw new Error('BLUE_PRIVATE_KEY / AZURA_PRIVATE_KEY not set');
  const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`);
  const chain: Chain = baseSepolia;
  const rpc = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpc) });

  const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
  const block = await publicClient.getBlock();
  const baseFee = block.baseFeePerGas ?? parseGwei('0.05');
  const fees = { maxPriorityFeePerGas: parseGwei('0.001'), maxFeePerGas: baseFee * 2n + parseGwei('0.001') };

  console.log('Blue ETH before:', formatEther(await publicClient.getBalance({ address: account.address })));
  // Explicit nonces: RPC pending-nonce views lag right after a confirmation,
  // which makes back-to-back sends collide ("replacement transaction underpriced").
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  for (const to of recipients) {
    if (ethArg) {
      const hash = await walletClient.sendTransaction({ to: to as `0x${string}`, value: parseEther(ethArg), nonce: nonce++, ...fees });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`eth  ${ethArg} -> ${to}  ${hash}`);
    }
    if (blueArg) {
      const blueHash = await walletClient.writeContract({
        address: cfg.diamondsTokenAddress as `0x${string}`, abi, functionName: 'transfer',
        args: [to as `0x${string}`, parseUnits(blueArg, 18)], nonce: nonce++, ...fees,
      });
      await publicClient.waitForTransactionReceipt({ hash: blueHash });
      console.log(`blue ${blueArg} -> ${to}  ${blueHash}`);
    }
  }
  console.log('Blue ETH after:', formatEther(await publicClient.getBalance({ address: account.address })));
}

main().catch((e) => { console.error('FATAL:', e?.message ?? e); process.exit(1); });
