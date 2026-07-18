import Image from 'next/image';
import type { CSSProperties } from 'react';
import styles from './CompanyLogoMarquee.module.css';

const logos = [
  {
    src: '/companylogos/American_Psychological_Association_logo.svg.png',
    alt: 'American Psychological Association',
    width: 1200,
    height: 474,
    displayWidth: 154,
  },
  {
    src: '/companylogos/artizen.svg',
    alt: 'Artizen',
    width: 603,
    height: 128,
    displayWidth: 148,
  },
  {
    src: '/companylogos/foundation-dark.webp',
    alt: 'Foundation',
    width: 584,
    height: 182,
    displayWidth: 124,
  },
  {
    src: '/companylogos/full-aragon-logo.webp',
    alt: 'Aragon',
    width: 2500,
    height: 621,
    displayWidth: 138,
  },
  {
    src: '/companylogos/gitcoin.webp',
    alt: 'Gitcoin',
    width: 1570,
    height: 554,
    displayWidth: 122,
  },
  {
    src: '/companylogos/irb.svg',
    alt: 'Institutional Review Board',
    width: 210,
    height: 60,
    displayWidth: 132,
  },
  {
    src: '/companylogos/Logo_ElizaOS_Blue_RGB.webp',
    alt: 'ElizaOS',
    width: 13042,
    height: 2000,
    displayWidth: 182,
  },
  {
    src: '/companylogos/anthropic.svg',
    alt: 'Anthropic',
    width: 110,
    height: 28,
    displayWidth: 136,
  },
  {
    src: '/companylogos/openai-wordmark.webp',
    alt: 'OpenAI',
    width: 1042,
    height: 521,
    displayWidth: 148,
    presentation: 'openai',
  },
  {
    src: '/companylogos/gemini.svg',
    alt: 'Google Gemini',
    width: 288,
    height: 65,
    displayWidth: 148,
  },
  {
    src: '/companylogos/supabase.svg',
    alt: 'Supabase',
    width: 130,
    height: 28,
    displayWidth: 138,
  },
  {
    src: '/companylogos/chainlink-new.svg',
    alt: 'Chainlink',
    width: 130,
    height: 28,
    displayWidth: 138,
  },
];

function LogoGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className={styles.logoGroup} aria-hidden={duplicate || undefined}>
      {logos.map((logo) => (
        <li
          className={styles.logoItem}
          key={`${duplicate ? 'duplicate-' : ''}${logo.src}`}
          style={{ '--logo-width': `${logo.displayWidth}px` } as CSSProperties}
        >
          <Image
            src={logo.src}
            alt={duplicate ? '' : logo.alt}
            width={logo.width}
            height={logo.height}
            sizes={`${logo.displayWidth}px`}
            className={`${styles.logo} ${
              logo.presentation === 'openai' ? styles.openAiLogo : ''
            }`}
          />
        </li>
      ))}
    </ul>
  );
}

export default function CompanyLogoMarquee() {
  return (
    <section
      className={styles.marqueeSection}
      aria-labelledby="ecosystem-foundations-heading"
    >
      <h2 id="ecosystem-foundations-heading" className={styles.srOnly}>
        Ecosystem and research foundations
      </h2>
      <div className={styles.logoViewport}>
        <div className={styles.logoTrack}>
          <LogoGroup />
          <LogoGroup duplicate />
        </div>
      </div>
    </section>
  );
}
