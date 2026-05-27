'use client';

import Link from 'next/link';
import React from 'react';
import styles from './Button.module.css';

type Size = 'bulky' | 'compact';

type CommonProps = {
  children: React.ReactNode;
  className?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
  size?: Size;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsAnchor = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | 'href'> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    { children, className, startIcon, endIcon, fullWidth, size = 'bulky', ...rest },
    ref,
  ) {
    const classes = cx(
      styles.button,
      size === 'compact' && styles.compact,
      fullWidth && styles.fullWidth,
      className,
    );

    const content = (
      <>
        {startIcon ? <span className={styles.icon}>{startIcon}</span> : null}
        <span className={styles.label}>{children}</span>
        {endIcon ? <span className={styles.icon}>{endIcon}</span> : null}
      </>
    );

    if ('href' in rest && typeof rest.href === 'string') {
      const { href, ...anchorRest } = rest as ButtonAsAnchor;
      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          {...anchorRest}
        >
          {content}
        </Link>
      );
    }

    const { type = 'button', ...buttonRest } = rest as ButtonAsButton;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        className={classes}
        {...buttonRest}
      >
        {content}
      </button>
    );
  },
);

export default Button;
