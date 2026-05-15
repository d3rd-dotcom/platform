'use client';

import { useState } from 'react';
import styles from './FAQSection.module.css';
import { useSound } from '@/hooks/useSound';

const FAQ_ITEMS = [
  {
    question: 'What is Mental Wealth Academy?',
    answer:
      'Mental Wealth Academy is a mobile learning and research platform for mental wellness, financial literacy, and behavioral science. Members move through structured curriculum, complete assessments and surveys, work with B.L.U.E., and help produce data that can fund the community instead of being extracted by outside platforms.',
  },
  {
    question: 'How Does MWA Handle Data Gathered?',
    answer:
      'MWA treats the Academy like a live behavioral science laboratory. We clean consented survey, reflection, quest, and assessment data; protect personal-linked information (PLI); and use R-based research tools to score validated measures, check outliers, audit reliability, and improve accuracy before data enters model-training workflows. The goal is to fine-tune institutional-grade models that understand behavior, learning, resilience, and decision-making. Your contribution strengthens a proprietary research flywheel: better data creates better models, better models create better tools, and better tools return more value to members while helping build AI with a more human psychological foundation.',
  },
  {
    question: 'How do I exchange my shards for cash?',
    answer:
      'Users exchange shards for cash through our partners at Coinbase Exchange. When a redemption campaign is open, eligible shards can be converted into USDC or another supported payout asset and sent to a connected Coinbase account or compatible wallet. Redemption rates, minimum balances, availability, and identity checks may vary by campaign and partner requirements.',
  },
  {
    question: 'Who is B.L.U.E.?',
    answer:
      'B.L.U.E. stands for Behavioral Learning & Understanding Engine. She is the AI companion architecture inside MWA, built to help with reflection, assessment review, research workflows, reward decisions, and market analysis. She is not a generic chatbot pasted onto a course.',
  },
  {
    question: 'How does membership work?',
    answer:
      'Explorer members can start free with the core course, journaling, weekly quests, community access, and shard rewards. Paid members unlock governance, research tools, proposal access, and deeper B.L.U.E. features. The $90 VIP membership is the lifetime option with an on-chain membership card.',
  },
  {
    question: 'How does the 12-week course work?',
    answer:
      'The first season is organized around Security, Identity, Power, and Connection. Each module combines reading, reflection, behavioral exercises, and research-backed assessments such as WHO-5, PSS-10, GSE, and BRS so progress creates useful longitudinal signal, not just app engagement.',
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
