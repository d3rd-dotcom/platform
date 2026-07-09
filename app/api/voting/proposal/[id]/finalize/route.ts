import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureProposalSchema } from '@/lib/ensureProposalSchema';
import { getUserFromRequest } from '@/lib/auth';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { providers, Contract } from 'ethers';
import { BLUE_KILLSTREAK_ABI } from '@/lib/blue-contract';

/**
 * Governance-token allocation, signed with Blue's raw key via viem (formerly
 * the Coinbase CDP managed wallet). The DAO/proposal flow is dormant; this is
 * a like-for-like migration off CDP that preserves the pool-percentage math
 * and the balance pre-check. Idempotency is owned by the partial unique index
 * on proposal_transactions (status IN ('pending','confirmed')), not by any
 * in-process bookkeeping, so no allocation cache is needed here.
 *
 * The governance token lives on Base mainnet, so this path stays mainnet-
 * pinned regardless of the Diamonds testnet flag.
 */
const GOV_TOKEN_ABI = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

function getGovTokenAddress(): `0x${string}` {
  const addr =
    process.env.VOTING_TOKEN_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS ||
    '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('Governance token address not configured.');
  }
  return addr as `0x${string}`;
}

function getBlueKey(): `0x${string}` {
  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) throw new Error('BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY is not set.');
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

/** Whole allocation, in token base units, for a 1–40% slice of the pool. */
function govAllocationAmount(percentage: number): bigint {
  if (percentage < 1 || percentage > 40) {
    throw new Error('Percentage must be between 1 and 40');
  }
  const pool = process.env.BLUE_TOTAL_TOKEN_POOL || '1000000';
  const decimals = parseInt(process.env.VOTING_TOKEN_DECIMALS || '18', 10);
  const total = BigInt(pool) * BigInt(10) ** BigInt(decimals);
  return (total * BigInt(percentage)) / BigInt(100);
}

interface ProposalData {
  id: string;
  user_id: string;
  wallet_address: string;
  title: string;
  status: string;
  token_allocation_percentage: number | null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured.' },
      { status: 503 }
    );
  }

  await ensureProposalSchema();

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const proposalId = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { userWalletAddress } = body;

  if (!userWalletAddress || typeof userWalletAddress !== 'string') {
    return NextResponse.json(
      { error: 'User wallet address is required.' },
      { status: 400 }
    );
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(userWalletAddress)) {
    return NextResponse.json(
      { error: 'Invalid wallet address format.' },
      { status: 400 }
    );
  }

  try {
    // Fetch proposal with review data
    const proposals = await sqlQuery<ProposalData[]>(
      `SELECT 
        p.id,
        p.user_id,
        p.wallet_address,
        p.title,
        p.status,
        pr.token_allocation_percentage
       FROM proposals p
       LEFT JOIN proposal_reviews pr ON p.id = pr.proposal_id
       WHERE p.id = :proposalId
       LIMIT 1`,
      { proposalId }
    );

    if (proposals.length === 0) {
      return NextResponse.json(
        { error: 'Proposal not found.' },
        { status: 404 }
      );
    }

    const proposal = proposals[0];

    // Verify proposal is approved
    if (proposal.status !== 'approved') {
      return NextResponse.json(
        { error: `Proposal must be approved before finalization. Current status: ${proposal.status}` },
        { status: 400 }
      );
    }

    // Verify token allocation exists
    if (!proposal.token_allocation_percentage) {
      return NextResponse.json(
        { error: 'No token allocation found for this proposal.' },
        { status: 400 }
      );
    }

    // Verify user is the proposal owner
    if (proposal.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the proposal owner can finalize it.' },
        { status: 403 }
      );
    }

    // Verify wallet address matches
    if (proposal.wallet_address.toLowerCase() !== userWalletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Wallet address does not match proposal submitter.' },
        { status: 403 }
      );
    }

    // Pre-check the allocation against Blue's on-chain balance BEFORE we claim
    // the DB lock — avoids leaving a stuck 'pending' row when the request was
    // never going to succeed.
    const account = privateKeyToAccount(getBlueKey());
    const govToken = getGovTokenAddress();
    const govRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
    const govPublicClient = createPublicClient({ chain: base, transport: http(govRpcUrl) });

    let allocationAmount: bigint;
    try {
      allocationAmount = govAllocationAmount(proposal.token_allocation_percentage);
    } catch (allocErr) {
      return NextResponse.json(
        { error: `Cannot allocate tokens: ${allocErr instanceof Error ? allocErr.message : 'invalid allocation'}` },
        { status: 400 }
      );
    }

    const blueBalance = await govPublicClient.readContract({
      address: govToken,
      abi: GOV_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    if (blueBalance < allocationAmount) {
      return NextResponse.json(
        { error: 'Cannot allocate tokens: Insufficient balance in Blue wallet.' },
        { status: 400 }
      );
    }

    // DB-side lock for concurrent finalize: insert the pending row FIRST.
    // The partial unique index on (proposal_id) WHERE status IN
    // ('pending','confirmed') guarantees that two parallel requests cannot
    // both reach the on-chain transfer — the second insert raises 23505 and
    // we bail out before any USDC moves.
    const transactionId = uuidv4();
    try {
      await sqlQuery(
        `INSERT INTO proposal_transactions (
          id,
          proposal_id,
          transaction_hash,
          transaction_status,
          token_amount,
          gas_used
        )
         VALUES (:id, :proposalId, NULL, 'pending', NULL, NULL)`,
        { id: transactionId, proposalId }
      );
    } catch (insertErr: any) {
      if (insertErr?.code === '23505') {
        return NextResponse.json(
          { error: 'Proposal has already been finalized (or is currently being finalized).' },
          { status: 409 }
        );
      }
      throw insertErr;
    }

    // Execute token allocation. From here on, if anything fails we must mark
    // the row 'failed' so the user can retry (the unique index excludes
    // failed rows).
    console.log(`Finalizing proposal ${proposalId} with ${proposal.token_allocation_percentage}% allocation`);

    let allocation: { txHash: string; amount: bigint; estimatedGas: string };
    try {
      const walletClient = createWalletClient({ account, chain: base, transport: http(govRpcUrl) });
      const nonce = await govPublicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
      const txHash = await walletClient.writeContract({
        address: govToken,
        abi: GOV_TOKEN_ABI,
        functionName: 'transfer',
        args: [userWalletAddress as `0x${string}`, allocationAmount],
        nonce,
      });
      const receipt = await govPublicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        throw new Error(`Token allocation reverted (${txHash})`);
      }
      allocation = { txHash, amount: allocationAmount, estimatedGas: receipt.gasUsed.toString() };
    } catch (allocErr: any) {
      await sqlQuery(
        `UPDATE proposal_transactions
           SET transaction_status = 'failed'
         WHERE id = :id`,
        { id: transactionId }
      ).catch((e) => console.error('Failed to mark transaction row as failed:', e));
      throw allocErr;
    }

    // Fill in the on-chain details now that the transfer broadcast.
    await sqlQuery(
      `UPDATE proposal_transactions
         SET transaction_hash = :txHash,
             token_amount     = :tokenAmount,
             gas_used         = :gasUsed
       WHERE id = :id`,
      {
        id: transactionId,
        txHash: allocation.txHash,
        tokenAmount: allocation.amount.toString(),
        gasUsed: allocation.estimatedGas,
      }
    );

    // Update proposal status to 'active' (now on blockchain)
    await sqlQuery(
      `UPDATE proposals
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = :proposalId`,
      { proposalId }
    );

    console.log(`✅ Proposal ${proposalId} finalized. TX: ${allocation.txHash}`);

    return NextResponse.json({
      ok: true,
      transactionHash: allocation.txHash,
      tokenAmount: allocation.amount.toString(),
      tokenPercentage: proposal.token_allocation_percentage,
      estimatedConfirmationTime: 15, // Base network ~2 seconds, but we add buffer
      gasEstimate: allocation.estimatedGas,
      message: 'Proposal finalized successfully. Tokens are being transferred on-chain.',
    });
  } catch (error: any) {
    console.error('Error finalizing proposal:', error);
    
    // Provide helpful error messages
    if (error.message?.includes('not set') || error.message?.includes('not configured')) {
      return NextResponse.json(
        { error: 'Blockchain service not configured. Please contact support.' },
        { status: 503 }
      );
    }

    if (error.message?.includes('Insufficient balance')) {
      return NextResponse.json(
        { error: 'Insufficient token balance in Blue wallet. Please contact support.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to finalize proposal.' },
      { status: 500 }
    );
  }
}

// GET endpoint to check finalization status
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured.' },
      { status: 503 }
    );
  }

  await ensureProposalSchema();

  const proposalId = params.id;

  // Sync on-chain state: if CRE auto-executed the proposal, update DB
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
    const contractAddress = process.env.NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS || '0x09a4FEfEe8245B644713546FDF28b4160218f7Fc';
    const provider = new providers.JsonRpcProvider(rpcUrl);
    const contract = new Contract(contractAddress, BLUE_KILLSTREAK_ABI, provider);

    // Look up the on-chain proposal ID for this DB proposal
    const proposalRows = await sqlQuery<Array<{ on_chain_proposal_id: string | null; status: string }>>(
      `SELECT on_chain_proposal_id, status FROM proposals WHERE id = :proposalId LIMIT 1`,
      { proposalId }
    );

    if (proposalRows.length > 0 && proposalRows[0].on_chain_proposal_id) {
      const onChainId = parseInt(proposalRows[0].on_chain_proposal_id);
      const onChainProposal = await contract.getProposal(onChainId);

      // Status 2 = Executed on-chain
      if (Number(onChainProposal.status) === 2 && proposalRows[0].status !== 'completed') {
        console.log(`CRE auto-executed proposal ${onChainId} on-chain, syncing DB status.`);
        await sqlQuery(
          `UPDATE proposals SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = :proposalId`,
          { proposalId }
        );
      }
    }
  } catch (syncError) {
    console.warn('CRE on-chain sync check failed:', syncError);
    // Non-fatal — continue with normal flow
  }

  try {
    const transactions = await sqlQuery<Array<{
      id: string;
      transaction_hash: string;
      transaction_status: string;
      token_amount: string;
      gas_used: string;
      created_at: string;
      confirmed_at: string | null;
    }>>(
      `SELECT 
        id,
        transaction_hash,
        transaction_status,
        token_amount,
        gas_used,
        created_at,
        confirmed_at
       FROM proposal_transactions
       WHERE proposal_id = :proposalId
       ORDER BY created_at DESC
       LIMIT 1`,
      { proposalId }
    );

    if (transactions.length === 0) {
      return NextResponse.json({
        ok: true,
        finalized: false,
        message: 'Proposal has not been finalized yet.',
      });
    }

    const transaction = transactions[0];

    return NextResponse.json({
      ok: true,
      finalized: true,
      transaction: {
        hash: transaction.transaction_hash,
        status: transaction.transaction_status,
        tokenAmount: transaction.token_amount,
        gasUsed: transaction.gas_used,
        createdAt: transaction.created_at,
        confirmedAt: transaction.confirmed_at,
      },
    });
  } catch (error) {
    console.error('Error fetching finalization status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finalization status.' },
      { status: 500 }
    );
  }
}
