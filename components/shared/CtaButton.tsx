import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './CtaButton.module.css';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface CtaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Stretch to fill the container width. */
  block?: boolean;
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

  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
