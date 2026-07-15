import React from 'react';
import Link from 'next/link';
import styles from './Banner.module.css';

interface Crumb {
  label: string;
  href?: string;
}

interface BannerProps {
  backHref?: string;
  breadcrumbs?: Crumb[];
  tone?: 'brand' | 'neutral';
  actions?: React.ReactNode;
}

const Banner: React.FC<BannerProps> = ({ backHref, breadcrumbs, tone = 'brand', actions }) => {
  const showTrail = Boolean(backHref);
  const hasCrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);

  return (
    <div className={`${styles.banner} ${tone === 'neutral' ? styles.bannerNeutral : ''}`}>
      {showTrail ? (
        <div className={styles.trail}>
          <Link href={backHref!} className={styles.backArrow} aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          {hasCrumbs && <nav className={styles.crumbs} aria-label="Breadcrumb">
            {breadcrumbs!.map((crumb, i) => {
              const isLast = i === breadcrumbs!.length - 1;
              const isRoot = i === 0;
              return (
                <React.Fragment key={i}>
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className={`${styles.crumb} ${isRoot ? styles.crumbRoot : ''}`}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`${styles.crumb} ${isLast ? styles.crumbCurrent : ''} ${isRoot ? styles.crumbRoot : ''}`}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <span className={`${styles.crumbSep} ${isRoot ? styles.crumbRoot : ''}`} aria-hidden="true">/</span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      ) : (
        <p className={styles.bannerText}>
          The Next Gen Micro-University
        </p>
      )}
    </div>
  );
};

export default Banner;
