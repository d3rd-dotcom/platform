import { NextResponse } from 'next/server';
import { providers, Contract } from 'ethers';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureProposalSchema } from '@/lib/ensureProposalSchema';
import { BLUE_KILLSTREAK_ABI } from '@/lib/blue-contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OnChainData {
  forVotes: string;
  againstVotes: string;
  votingDeadline: number;
  blueLevel: number;
  executed: boolean;
  status: number;
  recipient: string;
  usdcAmount: string;
}

/**
 * Resolve on-chain state for every proposal that exists on-chain. Done
 * server-side so the cards always have authoritative status without depending
 * on a browser wallet/RPC (which was failing, leaving cards stuck on DB-only
 * state). Best-effort: a failed read just omits onChainData for that proposal.
 */
async function enrichWithOnChain<T extends { onChainProposalId: string | null }>(
  rows: T[]
): Promise<Array<T & { onChainData?: OnChainData }>> {
  const withChain = rows.filter((r) => r.onChainProposalId);
  if (withChain.length === 0) return rows;

  const rpcUrl =
    process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
  const contractAddress =
    process.env.NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS ||
    process.env.NEXT_PUBLIC_AZURA_KILLSTREAK_ADDRESS ||
    '0x2cbb90a761ba64014b811be342b8ef01b471992d';

  try {
    const provider = new providers.JsonRpcProvider(rpcUrl);
    const contract = new Contract(contractAddress, BLUE_KILLSTREAK_ABI, provider);

    const byId = new Map<string, OnChainData>();
    await Promise.all(
      withChain.map(async (r) => {
        try {
          const p = await contract.getProposal(parseInt(r.onChainProposalId as string, 10));
          byId.set(r.onChainProposalId as string, {
            forVotes: p.forVotes.toString(),
            againstVotes: p.againstVotes.toString(),
            votingDeadline: Number(p.votingDeadline),
            blueLevel: Number(p.blueLevel),
            executed: p.executed,
            status: Number(p.status),
            recipient: String(p.recipient || ''),
            usdcAmount: p.usdcAmount.toString(),
          });
        } catch {
          /* skip this one; card falls back to DB state */
        }
      })
    );

    return rows.map((r) =>
      r.onChainProposalId && byId.has(r.onChainProposalId)
        ? { ...r, onChainData: byId.get(r.onChainProposalId) }
        : r
    );
  } catch (e: any) {
    console.warn('proposals on-chain enrichment failed:', e?.message);
    return rows;
  }
}

interface ProposalWithReview {
  id: string;
  user_id: string;
  wallet_address: string;
  title: string;
  proposal_markdown: string;
  status: string;
  created_at: string;
  updated_at: string;
  token_amount: string | null;
  recipient_address: string | null;
  on_chain_proposal_id: string | null;
  on_chain_tx_hash: string | null;
  username: string | null;
  avatar_url: string | null;
  review_decision: string | null;
  review_reasoning: string | null;
  review_token_allocation: number | null;
  review_scores: string | null;
  review_reviewed_at: string | null;
  blue_review_tx_hash: string | null;
}

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured.' },
      { status: 503 }
    );
  }

  await ensureProposalSchema();

  try {
    // Fetch only proposals that have been reviewed (rejected or created on-chain)
    // This means they have a review decision (rejected) or on_chain_proposal_id (created)
    // Try to include on_chain_proposal_id, but fall back if column doesn't exist
    let proposals: ProposalWithReview[];
    try {
      proposals = await sqlQuery<ProposalWithReview[]>(
        `SELECT 
          p.id,
          p.user_id,
          p.wallet_address,
          p.title,
          p.proposal_markdown,
          p.status,
          p.created_at,
          p.updated_at,
          p.token_amount,
          p.recipient_address,
          p.on_chain_proposal_id,
          p.on_chain_tx_hash,
          u.username,
          u.avatar_url,
          pr.decision as review_decision,
          pr.reasoning as review_reasoning,
          pr.token_allocation_percentage as review_token_allocation,
          pr.scores as review_scores,
          pr.reviewed_at as review_reviewed_at,
          pr.blue_review_tx_hash
         FROM proposals p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN proposal_reviews pr ON p.id = pr.proposal_id
         WHERE pr.decision IS NOT NULL
           AND p.on_chain_proposal_id IS NOT NULL
         ORDER BY p.created_at DESC`
      );
    } catch (queryError: any) {
      // If on_chain fields don't exist, try without them
      if (queryError.message?.includes('on_chain') || queryError.code === '42703') {
        console.warn('on_chain columns not found, querying without them');
        proposals = await sqlQuery<ProposalWithReview[]>(
          `SELECT 
            p.id,
            p.user_id,
            p.wallet_address,
            p.title,
            p.proposal_markdown,
            p.status,
            p.created_at,
            p.updated_at,
            p.token_amount,
            p.recipient_address,
            NULL as on_chain_proposal_id,
            NULL as on_chain_tx_hash,
            u.username,
            u.avatar_url,
            pr.decision as review_decision,
            pr.reasoning as review_reasoning,
            pr.token_allocation_percentage as review_token_allocation,
            pr.scores as review_scores,
            pr.reviewed_at as review_reviewed_at,
            NULL as blue_review_tx_hash
           FROM proposals p
           LEFT JOIN users u ON p.user_id = u.id
           LEFT JOIN proposal_reviews pr ON p.id = pr.proposal_id
           WHERE pr.decision IS NOT NULL
           ORDER BY p.created_at DESC`
        );
      } else {
        throw queryError;
      }
    }

    // Format the response
    const formattedProposals = proposals.map(p => ({
      id: p.id,
      userId: p.user_id,
      walletAddress: p.wallet_address,
      title: p.title,
      proposalMarkdown: p.proposal_markdown,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      tokenAmount: p.token_amount || null,
      recipientAddress: p.recipient_address || null,
      onChainProposalId: p.on_chain_proposal_id || null,
      onChainTxHash: p.on_chain_tx_hash || null,
      user: {
        username: p.username,
        avatarUrl: p.avatar_url,
      },
      review: p.review_decision ? {
        decision: p.review_decision,
        reasoning: p.review_reasoning,
        tokenAllocation: p.review_token_allocation,
        scores: p.review_scores ? (() => {
          try {
            return typeof p.review_scores === 'string' ? JSON.parse(p.review_scores) : p.review_scores;
          } catch (e) {
            console.error('Error parsing review scores:', e);
            return null;
          }
        })() : null,
        reviewedAt: p.review_reviewed_at,
        onChainProposalId: p.on_chain_proposal_id || null,
        blueReviewTxHash: p.blue_review_tx_hash || null,
      } : null,
    }));

    const enrichedProposals = await enrichWithOnChain(formattedProposals);

    return NextResponse.json({
      ok: true,
      proposals: enrichedProposals,
    });
  } catch (error: any) {
    console.error('Error fetching proposals:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch proposals.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
