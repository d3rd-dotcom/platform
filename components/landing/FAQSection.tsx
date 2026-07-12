'use client';

import { useState } from 'react';
import styles from './FAQSection.module.css';
import { useSound } from '@/hooks/useSound';

const FAQ_ITEMS = [
  {
    question: 'What is Mental Wealth Academy?',
    answer:
      'A gameworld built on behavioral psychology, with Blue as your reviewer and reward-keeper. Knowledge is structured in levels, so you level up instead of grinding through tutorial hell. Every topic has one verified guide — level-gated, with no duplicate tutorials to sort through.',
  },
  {
    question: 'How does MWA handle the data gathered?',
    answer:
      'MWA runs like a live behavioral science laboratory. We clean consented survey, reflection, quest, and assessment data, protect personally linked information, and score validated measures before anything enters a model-training workflow. Better data builds better tools, and better tools return more value to members.',
  },
  {
    question: 'How do I exchange my Diamonds for cash?',
    answer:
      'During an open redemption campaign, Diamonds convert to USDC through Coinbase and land in a connected account or compatible wallet. Rates, minimum balances, and identity checks can vary by campaign.',
  },
  {
    question: 'Who is Blue?',
    answer:
      'Blue is an agentic smart contract with memory. She reviews your submissions, requests a revision when one is needed, approves the work that\'s ready, and pays your reward straight from her own wallet — she holds 20% of the $BLUE supply.',
  },
  {
    question: 'How does membership work?',
    answer:
      'Every course is free, no matter your membership. Member access is $20 per month. The $888 VIP membership is a one-time, lifetime option with an onchain membership card on Base. Both unlock research tools and deeper Blue features.',
  },
  {
    question: 'How does the 12-week course work?',
    answer:
      'The first season is organized around Security, Identity, Power, and Connection. Each module pairs reading and reflection with research-backed assessments — WHO-5, PSS-10, GSE, and BRS — so your progress means something real.',
  },
];

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`${styles.faqChevron} ${open ? styles.faqChevronOpen : ''}`}
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 7.5L10 12.5L15 7.5" />
  </svg>
);

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { play } = useSound();

  const toggle = (index: number) => {
    const willOpen = openIndex !== index;
    play(willOpen ? 'toggle-on' : 'toggle-off');
    setOpenIndex(willOpen ? index : null);
  };

  return (
    <section id="faqs" className={styles.faqSection}>
      <div className={styles.faqContainer}>
        <p className={styles.faqEyebrow}>FAQ</p>
        <h2 className={styles.faqTitle}>Frequently asked questions</h2>
        <ul className={styles.faqList}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <li key={i} className={styles.faqItem}>
                <button
                  className={styles.faqQuestion}
                  onClick={() => toggle(i)}
                  onMouseEnter={() => play('hover')}
                  aria-expanded={isOpen}
                  type="button"
                >
                  <span className={styles.faqQuestionText}>{item.question}</span>
                  <ChevronIcon open={isOpen} />
                </button>
                <div
                  className={`${styles.faqAnswer} ${isOpen ? styles.faqAnswerOpen : ''}`}
                >
                  <div className={styles.faqAnswerInner}>
                    <p className={styles.faqAnswerText}>{item.answer}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          className={styles.scrollToTop}
          onClick={() => {
            play('click');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onMouseEnter={() => play('hover')}
          aria-label="Scroll to top"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 16V4" />
            <path d="M4 10L10 4L16 10" />
          </svg>
          <span>Back to top</span>
        </button>
      </div>
    </section>
  );
};
