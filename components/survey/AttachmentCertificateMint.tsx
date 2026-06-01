'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Medal } from '@phosphor-icons/react'
import styles from './AttachmentCertificateMint.module.css'

const PROFILE_TO_IMAGE: Record<string, string> = {
  Secure: '/certificates/Secure.png',
  Anxious: '/certificates/Anxious.png',
  Avoidant: '/certificates/Avoidant.png',
  'Fearful-Avoidant': '/certificates/Fearful-Avoidant.png',
}

interface Props {
  profileType: string
  username: string
  walletAddress: string
  onMintComplete: () => void
  onSkip: () => void
}

type MintState = 'idle' | 'minting' | 'success' | 'error'

export default function AttachmentCertificateMint({
  profileType,
  username,
  walletAddress,
  onMintComplete,
  onSkip,
}: Props) {
  const [mintState, setMintState] = useState<MintState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const imageSrc = PROFILE_TO_IMAGE[profileType] ?? PROFILE_TO_IMAGE['Secure']

  async function handleMint() {
    setMintState('minting')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/surveys/certificate/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profileType, walletAddress }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Mint failed. Please try again.')
      }

      setTxHash(data.txHash ?? null)
      setMintState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
      setMintState('error')
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.certWrap}>
        <Image
          src={imageSrc}
          alt={`${profileType} attachment style certificate`}
          width={600}
          height={600}
          className={styles.certImage}
          priority
        />
        <p className={styles.namePreview}>{username}</p>
      </div>

      <div className={styles.copy}>
        <h2 className={styles.heading}>Your certificate is ready</h2>
        <p className={styles.sub}>
          Mint it as a soulbound NFT on Base. Free — no gas required. Your name will be
          inscribed on the artwork before it is minted to your wallet.
        </p>
        <p className={styles.sub}>
          Finish attaching your results to your account by minting the soulbound token so
          Blue can update her programming.
        </p>
      </div>

      {mintState === 'success' ? (
        <div className={styles.successBlock}>
          <p className={styles.successText}>Certificate minted.</p>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.txLink}
            >
              View on BaseScan
            </a>
          )}
          <button className={styles.fancyButton} onClick={onMintComplete}>
            <span className={styles.fancyButtonInner}>
              <span className={styles.heroSlideWrap}>
                <span className={styles.heroSlideText}>See my results</span>
                <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>See my results</span>
              </span>
              <span className={styles.fancyButtonIcon} aria-hidden="true">
                <Medal size={18} weight="regular" />
              </span>
            </span>
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          {mintState === 'error' && errorMsg && (
            <p className={styles.errorText}>{errorMsg}</p>
          )}
          <button
            className={styles.fancyButton}
            onClick={handleMint}
            disabled={mintState === 'minting'}
          >
            <span className={styles.fancyButtonInner}>
              <span className={styles.heroSlideWrap}>
                <span className={styles.heroSlideText}>
                  {mintState === 'minting' ? 'Minting...' : 'Mint my certificate'}
                </span>
                <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>
                  {mintState === 'minting' ? 'Minting...' : 'Mint my certificate'}
                </span>
              </span>
              <span className={styles.fancyButtonIcon} aria-hidden="true">
                <Medal size={18} weight="regular" />
              </span>
            </span>
          </button>
          <button className={styles.skipBtn} onClick={onSkip} disabled={mintState === 'minting'}>
            Skip, show my results
          </button>
        </div>
      )}
    </div>
  )
}
