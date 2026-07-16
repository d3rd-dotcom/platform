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
  'The ground under your boots is solid. This one is ripe for the picking, so reach up and grab the first idea.',
  'Everything below is mapped and quiet. Nothing stands between you and the good stuff but a little reading.',
  'Prereqs cleared, boots laced, coffee poured. This is exactly the rung your curiosity has been itching for.',
  'You laid the groundwork already, sneaky thing. Now comes my favorite part. Let’s go turn this one over together.',
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
      return 'Careful, the jury is still hunched over this one with a red pen. Treat every line like wet paint until the review lands.';
    }
    if (guide.status === 'unpublished') {
      return 'This one wandered back home to its author after some community notes. A shinier draft is on the way, so hang tight.';
    }

    // 2. Signed-out → one warm invite to sign in and track the climb.
    if (!authenticated) {
      return 'We have not met yet, and that feels like a waste. Sign in and tell me your name, and I will walk this whole climb beside you.';
    }

    // 3. Above-your-level nudge — signed in, but missing a prerequisite.
    if (completedIds) {
      const missing = prereqs.find((p) => !completedIds.has(p.id));
      if (missing) {
        return `Tiny detour first. “${missing.topicTitle}” likes to go ahead of this one. Start the walkthrough from the bottom and you’ll land here with steadier footing.`;
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
        hideSender
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
