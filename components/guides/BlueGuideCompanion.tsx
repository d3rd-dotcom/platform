'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSound } from '@/hooks/useSound';
import BlueChatBubble from '@/components/blue-chat-bubble/BlueChatBubble';
import type { GuideRecord, GuideLink } from '@/lib/guides-db';
import styles from './BlueGuideCompanion.module.css';

interface BlueGuideCompanionProps {
  guide: GuideRecord;
  prereqs: GuideLink[];
}

/** Stable, deterministic hash of a guide id → non-negative int (for rotation). */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Rotating encouragement lines — fresh visitor / all prereqs met. Blue's voice:
// upbeat, academic, short, sweet. Rotated by guide-id hash (not random per render)
// so a given guide always greets you the same way.
const READY_LINES = [
  'The base layer is solid under you. This topic is ready to climb, so take the first hold.',
  'Everything below this is charted. Nothing between you and the summit but the reading. Onward.',
  'Prereqs cleared, footing steady. This is exactly the right rung to reach for next.',
  'You built the groundwork already. Now we get to the good part: let’s scale this one.',
];

export default function BlueGuideCompanion({ guide, prereqs }: BlueGuideCompanionProps) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { play } = useSound();

  const [completedIds, setCompletedIds] = useState<Set<string> | null>(null);
  const [progressResolved, setProgressResolved] = useState(false);

  // Fetch the viewer's completed guide ids once we know they're signed in.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setProgressResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken().catch(() => null);
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/guides/progress', { cache: 'no-store', headers });
        if (res.ok) {
          const json = (await res.json()) as { completedGuideIds?: string[] };
          if (!cancelled) setCompletedIds(new Set(json.completedGuideIds ?? []));
        }
      } catch {
        /* soft-fail: fall through to an encouragement line */
      } finally {
        if (!cancelled) setProgressResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  // Pick exactly ONE contextual message per page view — no chatter spam.
  const message = useMemo<string | null>(() => {
    if (!ready || !progressResolved) return null;

    // 1. Verification states take priority — the reader should know why a guide
    //    looks the way it does before anything else.
    if (guide.status === 'pending_verification') {
      return 'Heads up: the jury’s still reading this one over. Everything here is a working draft until the review lands.';
    }
    if (guide.status === 'unpublished') {
      return 'This one went back to its author after some community notes. A revised edition is on the way, hold tight.';
    }

    // 2. Signed-out → one warm invite to sign in and track the climb.
    if (!authenticated) {
      return 'I don’t know you yet. Sign in, and whatever brought you here, I’ll make sure you finish it. Every step of the way.';
    }

    // 3. Above-your-level nudge — signed in, but missing a prerequisite.
    if (completedIds) {
      const missing = prereqs.find((p) => !completedIds.has(p.id));
      if (missing) {
        return `A quick note: “${missing.topicTitle}” comes before this one. Start the walkthrough from the bottom and you’ll reach this summit with steadier footing.`;
      }
    }

    // 4. Fresh visitor / all prereqs met → rotating encouragement (by id hash).
    return READY_LINES[hashId(guide.id) % READY_LINES.length];
  }, [ready, progressResolved, authenticated, completedIds, guide.status, guide.id, prereqs]);

  // Play the 'pop' sound exactly once, on first appearance of the message.
  const poppedRef = useRef(false);
  useEffect(() => {
    if (message && !poppedRef.current) {
      poppedRef.current = true;
      play('pop');
    }
  }, [message, play]);

  if (!message) return null;

  return (
    <div className={styles.companion}>
      <BlueChatBubble
        message={message}
        variant="compact"
        context="Guide"
        avatarSrc="/images/blue-guide-sprites/standing-front.png"
        avatarWidth={68}
        avatarHeight={68}
        pixelatedAvatar
        ariaLive="polite"
        stackOnMobile
      />
    </div>
  );
}
