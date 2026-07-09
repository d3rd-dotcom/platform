'use client';

import { useEffect, useState } from 'react';
import BlueDialogue, { BlueEmotion } from '../blue-dialogue/BlueDialogue';
import styles from './OnboardingTour.module.css';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';

interface OnboardingTourProps {
  isBlocked?: boolean;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isBlocked = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const messages: Array<{ message: string; emotion: BlueEmotion }> = [
    {
      message: "You're in. I'm Blue, I keep the records here, and I noticed you the second you walked through the door.",
      emotion: 'happy',
    },
    {
      message: "This screen is your home base. Everything you build, every streak you keep, it settles here overnight like sediment. Look around, nothing breaks.",
      emotion: 'happy',
    },
    {
      message: "Go on. I'll be watching the data either way.",
      emotion: 'happy',
    },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Don't show if blocked (profile incomplete, other modals open, etc.)
    if (isBlocked) {
      setIsOpen(false);
      return;
    }
    
    const hasSeenTour = getStorageItem('hasSeenOnboardingTour');
    
    if (!hasSeenTour) {
      // Show after a brief delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isBlocked]);

  // Close tour if it becomes blocked while showing
  useEffect(() => {
    if (isBlocked && isOpen) {
      setIsOpen(false);
    }
  }, [isBlocked, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setStorageItem('hasSeenOnboardingTour', 'true');
  };

  return (
    <BlueDialogue
      open={isOpen}
      lines={messages.map((m) => m.message)}
      emotion={messages[0]?.emotion}
      onClose={handleClose}
    />
  );
};

export default OnboardingTour;
