/**
 * Read-only snapshot of current MWG holders + balances, reconstructed from
 * Transfer events. Output: contracts/migration/mwg-holders.json
 *
 * Usage: node scripts/snapshot-mwg-holders.js
 * Requires BASE_RPC_URL (falls back to https://mainnet.base.org).
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const TOKEN = '0x84939fEc50EfdEDC8522917645AAfABFd5b3EA6F';
const RPC = process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const ZERO = '0x0000000000000000000000000000000000000000';
const TRANSFER_TOPIC = ethers.utils.id('Transfer(address,address,uint256)');

async function findDeploymentBlock(provider, address, latest) {
  // Binary search for the first block where the address has code.
  let lo = 0, hi = latest, ans = latest;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const code = await provider.getCode(address, mid);
    if (code && code !== '0x') { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

async function getLogsChunked(provider, address, fromBlock, toBlock) {
  const logs = [];
  let chunk = 50000;
  let start = fromBlock;
  while (start <= toBlock) {
    let end = Math.min(start + chunk - 1, toBlock);
    try {
      const part = await provider.getLogs({ address, topics: [TRANSFER_TOPIC], fromBlock: start, toBlock: end });
      logs.push(...part);
      start = end + 1;
    } catch (e) {
      // Range too large for this RPC — shrink and retry.
      if (chunk > 1000) { chunk = Math.floor(chunk / 2); continue; }
      throw e;
    }
  }
  return logs;
}

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const erc20 = new ethers.Contract(TOKEN, [
    'function totalSupply() view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint256)',
  ], provider);

  const latest = await provider.getBlockNumber();
  console.log(`Token ${TOKEN} on ${RPC}`);
  console.log(`name/symbol: ${await erc20.name()} / ${await erc20.symbol()}`);
  const totalSupply = await erc20.totalSupply();
  console.log(`totalSupply: ${totalSupply.toString()} | latest block: ${latest}`);

  const deployBlock = await findDeploymentBlock(provider, TOKEN, latest);
  console.log(`deployment block (approx): ${deployBlock}`);

  console.log('Scanning Transfer logs...');
  const logs = await getLogsChunked(provider, TOKEN, deployBlock, latest);
  console.log(`Transfer events: ${logs.length}`);

  const iface = new ethers.utils.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
  const bal = new Map();
  const add = (a, v) => bal.set(a, (bal.get(a) || ethers.BigNumber.from(0)).add(v));
  for (const log of logs) {
    const { from, to, value } = iface.parseLog(log).args;
    if (from !== ZERO) add(from, value.mul(-1));
    if (to !== ZERO) add(to, value);
  }

  const holders = [];
  let sum = ethers.BigNumber.from(0);
  for (const [addr, amount] of bal) {
    if (amount.gt(0)) { holders.push({ address: addr, amount: amount.toString() }); sum = sum.add(amount); }
  }
  holders.sort((a, b) => (ethers.BigNumber.from(b.amount).gt(a.amount) ? 1 : -1));

  // Cross-check a few balances against live balanceOf.
  let mismatches = 0;
  for (const h of holders.slice(0, 10)) {
    const live = await erc20.balanceOf(h.address);
    if (!live.eq(h.amount)) { mismatches++; console.warn(`  MISMATCH ${h.address}: reconstructed ${h.amount} vs live ${live.toString()}`); }
  }

  console.log(`\nHolders: ${holders.length} | reconstructed sum: ${sum.toString()}`);
  console.log(`sum == totalSupply: ${sum.eq(totalSupply)} | spot-check mismatches: ${mismatches}`);
  for (const h of holders) console.log(`  ${h.address}  ${h.amount}`);

  const outDir = path.join(__dirname, '..', 'contracts', 'migration');
  fs.mkdirSync(outDir, { recursive: true });
  const out = {
    token: TOKEN, name: await erc20.name(), symbol: await erc20.symbol(),
    snapshotBlock: latest, totalSupply: totalSupply.toString(),
    reconstructedSum: sum.toString(), holderCount: holders.length, holders,
  };
  fs.writeFileSync(path.join(outDir, 'mwg-holders.json'), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${path.join(outDir, 'mwg-holders.json')}`);
  if (!sum.eq(totalSupply) || mismatches > 0) { console.error('WARNING: snapshot did not reconcile cleanly — review before migrating.'); process.exit(2); }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
