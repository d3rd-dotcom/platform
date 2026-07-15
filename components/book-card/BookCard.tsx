'use client';

import React from 'react';
import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react';
import styles from './BookCard.module.css';

interface BookCardProps {
  title?: string;
  author?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  slug?: string;
  onReadClick?: (slug: string) => void;
  href?: string;
  actionLabel?: string;
}

const BookCard: React.FC<BookCardProps> = ({
  title = "Web3 Education",
  author = "By: Jhinn Bay",
  description = "Learn how blockchain infrastructure can support portable records and verified rewards.",
  category = "Non-Fiction",
  imageUrl = "https://i.imgur.com/4K6QZ8k.png",
  slug = "",
  onReadClick,
  href,
  actionLabel = 'Read article',
}) => {
  const handleCardClick = () => {
    if (onReadClick && slug) {
      onReadClick(slug);
    }
  };

  const content = (
    <>
        <div className={styles.header}>
          <div
            className={styles.bookImage}
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        </div>

        <div className={styles.content}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description}</p>
        </div>

        <div className={styles.footer}>
          <div className={styles.metaGroup}>
            <span className={styles.category}>{category}</span>
            {author && <span className={styles.metaBadge}>{author}</span>}
          </div>
          {(href || slug) && (
            <span className={styles.readLink}>
              {actionLabel}
              <CaretRight size={12} weight="bold" className={styles.readChevron} />
            </span>
          )}
        </div>
    </>
  );

  return (
    <div className={styles.bookCard}>
      {href ? (
        <Link href={href} className={styles.cardClickable}>
          {content}
        </Link>
      ) : (
        <div
          className={styles.cardClickable}
          onClick={handleCardClick}
          role={slug ? 'button' : undefined}
          tabIndex={slug ? 0 : undefined}
          onKeyDown={slug ? (e) => { if (e.key === 'Enter') handleCardClick(); } : undefined}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default BookCard;
