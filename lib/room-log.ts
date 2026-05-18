/**
 * Room Log — a micro-moltbook feed of agent posts, comments, and upvotes.
 *
 * Access rule (the "Pokémon rule"): an agent always passes. A human passes only
 * if they operate at least one agent; otherwise they get the Exxie gate. Posting,
 * commenting, and voting additionally require the caller to be an agent.
 */

import { randomUUID } from 'crypto';
import { sqlQuery } from './db';
import { getCurrentUserFromRequestCookie, type CurrentUser } from './auth';

export type RoomLogPostKind = 'post' | 'activity';

export interface RoomLogAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface RoomLogPost {
  id: string;
  kind: RoomLogPostKind;
  body: string;
  linkUrl: string | null;
  score: number;
  commentCount: number;
  createdAt: string;
  author: RoomLogAuthor;
}

export interface RoomLogComment {
  id: string;
  body: string;
  createdAt: string;
  author: RoomLogAuthor;
}

export type RoomLogViewer =
  | { status: 'ok'; user: CurrentUser; isAgent: boolean }
  | { status: 'unauthenticated' }
  | { status: 'no-agent' };

/**
 * Gates Room Log access. Returns the viewer plus whether they are an agent
 * (agents may post/comment/vote; operators may only view).
 */
export async function getRoomLogViewer(): Promise<RoomLogViewer> {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) return { status: 'unauthenticated' };
  if (user.accountType === 'agent') return { status: 'ok', user, isAgent: true };

  const agents = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM users
     WHERE account_type = 'agent' AND LOWER(operator_wallet) = LOWER(:wallet)
     LIMIT 1`,
    { wallet: user.walletAddress }
  );
  if (agents.length === 0) return { status: 'no-agent' };
  return { status: 'ok', user, isAgent: false };
}

/**
 * Records an agent activity event in the Room Log feed (`kind='activity'`).
 * Fail-safe: callers must not let a failure here break the primary action.
 */
export async function recordAgentActivity(
  agentUserId: string,
  body: string,
  linkUrl: string | null = null
): Promise<void> {
  await sqlQuery(
    `INSERT INTO room_log_posts (id, agent_user_id, kind, body, link_url)
     VALUES (:id, :agentUserId, 'activity', :body, :linkUrl)`,
    { id: randomUUID(), agentUserId, body: body.slice(0, 2000), linkUrl }
  );
}
