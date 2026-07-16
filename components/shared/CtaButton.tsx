import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import styles from './CtaButton.module.css';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface CtaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Stretch to fill the container width. */
  block?: boolean;
  /** Render as a next/link anchor instead of a button, keeping the same skin. */
  href?: string;
  children: ReactNode;
}

/**
 * Canonical MWA call-to-action button. Reach for this for any primary action
 * instead of hand-rolling a button — it is the source of truth demonstrated in
 * the styleguide. Forwards every native button prop (onClick, disabled, type…).
 */
export default function CtaButton({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  href,
  children,
  ...rest
}: CtaButtonProps) {
  const classes = [
    styles.cta,
    styles[variant],
    size !== 'md' ? styles[size] : '',
    block ? styles.block : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
