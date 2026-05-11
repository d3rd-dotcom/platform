'use client';

import Image from 'next/image';
import styles from './AngelicCreditSystem.module.css';

const EthIcon = () => (
  <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="14" cy="14" r="14" fill="#627EEA" />
    <path d="M14 4.5V11.35L19.5 13.8L14 4.5Z" fill="white" fillOpacity="0.6" />
    <path d="M14 4.5L8.5 13.8L14 11.35V4.5Z" fill="white" />
    <path d="M14 18.45V23.5L19.5 14.85L14 18.45Z" fill="white" fillOpacity="0.6" />
    <path d="M14 23.5V18.45L8.5 14.85L14 23.5Z" fill="white" />
    <path d="M14 17.35L19.5 13.8L14 11.35V17.35Z" fill="white" fillOpacity="0.2" />
    <path d="M8.5 13.8L14 17.35V11.35L8.5 13.8Z" fill="white" fillOpacity="0.6" />
  </svg>
);

export default function AngelicCreditSystem() {
  return (
    <section className={styles.section} aria-label="Mental Wealth Academy">
      <Image
        src="/images/angelic-credit-bg.webp"
        alt=""
        fill
        className={styles.bgImage}
        priority={false}
        aria-hidden="true"
      />
      {/* Centered video overlay — floats above everything in the section */}
      <div className={styles.videoOverlayCenter}>
        <div className={styles.videoPlayerInline}>
          <video
            controls
            playsInline
            className={styles.videoEl}
          >
            <source src="/videos/angelic-credit.mov" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>

      <div className={styles.innerLayout}>
        <div className={styles.innerLeft}>
          <Image
            src="/splashlogo.png"
            alt="Mental Wealth Academy"
            width={220}
            height={60}
            className={styles.splashLogo}
            priority={false}
          />
          <p className={styles.tagline}>Your wallet. Your progress. Your wealth.</p>
        </div>
        <div className={styles.innerRight}>
          <Image
            src="/images/blue-portrait.png"
            alt="Blue — your AI companion"
            width={420}
            height={520}
            className={styles.bluePortrait}
            priority={false}
          />
          <div className={styles.walletCard}>
            <div className={styles.walletLeft}>
              <div className={styles.walletAvatar}>
                <Image
                  src="/splashlogo.png"
                  alt=""
                  width={32}
                  height={32}
                  className={styles.walletAvatarImg}
                />
              </div>
              <span className={styles.walletAddress}>0x4725...2152</span>
            </div>
            <div className={styles.walletRight}>
              <EthIcon />
              <span className={styles.walletBalance}>0.0248</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
