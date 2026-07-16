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

// Rotating encouragement lines — fresh visitor / all prereqs met. Blue's voice
// (lib/bluepersonality.json): silly, excitable, forgetful, loyal; giddy short
// sentences. Rotated by guide-id hash (not random per render) so a given guide
// always greets you the same way.
const READY_LINES = [
  'Ooh ooh, this one is unlocked! I checked twice, then forgot, then checked again just to be sure. Go on, open it, I want to see!',
  'Everything under this one is finished and sparkly! I filed the proof in a folder called Shiny Things, so it must be true.',
  'You can totally start this one! I would race you to the first paragraph, but I got distracted just thinking about it.',
  'All the groundwork is done! Now comes my favorite part, the part where you learn the thing. Okay, every part is my favorite part.',
];

// Animated pixel-Blue sprites for the companion bubble — picked by guide-id
// hash (stable per guide, SSR-safe) so she is mid-motion instead of frozen.
const COMPANION_SPRITES = [
  '/images/blue-guide-sprites/walking-west.gif',
  '/images/blue-guide-sprites/breathing-idle.gif',
  '/images/blue-guide-sprites/walking-north.gif',
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
      return 'The reviewers are still poking this one with their little clipboards! I will tell you the second it earns its shiny stamp.';
    }
    if (guide.status === 'unpublished') {
      return 'Oops, this one went home to its author for a glow-up! It will come back shinier, I just know it. I will wait right here!';
    }

    // 2. Signed-out → one warm invite to sign in and track the climb.
    if (!authenticated) {
      return 'Wait, I do not even know your name yet! Sign in so I can cheer for you properly. I already made you a folder, it has stars on it.';
    }

    // 3. Above-your-level nudge — signed in, but missing a prerequisite.
    if (completedIds) {
      const missing = prereqs.find((p) => !completedIds.has(p.id));
      if (missing) {
        return `Tiny detour! “${missing.topicTitle}” wants to go first, and honestly it earned it. Start the walkthrough from the bottom and I will bounce along beside you.`;
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
        avatarSrc={COMPANION_SPRITES[hashId(guide.id) % COMPANION_SPRITES.length]}
        avatarWidth={68}
        avatarHeight={68}
        pixelatedAvatar
        ariaLive="polite"
        stackOnMobile
      />
    </div>
  );
}
