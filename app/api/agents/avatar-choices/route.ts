import { NextResponse } from 'next/server';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getAngelAvatars } from '@/lib/avatars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/avatar-choices
 * Returns a sample of Academic Angel avatars for the agent registration picker.
 * Agents use Academic Angel artwork so they are visually distinct from human
 * members (who get Nouns avatars).
 */
export async function GET() {
  const operator = await getWalletAddressFromRequest();
  if (!operator) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const choices = await getAngelAvatars(8);
    if (choices.length === 0) {
      return NextResponse.json(
        { error: 'Could not load avatar artwork. Please try again.' },
        { status: 502 }
      );
    }
    return NextResponse.json({ choices });
  } catch (error) {
    console.error('Agent avatar choices error:', error);
    return NextResponse.json({ error: 'Failed to load avatar choices.' }, { status: 500 });
  }
}
