'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import styles from './AvatarSelectorModal.module.css';

interface Avatar {
  id: string;
  image_url: string;
  metadata_url: string;
}

interface AvatarSelectorModalProps {
  onClose: () => void;
  onAvatarSelected: (avatarUrl: string) => void;
}

const AvatarSelectorModal: React.FC<AvatarSelectorModalProps> = ({ onClose, onAvatarSelected }) => {
  const { getAccessToken } = usePrivy();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [rerollCost, setRerollCost] = useState(200);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const token = await getAccessToken();
        const response = await fetch('/api/avatars/choices', {
          cache: 'no-store',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load avatars');
        }

        setAvatars(data.choices || []);
        setCurrentAvatar(data.currentAvatar || null);
        setSelectedAvatar(data.currentAvatar || null);
        if (typeof data.credits === 'number') setCredits(data.credits);
        if (typeof data.rerollCost === 'number') setRerollCost(data.rerollCost);
      } catch (err: any) {
        console.error('Failed to fetch avatars:', err);
        setError(err?.message || 'Failed to load avatars');
      } finally {
        setLoading(false);
      }
    };

    fetchAvatars();
  }, [getAccessToken]);

  const handleReroll = async () => {
    setRerolling(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/avatars/reroll', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to reroll avatars');
      }

      setAvatars(data.choices || []);
      setSelectedAvatar(null);
      if (typeof data.credits === 'number') setCredits(data.credits);
    } catch (err: any) {
      console.error('Failed to reroll avatars:', err);
      setError(err?.message || 'Failed to reroll avatars');
    } finally {
      setRerolling(false);
    }
  };

  const handleSelectAvatar = async () => {
    if (!selectedAvatar) {
      setError('Please select an avatar');
      return;
    }

    // Find the avatar ID from the image URL
    const avatar = avatars.find(a => a.image_url === selectedAvatar);
    if (!avatar) {
      setError('Invalid avatar selection');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/avatars/select', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ avatar_id: avatar.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to select avatar');
      }

      // Notify parent component and trigger profile update
      onAvatarSelected(selectedAvatar);
      window.dispatchEvent(new Event('profileUpdated'));
      onClose();
    } catch (err: any) {
      console.error('Failed to select avatar:', err);
      setError(err?.message || 'Failed to select avatar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Select Your Avatar</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>Loading avatars...</div>
          ) : error && avatars.length === 0 ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <>
              <p className={styles.description}>
                Choose one of your unique avatars
              </p>
              <div className={styles.avatarGrid}>
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    className={`${styles.avatarOption} ${
                      selectedAvatar === avatar.image_url ? styles.selected : ''
                    } ${currentAvatar === avatar.image_url ? styles.current : ''}`}
                    onClick={() => setSelectedAvatar(avatar.image_url)}
                    type="button"
                  >
                    <div className={styles.avatarImageWrapper}>
                      <Image
                        src={avatar.image_url}
                        alt={avatar.id}
                        width={120}
                        height={120}
                        className={styles.avatarImage}
                        unoptimized
                      />
                    </div>
                    {currentAvatar === avatar.image_url && (
                      <span className={styles.currentBadge}>Current</span>
                    )}
                  </button>
                ))}
              </div>
              {error && <div className={styles.errorMessage}>{error}</div>}
              <div className={styles.rerollRow}>
                <button
                  className={styles.rerollButton}
                  onClick={handleReroll}
                  disabled={rerolling || saving || (credits !== null && credits < rerollCost)}
                  type="button"
                >
                  {rerolling ? 'Rerolling…' : `Reroll for ${rerollCost} credits`}
                </button>
                {credits !== null && (
                  <span className={styles.creditsNote}>
                    {credits < rerollCost
                      ? `You have ${credits} credits — need ${rerollCost}`
                      : `Balance: ${credits} credits`}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.selectButton}
            onClick={handleSelectAvatar}
            disabled={saving || loading || !selectedAvatar}
            type="button"
          >
            {saving ? 'Selecting...' : 'Select Avatar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarSelectorModal;
