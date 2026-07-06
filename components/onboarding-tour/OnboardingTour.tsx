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
      message: "Hey there! I'm Blue, and I'll be here whenever you need me. Welcome to Mental Wealth Academy — a place to learn, reflect, and grow together.",
      emotion: 'happy',
    },
    {
      message: "This is your home base. You can check in daily, join events, take surveys, and explore what the community is building. Take your time and look around!",
      emotion: 'happy',
    },
    {
      message: "Ready when you are. If you ever need help or just want to chat, I'm always here. Let's get started!",
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
