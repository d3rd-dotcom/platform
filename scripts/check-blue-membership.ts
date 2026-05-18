#!/usr/bin/env tsx
/**
 * Reports Blue's membership wallet: the derived address, how many VIP
 * Membership NFTs it holds, and its ETH balance for gas.
 *
 * Reads the private key from .env.local (BLUE_PRIVATE_KEY, falling back to
 * AZURA_PRIVATE_KEY). The key is never printed — only the public address.
 */

import { providers, Wallet, Contract } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const KEY = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
const RPC =
  process.env.BASE_RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  'https://mainnet.base.org';
const VIP =
  process.env.VIP_MEMBERSHIP_CARD_ADDRESS ||
  '0x5da79055cf8ca6482c997df58822e08e5707d6fc';

async function main() {
  if (!KEY) {
    console.error('No BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY found in .env.local');
    process.exit(1);
  }

  const pk = KEY.startsWith('0x') ? KEY : `0x${KEY}`;
  const provider = new providers.StaticJsonRpcProvider(RPC, {
    chainId: 8453,
    name: 'base',
  });
  const wallet = new Wallet(pk);

  console.log('\nBlue membership wallet');
  console.log('  source var:', process.env.BLUE_PRIVATE_KEY ? 'BLUE_PRIVATE_KEY' : 'AZURA_PRIVATE_KEY');
  console.log('  address:   ', wallet.address);

  const eth = await provider.getBalance(wallet.address);
  console.log('  ETH (gas): ', (Number(eth) / 1e18).toFixed(6));

  const contract = new Contract(
    VIP,
    ['function balanceOf(address account, uint256 id) view returns (uint256)'],
    provider,
  );
  const balance = await contract.balanceOf(wallet.address, 1);
  console.log('  memberships held (token 1):', balance.toString());
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
