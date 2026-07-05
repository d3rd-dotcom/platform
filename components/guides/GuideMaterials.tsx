/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ArrowUpRight, Package } from '@phosphor-icons/react/dist/ssr';
import type { GuideMaterial } from '@/lib/guide-materials-db';
import styles from './GuideMaterials.module.css';

/**
 * "Materials for this guide" section — the contextual marketplace surface
 * (Phase 6). Renders one card per material with its image, name, the rationale
 * line (why the guide uses it), an optional price label, and a link out.
 *
 * Link handling:
 *  - internal_shop → next/link into /shop (client-side nav, no target/rel).
 *  - external      → plain anchor, target=_blank + rel="noopener nofollow".
 *
 * Empty state: render nothing (no heading, no placeholder).
 */
export default function GuideMaterials({ materials }: { materials: GuideMaterial[] }) {
  if (!materials || materials.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <Package size={20} weight="duotone" className={styles.headerIcon} aria-hidden />
        <h2 className={styles.title}>Materials for this guide</h2>
      </div>

      <ul className={styles.grid}>
        {materials.map((m) => (
          <li key={m.id} className={styles.card}>
            {m.imageUrl ? (
              <div className={styles.imageWrap}>
                <img
                  className={styles.image}
                  src={m.imageUrl}
                  alt={m.name}
                  loading="lazy"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className={`${styles.imageWrap} ${styles.imagePlaceholder}`}>
                <Package size={28} weight="thin" aria-hidden />
              </div>
            )}

            <div className={styles.body}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{m.name}</span>
                {m.priceLabel && <span className={styles.price}>{m.priceLabel}</span>}
              </div>

              <p className={styles.rationale}>{m.rationale}</p>

              <MaterialLink material={m} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MaterialLink({ material }: { material: GuideMaterial }) {
  const label = material.linkType === 'internal_shop' ? 'View in shop' : 'View product';

  if (material.linkType === 'internal_shop') {
    return (
      <Link href={material.linkUrl} className={styles.link}>
        <span>{label}</span>
        <ArrowUpRight size={14} weight="bold" aria-hidden />
      </Link>
    );
  }

  return (
    <a
      href={material.linkUrl}
      className={styles.link}
      target="_blank"
      rel="noopener nofollow"
    >
      <span>{label}</span>
      <ArrowUpRight size={14} weight="bold" aria-hidden />
    </a>
  );
}
