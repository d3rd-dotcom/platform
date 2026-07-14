/**
 * Live Base Sepolia verification of the viem-ported Diamonds pipeline.
 * 1. Balance read via lib/diamonds-balance (new viem path)
 * 2. Real 1-BLUE burn from Blue's EOA -> 0xdEaD (same write calls as transferFromBlue)
 * 3. Server-side burn verification via lib/diamond-burns (the path that gates chat)
 * 4. Negative cases: amount too small, wrong sender
 * 5. Sponsored mint through the fixed Alchemy ERC-7677 paymaster config
 */
import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env.local') });

import { createPublicClient, createWalletClient, http, parseUnits, parseGwei, parseAbi, formatEther, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

async function main() {
  const { getChainConfig, BURN_ADDRESS, resolveVerifiedRpcUrl } = await import('../lib/chain-config');
  const { verifyDiamondBurnTx } = await import('../lib/diamond-burns');
  const { fetchDiamondBalance } = await import('../lib/diamonds-balance');
  const { getBlueSmartAccount, mintDiamondsSponsored, getPaymasterRpcUrl } = await import('../lib/diamonds-paymaster');

  const cfg = getChainConfig();
  console.log('[cfg] chain:', cfg.chainId, cfg.chainName, '| token:', cfg.diamondsTokenAddress);
  if (cfg.chainId !== 84532) throw new Error('Refusing: not on Base Sepolia. Check NEXT_PUBLIC_USE_TESTNET.');

  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY!;
  const account = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`);
  console.log('[blue] EOA:', account.address);

  const chain: Chain = baseSepolia;
  const rpc = await resolveVerifiedRpcUrl();
  console.log('[rpc] verified:', rpc.replace(/\/v2\/.*/, '/v2/<key>'));
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpc) });

  // 1. balance read through the app lib
  const bal = await fetchDiamondBalance(account.address);
  console.log('[1 balance-read] Blue $BLUE =', bal);
  if (bal === null) throw new Error('fetchDiamondBalance returned null');

  const eth = await publicClient.getBalance({ address: account.address });
  console.log('[gas] Blue ETH =', formatEther(eth));

  // 2. real 1-BLUE burn (Transfer to 0xdEaD), exactly like the app's spend path
  const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
  const block = await publicClient.getBlock();
  const baseFee = block.baseFeePerGas ?? parseGwei('0.05');
  const hash = await walletClient.writeContract({
    address: cfg.diamondsTokenAddress as `0x${string}`,
    abi,
    functionName: 'transfer',
    args: [BURN_ADDRESS as `0x${string}`, parseUnits('1', 18)],
    maxPriorityFeePerGas: parseGwei('0.001'),
    maxFeePerGas: baseFee * 2n + parseGwei('0.001'),
  });
  console.log('[2 burn] tx:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('[2 burn] status:', receipt.status, '| gasUsed:', receipt.gasUsed.toString());

  // 3. the exact server-side verification that gates Blue chat
  const v1 = await verifyDiamondBurnTx(hash, account.address, 1);
  console.log('[3 verify ok-case]', JSON.stringify(v1));

  // 4. negative cases must fail closed
  const v2 = await verifyDiamondBurnTx(hash, account.address, 2);
  console.log('[4 verify amount-too-small]', JSON.stringify(v2));
  const v3 = await verifyDiamondBurnTx(hash, '0x000000000000000000000000000000000000beef', 1);
  console.log('[4 verify wrong-sender]', JSON.stringify(v3));

  // 5. sponsored mint through the fixed paymaster config (1 BLUE to Blue)
  console.log('[5 sponsored] paymaster URL configured:', !!getPaymasterRpcUrl());
  try {
    const { account: smart } = await getBlueSmartAccount();
    console.log('[5 sponsored] smart account:', smart.address);
    const mintersAbi = parseAbi(['function minters(address) view returns (bool)', 'function setMinter(address minter, bool allowed)']);
    const isMinter = await publicClient.readContract({
      address: cfg.diamondsTokenAddress as `0x${string}`, abi: mintersAbi, functionName: 'minters', args: [smart.address],
    });
    console.log('[5 sponsored] smart account is minter:', isMinter);
    if (!isMinter) {
      const grantHash = await walletClient.writeContract({
        address: cfg.diamondsTokenAddress as `0x${string}`, abi: mintersAbi, functionName: 'setMinter', args: [smart.address, true],
        maxPriorityFeePerGas: parseGwei('0.001'), maxFeePerGas: baseFee * 2n + parseGwei('0.001'),
      });
      const grantReceipt = await publicClient.waitForTransactionReceipt({ hash: grantHash });
      console.log('[5 sponsored] setMinter:', grantReceipt.status, grantHash);
    }
    const { txHash } = await mintDiamondsSponsored(cfg.diamondsTokenAddress, account.address, parseUnits('1', 18));
    console.log('[5 sponsored] MINT OK tx:', txHash);
  } catch (e: any) {
    console.log('[5 sponsored] FAILED (fallback owner-mint covers delivery):', (e?.message ?? String(e)).slice(0, 300));
  }

  const balAfter = await fetchDiamondBalance(account.address);
  console.log('[done] Blue $BLUE after:', balAfter);
}

main().catch((e) => { console.error('FATAL:', e?.message ?? e); process.exit(1); });
