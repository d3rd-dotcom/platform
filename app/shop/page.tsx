'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { ShopPageSkeleton } from '@/components/skeleton/Skeleton';
import { useSound } from '@/hooks/useSound';
import styles from './page.module.css';

type BadgeType = 'new' | 'limited' | 'exclusive' | 'free';

interface ShopItem {
  id: string;
  title: string;
  sub: string;
  desc: string;
  price: string;
  image: string;
  category: string;
  badge?: BadgeType;
}

const shopItems: ShopItem[] = [
  {
    id: 'blazer',
    title: 'The Academy Blazer',
    sub: 'Official MWA Uniform',
    desc: 'Midnight navy with embroidered crest and hidden inner pocket for your field journal. Tailored cut, unisex, runs true to size.',
    price: '120 USDC',
    image: 'https://i.imgur.com/S3AMvJA.png',
    category: 'Uniforms',
    badge: 'exclusive',
  },
  {
    id: 'journal',
    title: 'Glitch Field Journal',
    sub: 'Leather-bound, grid pages',
    desc: 'A 200-page leather field journal with dot-grid pages, gilded edges, and the Academy sigil debossed on the cover. Includes a ribbon bookmark and pen loop. Built for notes, reflections, and research sketches.',
    price: '45 USDC',
    image: 'https://i.imgur.com/57ahVVX.png',
    category: 'Accessories',
    badge: 'new',
  },
  {
    id: 'hoodie',
    title: 'Cipher Hoodie',
    sub: 'Heavyweight 400gsm',
    desc: 'Oversized heavyweight hoodie in washed obsidian. Features a subtle glitch-pattern inner lining and "MENTAL WEALTH" debossed on the back yoke. Double-layered hood, kangaroo pocket with hidden zip.',
    price: '85 USDC',
    image: 'https://i.imgur.com/TPujE2j.png',
    category: 'Uniforms',
  },
  {
    id: 'pin-set',
    title: 'Scholar Pin Set',
    sub: 'Enamel × Gold, Set of 5',
    desc: 'Five hard enamel pins representing the five disciplines: Cognition, Wealth, Health, Creativity, and Sovereignty. Each features micro-engraved serial numbers. Collect all five to unlock a hidden curriculum quest.',
    price: '28 USDC',
    image: 'https://i.imgur.com/yUCxnDX.png',
    category: 'Accessories',
    badge: 'new',
  },
  {
    id: 'beanie',
    title: 'Neural Beanie',
    sub: 'Merino wool blend',
    desc: 'Ribbed merino-blend beanie in Academy black with a woven label. Warm enough for late study sessions and early walks.',
    price: '32 USDC',
    image: 'https://i.imgur.com/fO2vF5f.png',
    category: 'Accessories',
  },
  {
    id: 'patch',
    title: 'Division Patch',
    sub: 'Iron-on, 3" diameter',
    desc: 'Embroidered patch for your chosen division. Attach to your blazer, bag, or jacket. Each division has a mark derived from systems diagrams and Academy iconography.',
    price: '12 USDC',
    image: 'https://i.imgur.com/yImR5DJ.png',
    category: 'Accessories',
    badge: 'free',
  },
  {
    id: 'magazine',
    title: 'MWA Quarterly — Issue 01',
    sub: 'Print + Digital Bundle',
    desc: 'The inaugural issue of the Mental Wealth Academy quarterly. 80 pages covering autonomous governance, Bayesian trading, on-chain education models, and interviews with the founding scholars. Printed on recycled stock.',
    price: '18 USDC',
    image: '/images/angel-investing.png',
    category: 'Publications',
    badge: 'limited',
  },
  {
    id: 'labcoat',
    title: 'Research Lab Coat',
    sub: 'Crisp white, embroidered',
    desc: 'For the scholars who operate at the frontier. Premium cotton lab coat with the Academy crest, name tag slot, and inner document pocket. Worn during Research Division sessions and public demos.',
    price: '95 USDC',
    image: '/images/shop/research-lab-coat.webp',
    category: 'Uniforms',
    badge: 'exclusive',
  },
  {
    id: 'tote',
    title: 'Archive Tote',
    sub: 'Heavy canvas, screen-printed',
    desc: 'Oversized canvas tote with the Academy motto screen-printed in archival ink. Internal zip pocket, reinforced straps. Carry your textbooks, tablets, and contraband curricula in style.',
    price: '22 USDC',
    image: '/images/shop/archive-tote.webp',
    category: 'Accessories',
  },
  {
    id: 'headphones',
    title: 'HD-01 Focus Cans',
    sub: 'Active noise cancelling',
    desc: 'Over-ear headphones designed for deep study sessions. 40-hour battery, spatial audio, and a custom "Focus Mode" EQ tuned for lecture playback and lo-fi concentration.',
    price: '180 USDC',
    image: 'https://yeezy.com/cdn-cgi/image/width=1024,height=1024,quality=100,compression=fast,slow-connection-quality=80,fit=pad,gravity=center,background=transparent,format=avif/https://cdn.swell.store/yzy-prod/6949ed1f80c01300127beab9/b64116f133b7f192bb91b291e8dd14c7/HD-01-B-1.png',
    category: 'Tech',
    badge: 'limited',
  },
  {
    id: 'keycard',
    title: 'Access Keycard',
    sub: 'NFC-enabled, holographic',
    desc: 'A physical NFC keycard with holographic Academy crest. Tap to verify your on-chain membership at IRL events. Each card is serialized and tied to your wallet address.',
    price: '8 USDC',
    image: '/images/shop/access-keycard.webp',
    category: 'Tech',
    badge: 'new',
  },
  {
    id: 'sticker-pack',
    title: 'Glitch Sticker Pack',
    sub: '12 vinyl die-cuts',
    desc: 'Twelve weatherproof vinyl stickers featuring glitch art, Academy marks, division emblems, and research motifs. Laptop and water bottle approved.',
    price: '6 USDC',
    image: '/images/shop/glitch-sticker-pack.webp',
    category: 'Accessories',
    badge: 'free',
  },
  {
    id: 'sneakers',
    title: 'JC-10 Scholar Edition',
    sub: 'Triple black, cushioned sole',
    desc: 'Minimalist triple-black sneakers with custom insole bearing the Academy coordinates. Comfortable enough for all-day lectures, sharp enough for governance ceremonies.',
    price: '220 USDC',
    image: 'https://yeezy.com/cdn-cgi/image/width=1024,height=1024,quality=100,compression=fast,slow-connection-quality=80,fit=pad,gravity=center,background=transparent,format=avif/https://cdn.swell.store/yzy-prod/694d83925095a200120c13c0/a15e70f2904c7fdb11f10bbe48f3f5b1/JC-10-BLACK-1.png',
    category: 'Footwear',
    badge: 'limited',
  },
  {
    id: 'lanyard',
    title: 'Scholar Lanyard',
    sub: 'Woven jacquard, breakaway clip',
    desc: 'Jacquard-woven lanyard with repeating Academy pattern. Breakaway safety clip and detachable badge holder. Required for campus access during intensive cohorts.',
    price: '14 USDC',
    image: '/images/shop/scholar-lanyard.webp',
    category: 'Accessories',
  },
  {
    id: 'notebook',
    title: 'Thesis Notebook',
    sub: 'A5, ruled, 120gsm paper',
    desc: 'Premium A5 notebook with ivory 120gsm ruled pages, lay-flat binding, and a cover embossed with the Academy\'s founding equation. For your most important ideas.',
    price: '16 USDC',
    image: '/images/shop/thesis-notebook.webp',
    category: 'Publications',
  },
  {
    id: 'starter-kit',
    title: 'New Scholar Starter Kit',
    sub: 'Blazer + Journal + Pin Set + Keycard',
    desc: 'Everything you need to begin the cohort. The official Academy blazer, glitch field journal, full scholar pin set, and your NFC access keycard bundled at a discount.',
    price: '185 USDC',
    image: '/images/shop/new-scholar-starter-kit.webp',
    category: 'Bundles',
    badge: 'exclusive',
  },
];

const ALL_CATEGORIES = ['All', ...Array.from(new Set(shopItems.map((i) => i.category)))];

const badgeClassMap: Record<BadgeType, string> = {
  new: 'badgeNew',
  limited: 'badgeLimited',
  exclusive: 'badgeExclusive',
  free: 'badgeFree',
};

export default function ShopPage() {
  const { play } = useSound();
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isContentLoading, setIsContentLoading] = useState(true);

  const filtered = activeCategory === 'All' ? shopItems : shopItems.filter((i) => i.category === activeCategory);

  useEffect(() => {
    // Show skeleton briefly, then reveal content
    const timer = setTimeout(() => {
      setIsContentLoading(false);
    }, 600);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  if (isContentLoading) {
    return (
      <div className={styles.pageLayout}>
        <SideNavigation />
        <main className={styles.page}>
          <ShopPageSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.page}>
        {/* Category pills */}
        <div className={styles.categories}>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`${styles.categoryPill} ${activeCategory === cat ? styles.categoryPillActive : ''}`}
              onClick={() => { play('click'); setActiveCategory(cat); }}
              onMouseEnter={() => play('hover')}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={styles.productGrid}>
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.productCard}
              onClick={() => { play('click'); setSelectedItem(item); }}
              onMouseEnter={() => play('hover')}
            >
              <img
                className={styles.productImage}
                src={item.image}
                alt={item.title}
                loading="lazy"
                draggable={false}
                referrerPolicy="no-referrer"
              />
              <span className={styles.cardMeta}>
                <span className={styles.metaText}>
                  <span className={styles.metaTitle}>{item.title}</span>
                  <span className={styles.metaSub}>{item.sub}</span>
                </span>
                <span className={styles.metaFooter}>
                  <span className={styles.metaPrice}>{item.price}</span>
                  {item.badge && (
                    <span className={`${styles.metaBadge} ${styles[badgeClassMap[item.badge]]}`}>
                      {item.badge}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Detail Modal */}
        {selectedItem && (
          <div className={styles.detailOverlay} onClick={() => setSelectedItem(null)}>
            <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
              <div className={styles.detailImageWrap}>
                <img className={styles.detailImage} src={selectedItem.image} alt={selectedItem.title} referrerPolicy="no-referrer" />
              </div>
              <div className={styles.detailInfo}>
                {selectedItem.badge && (
                  <span className={`${styles.detailBadge} ${styles[badgeClassMap[selectedItem.badge]]}`}>
                    {selectedItem.badge}
                  </span>
                )}
                <span className={styles.detailTitle}>{selectedItem.title}</span>
                <span className={styles.detailSub}>{selectedItem.sub}</span>
                <div className={styles.detailDivider} />
                <p className={styles.detailDesc}>{selectedItem.desc}</p>
                <span className={styles.detailPrice}>{selectedItem.price}</span>
                <div className={styles.detailActions}>
                  <button
                    className={styles.detailMintButton}
                    onClick={() => play('click')}
                    onMouseEnter={() => play('hover')}
                  >
                    Mint Now
                  </button>
                  <button
                    className={styles.detailSaveButton}
                    onClick={() => play('click')}
                    onMouseEnter={() => play('hover')}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
            <button
              className={styles.detailClose}
              onClick={() => setSelectedItem(null)}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
