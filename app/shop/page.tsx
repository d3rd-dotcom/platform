'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { Contract, providers, utils } from 'ethers';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { ShopPageSkeleton } from '@/components/skeleton/Skeleton';
import { ensureBaseChain, type Eip1193Provider } from '@/lib/ensure-base-chain';
import { fetchDiamondBalance } from '@/lib/diamonds-balance';
import { getDiamondPrice } from '@/lib/shop-catalog';
import { useSound } from '@/hooks/useSound';
import { getDiamondsTokenAddress, getRpcUrl, BURN_ADDRESS } from '@/lib/chain-config';
import styles from './page.module.css';

const DIAMONDS_TOKEN_ADDRESS = getDiamondsTokenAddress();
const ERC20_TRANSFER_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

type PayPhase = 'idle' | 'burning' | 'verifying' | 'done';

type BadgeType = 'new' | 'limited' | 'exclusive' | 'free' | 'sold-out';

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
    id: 'shirt',
    title: 'The Academy Shirt',
    sub: 'Official MWA Uniform',
    desc: 'Heavyweight cotton tee in midnight navy with the embroidered Academy crest on the chest. Boxy unisex cut, ribbed crew neck, runs true to size.',
    price: '42 USDC',
    image: 'https://i.imgur.com/S3AMvJA.png',
    category: 'Uniforms',
    badge: 'exclusive',
  },
  {
    id: 'journal',
    title: 'Magazine 01',
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
    badge: 'sold-out',
  },
  {
    id: 'pin-set',
    title: 'Scholar Pin Set',
    sub: 'Enamel × Gold, Set of 5',
    desc: 'Five hard enamel pins representing the five disciplines: Cognition, Wealth, Health, Creativity, and Sovereignty. Each features micro-engraved serial numbers. Collect all five to unlock a hidden curriculum quest.',
    price: '28 USDC',
    image: 'https://i.imgur.com/yUCxnDX.png',
    category: 'Accessories',
    badge: 'sold-out',
  },
  {
    id: 'snapback',
    title: 'MWA Snapback',
    sub: 'Six-panel, embroidered crest',
    desc: 'Structured six-panel snapback in matte black with the Academy crest embroidered on the front and a tonal woven label on the side. Flat brim, adjustable plastic closure, one-size-fits-most.',
    price: '38 USDC',
    image: '/images/shop/mwa-snapback.webp',
    category: 'Accessories',
  },
  {
    id: 'blue-world',
    title: 'Blue World Magazine',
    sub: 'Issue 01, perfect-bound',
    desc: 'The first print issue of Blue World — a 96-page magazine from inside the Academy. Field reports from Blue, essays on autonomous governance, scholar interviews, and the visual archive of Cohort 01. Printed on uncoated stock with a soft-touch cover.',
    price: '24 USDC',
    image: '/images/shop/blue-world-magazine.webp',
    category: 'Accessories',
    badge: 'new',
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
    image: '/images/shop/hd-01-focus-cans.webp',
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
    image: '/images/shop/jc-10-scholar.webp',
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
    sub: 'Shirt + Magazine + Pin Set + Keycard',
    desc: 'Everything you need to begin the cohort. The official Academy shirt, Magazine 01, full scholar pin set, and your NFC access keycard bundled at a discount.',
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
  'sold-out': 'badgeSoldOut',
};

const badgeLabel = (badge: BadgeType) => badge.replace('-', ' ');

export default function ShopPage() {
  const { play } = useSound();
  const { authenticated } = usePrivy();
  const { address, isConnected, connector } = useAccount();
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isContentLoading, setIsContentLoading] = useState(true);
  const [payItem, setPayItem] = useState<ShopItem | null>(null);
  const [payPhase, setPayPhase] = useState<PayPhase>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!payItem || !address) { setBalance(null); return; }
    let cancelled = false;
    fetchDiamondBalance(address).then((b) => { if (!cancelled) setBalance(b); });
    return () => { cancelled = true; };
  }, [payItem, address]);

  const payWithDiamonds = async (item: ShopItem) => {
    if (payPhase !== 'idle') return;
    const price = getDiamondPrice(item.id);
    if (!price) return;
    setPayError(null);
    if (!authenticated) { setPayError('Sign in to pay with diamonds.'); return; }
    if (!isConnected || !connector) { setPayError('Connect a wallet to pay with diamonds.'); return; }
    if (!DIAMONDS_TOKEN_ADDRESS) { setPayError('Diamonds token is not configured.'); return; }
    if (balance !== null && balance < price) { setPayError(`You need ${price} diamonds — you have ${balance}.`); return; }

    setPayPhase('burning');
    try {
      const eip1193 = (await connector.getProvider()) as Eip1193Provider;
      await ensureBaseChain(eip1193);
      const web3 = new providers.Web3Provider(eip1193 as providers.ExternalProvider);
      const token = new Contract(DIAMONDS_TOKEN_ADDRESS, ERC20_TRANSFER_ABI, web3.getSigner());
      const tx = await token.transfer(BURN_ADDRESS, utils.parseUnits(String(price), 18));
      await tx.wait(1);

      setPayPhase('verifying');
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, txHash: tx.hash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayError(data?.error === 'tx_already_used' ? 'That burn was already redeemed.' : 'Could not verify the burn. Try again.');
        setPayPhase('idle');
        return;
      }
      setPayPhase('done');
    } catch (err: any) {
      if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') setPayError('Payment cancelled in wallet.');
      else if (err?.code === 'INSUFFICIENT_FUNDS') setPayError('Not enough ETH on Base to cover gas.');
      else setPayError('Could not complete the payment. Try again.');
      setPayPhase('idle');
    }
  };

  const closePay = () => { if (payPhase === 'burning' || payPhase === 'verifying') return; setPayItem(null); setPayPhase('idle'); setPayError(null); };

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
          {filtered.map((item) => {
            const isSoldOut = item.badge === 'sold-out';
            return (
            <button
              key={item.id}
              type="button"
              className={styles.productCard}
              onClick={() => { if (isSoldOut) return; play('click'); setSelectedItem(item); }}
              onMouseEnter={() => { if (!isSoldOut) play('hover'); }}
              aria-disabled={isSoldOut}
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
                      {badgeLabel(item.badge)}
                    </span>
                  )}
                </span>
              </span>
            </button>
            );
          })}
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
                    {badgeLabel(selectedItem.badge)}
                  </span>
                )}
                <span className={styles.detailTitle}>{selectedItem.title}</span>
                <span className={styles.detailSub}>{selectedItem.sub}</span>
                <div className={styles.detailDivider} />
                <p className={styles.detailDesc}>{selectedItem.desc}</p>
                <span className={styles.detailPrice}>
                  {selectedItem.price}
                  {getDiamondPrice(selectedItem.id) && (
                    <span className={styles.detailPriceAlt}>or {getDiamondPrice(selectedItem.id)} diamonds</span>
                  )}
                </span>
                <div className={styles.detailActions}>
                  <button
                    className={styles.detailMintButton}
                    onClick={() => selectedItem.badge !== 'sold-out' && play('click')}
                    onMouseEnter={() => selectedItem.badge !== 'sold-out' && play('hover')}
                    disabled={selectedItem.badge === 'sold-out'}
                  >
                    {selectedItem.badge === 'sold-out' ? 'Sold Out' : 'Mint Now'}
                  </button>
                  {selectedItem.badge !== 'sold-out' && getDiamondPrice(selectedItem.id) && (
                    <button
                      className={styles.detailDiamondButton}
                      onClick={() => { play('click'); setPayError(null); setPayItem(selectedItem); setPayPhase('idle'); }}
                      onMouseEnter={() => play('hover')}
                    >
                      Pay with diamonds
                    </button>
                  )}
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

        {/* Pay with diamonds — burn confirmation */}
        {payItem && (
          <div className={styles.payOverlay} onClick={closePay}>
            <div className={styles.payDialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className={styles.payTitleBar}>
                <span className={styles.payTitleText}>pay.diamonds</span>
              </div>
              <div className={styles.payBody}>
                {payPhase === 'done' ? (
                  <>
                    <p className={styles.payMessage}>
                      Paid. Your {payItem.title} order is in — we will follow up on delivery.
                    </p>
                    <div className={styles.payButtons}>
                      <button type="button" className={styles.payBtnBurn} onClick={() => { play('click'); closePay(); setSelectedItem(null); }} onMouseEnter={() => play('hover')}>
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.payMessage}>
                      Burn {getDiamondPrice(payItem.id)} diamonds for {payItem.title}? Diamonds are spent for good.
                    </p>
                    {balance !== null && (
                      <p className={styles.payBalance}>You have {balance} diamonds.</p>
                    )}
                    {payError && <p className={styles.payErrorText} role="alert">{payError}</p>}
                    <div className={styles.payButtons}>
                      <button type="button" className={styles.payBtnCancel} onClick={() => { play('click'); closePay(); }} onMouseEnter={() => play('hover')} disabled={payPhase !== 'idle'}>
                        Cancel
                      </button>
                      <button type="button" className={styles.payBtnBurn} onClick={() => { play('click'); payWithDiamonds(payItem); }} onMouseEnter={() => play('hover')} disabled={payPhase !== 'idle'}>
                        {payPhase === 'burning' ? 'Burning…' : payPhase === 'verifying' ? 'Verifying…' : 'Pay'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
