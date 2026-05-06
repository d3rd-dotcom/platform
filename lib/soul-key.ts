import { BigNumber, Contract, providers, utils } from 'ethers';

export const SOUL_KEY_ADDRESS = '0x39f259B58A9aB02d42bC3DF5836bA7fc76a8880F';
export const VIP_MEMBERSHIP_CARD_ADDRESS =
  process.env.VIP_MEMBERSHIP_CARD_ADDRESS || '0x5da79055cf8ca6482c997df58822e08e5707d6fc';
export const VIP_MEMBERSHIP_CARD_TOKEN_IDS = (process.env.VIP_MEMBERSHIP_CARD_TOKEN_IDS || process.env.VIP_MEMBERSHIP_CARD_TOKEN_ID || '1')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => /^\d+$/.test(id));
export const VIP_MEMBERSHIP_CARD_TOKEN_ID = BigInt(VIP_MEMBERSHIP_CARD_TOKEN_IDS[0] || '1');
export const VIP_MEMBERSHIP_CARD_FROM_BLOCK = Number(process.env.VIP_MEMBERSHIP_CARD_FROM_BLOCK || '45000000');
const VIP_MEMBERSHIP_CARD_LOG_CHUNK_SIZE = Number(process.env.VIP_MEMBERSHIP_CARD_LOG_CHUNK_SIZE || '10000');

const ERC721_BALANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];
const ERC1155_BALANCE_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];
const ERC1155_EVENT_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
];

let cached: { wallet: string; hasKey: boolean; expiresAt: number } | null = null;
let vipCached: { wallet: string; hasCard: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;
const erc1155Interface = new utils.Interface(ERC1155_EVENT_ABI);
const transferSingleTopic = erc1155Interface.getEventTopic('TransferSingle');
const transferBatchTopic = erc1155Interface.getEventTopic('TransferBatch');

function getProvider(): providers.JsonRpcProvider | null {
  const rpcUrl = process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
  if (!rpcUrl) {
    console.warn('[soul-key] BASE_RPC_URL not configured');
    return null;
  }

  return new providers.JsonRpcProvider(rpcUrl);
}

export async function walletHoldsSoulKey(wallet: string | null | undefined): Promise<boolean> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false;

  const now = Date.now();
  const normalized = wallet.toLowerCase();
  if (cached && cached.wallet === normalized && cached.expiresAt > now) {
    return cached.hasKey;
  }

  const provider = getProvider();
  if (!provider) {
    return false;
  }

  try {
    const contract = new Contract(SOUL_KEY_ADDRESS, ERC721_BALANCE_ABI, provider);
    const balance = await contract.balanceOf(wallet);
    const hasKey = balance && balance.gt(0);
    cached = { wallet: normalized, hasKey: !!hasKey, expiresAt: now + CACHE_TTL_MS };
    return !!hasKey;
  } catch (err) {
    console.error('[soul-key] balanceOf failed:', err);
    return false;
  }
}

async function walletHasAnyVipTokenId(contract: Contract, wallet: string, tokenIds: Iterable<string>): Promise<boolean> {
  const balances = await Promise.all(
    [...tokenIds].map((tokenId) => contract.balanceOf(wallet, tokenId).catch(() => BigNumber.from(0)))
  );
  return balances.some((balance) => balance.gt(0));
}

async function discoverCandidateVipTokenIdsForWallet(provider: providers.JsonRpcProvider, wallet: string): Promise<Set<string>> {
  const latestBlock = await provider.getBlockNumber();
  const walletTopic = utils.hexZeroPad(wallet, 32);
  const tokenIds = new Set<string>();
  const fromBlock = Number.isFinite(VIP_MEMBERSHIP_CARD_FROM_BLOCK) && VIP_MEMBERSHIP_CARD_FROM_BLOCK >= 0
    ? VIP_MEMBERSHIP_CARD_FROM_BLOCK
    : 0;
  const chunkSize = Number.isFinite(VIP_MEMBERSHIP_CARD_LOG_CHUNK_SIZE) && VIP_MEMBERSHIP_CARD_LOG_CHUNK_SIZE > 0
    ? VIP_MEMBERSHIP_CARD_LOG_CHUNK_SIZE
    : 100000;

  for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, latestBlock);
    // ERC-1155 has no generic "tokensOfOwner" method. Transfer history is used only
    // to discover candidate token ids; VIP status still requires current balance > 0.
    const logQueries = [
      { address: VIP_MEMBERSHIP_CARD_ADDRESS, fromBlock: start, toBlock: end, topics: [transferSingleTopic, null, null, walletTopic] },
      { address: VIP_MEMBERSHIP_CARD_ADDRESS, fromBlock: start, toBlock: end, topics: [transferSingleTopic, null, walletTopic] },
      { address: VIP_MEMBERSHIP_CARD_ADDRESS, fromBlock: start, toBlock: end, topics: [transferBatchTopic, null, null, walletTopic] },
      { address: VIP_MEMBERSHIP_CARD_ADDRESS, fromBlock: start, toBlock: end, topics: [transferBatchTopic, null, walletTopic] },
    ];

    const logGroups = await Promise.all(
      logQueries.map((query) => provider.getLogs(query).catch(() => []))
    );

    for (const log of logGroups.flat()) {
      try {
        const parsed = erc1155Interface.parseLog(log);
        if (parsed.name === 'TransferSingle') {
          tokenIds.add((parsed.args.id as BigNumber).toString());
        }
        if (parsed.name === 'TransferBatch') {
          for (const id of parsed.args.ids as BigNumber[]) {
            tokenIds.add(id.toString());
          }
        }
      } catch {
        // Ignore malformed logs from RPC responses.
      }
    }
  }

  return tokenIds;
}

export async function walletHoldsVipMembershipCard(wallet: string | null | undefined): Promise<boolean> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false;

  const now = Date.now();
  const normalized = wallet.toLowerCase();
  if (vipCached && vipCached.wallet === normalized && vipCached.expiresAt > now) {
    return vipCached.hasCard;
  }

  const provider = getProvider();
  if (!provider) {
    return false;
  }

  try {
    const contract = new Contract(VIP_MEMBERSHIP_CARD_ADDRESS, ERC1155_BALANCE_ABI, provider);
    const hasConfiguredToken = await walletHasAnyVipTokenId(contract, wallet, VIP_MEMBERSHIP_CARD_TOKEN_IDS);
    const hasCard = hasConfiguredToken
      ? true
      : await walletHasAnyVipTokenId(contract, wallet, await discoverCandidateVipTokenIdsForWallet(provider, wallet));
    vipCached = { wallet: normalized, hasCard, expiresAt: now + CACHE_TTL_MS };
    return hasCard;
  } catch (err) {
    console.error('[vip-membership-card] balanceOf failed:', err);
    return false;
  }
}
