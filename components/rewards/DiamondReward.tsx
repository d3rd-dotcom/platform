'use client';

import { useEffect, useMemo } from 'react';
import BlueDialogue from '@/components/blue-dialogue/BlueDialogue';
import { useSound } from '@/hooks/useSound';

/**
 * The diamond reward moment: Blue hands you your diamonds in the full-screen
 * dialogue overlay, with a counting reward chip above her line. Shown on
 * course task completes, week seals, field notes, and quest rewards. Stays up
 * until the player dismisses it (arrow, ESC, or backdrop) — onComplete fires
 * on close.
 */

const BLUE_MESSAGES = [
  'Logged it. You are my favorite data point today.',
  'Peer reviewed: approved. Obviously.',
  'Filed under: excellent work.',
  'Results replicated. You are actually good at this.',
  'The lab notebook remembers this forever. So do I.',
  'Adding this to your permanent record. The good one.',
  'I checked twice. Still impressive.',
  'Quietly telling everyone in the lab about this.',
];

interface DiamondRewardProps {
  amount: number;
  onComplete?: () => void;
}

export const DiamondReward: React.FC<DiamondRewardProps> = ({ amount, onComplete }) => {
  const { play } = useSound();

  const message = useMemo(
    () => BLUE_MESSAGES[Math.floor(Math.random() * BLUE_MESSAGES.length)],
    [],
  );

  useEffect(() => {
    play('celebration');
  }, [play]);

  return (
    <BlueDialogue
      open
      lines={[message]}
      reward={amount}
      onClose={() => onComplete?.()}
    />
  );
};

export default DiamondReward;
