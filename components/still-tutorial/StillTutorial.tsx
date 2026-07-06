'use client';

import React from 'react';
import BlueDialogue, { BlueEmotion } from '../blue-dialogue/BlueDialogue';

export interface TutorialStep {
  message: string;
  emotion: BlueEmotion;
  targetElement?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface StillTutorialProps {
  steps: TutorialStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  title?: string;
  showProgress?: boolean;
}

/**
 * StillTutorial now delegates to the full-screen BlueDialogue overlay. Each
 * tutorial step becomes one line; the overlay handles the typewriter, arrow
 * stepping, history, and close. `title` / `showProgress` are retained on the
 * props for call-site compatibility.
 */
const StillTutorial: React.FC<StillTutorialProps> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
}) => {
  const handleClose = () => {
    onComplete?.();
    onClose();
  };

  return (
    <BlueDialogue
      open={isOpen && steps.length > 0}
      lines={steps.map((s) => s.message)}
      emotion={steps[0]?.emotion}
      onClose={handleClose}
    />
  );
};

export default StillTutorial;
