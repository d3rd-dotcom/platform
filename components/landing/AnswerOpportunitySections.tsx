'use client';

import Image from 'next/image';
import type { PointerEvent as ReactPointerEvent } from 'react';
import CommunityCardCarousel from './CommunityCardCarousel';
import styles from './AnswerOpportunitySections.module.css';

const cohortGroups = [
  {
    title: 'Mental Wealth Academy',
    body: 'Guides, missions, and cohort schedules create shared direction. Study independently, then return with field notes, teach-backs, and useful feedback.',
    topics: ['Connected guides', 'Practical missions', 'Peer study'],
  },
  {
    title: 'MWA Funding',
    body: 'Through Artizen, creative projects and original ideas can receive matched funding. Members share the work, gather support, and give promising concepts a practical next step.',
    topics: ['Artizen', 'Matched funding', 'Creative projects'],
  },
  {
    title: 'MWA Institute',
    body: 'Structured studies connect members with researchers, methods, and shared evidence. Field notes and experiments strengthen an archive other learners can build from.',
    topics: ['Guided studies', 'Science tools', 'Shared archive'],
  },
];

function followPointer(event: ReactPointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;

  card.style.setProperty('--pointer-x', `${(x / bounds.width) * 100}%`);
  card.style.setProperty('--pointer-y', `${(y / bounds.height) * 100}%`);
  card.style.setProperty('--card-rotate-x', `${((y / bounds.height) - 0.5) * -2.4}deg`);
  card.style.setProperty('--card-rotate-y', `${((x / bounds.width) - 0.5) * 2.4}deg`);
}

function resetPointer(event: ReactPointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  card.style.setProperty('--pointer-x', '50%');
  card.style.setProperty('--pointer-y', '50%');
  card.style.setProperty('--card-rotate-x', '0deg');
  card.style.setProperty('--card-rotate-y', '0deg');
}

export function CommunityEducationSection() {
  return (
    <section
      id="community-education"
      className={`${styles.section} ${styles.communitySection}`}
      aria-labelledby="community-education-heading"
    >
      <div className={styles.container}>
        <div className={styles.definitionGrid}>
          <div className={styles.definitionHeadingCol}>
            <h2 id="community-education-heading" className={styles.heading}>
              We give educators the tools to{' '}
              <span className={styles.headingAccent}>
                teach and measure proficiency
              </span>
              {' '}at scale
            </h2>
          </div>
          <div className={styles.definitionCopy}>
            <p className={styles.lead}>
              MWA is the infrastructure for AI-powered learning in the modern age,
              built from whatever you teach. World-building curricula. Design tests
              that increase proficiency. Social-first designs that make sure no
              student is left behind.
            </p>
            <CommunityCardCarousel />
          </div>
        </div>
      </div>
    </section>
  );
}

export function GettingStartedSection() {
  return (
    <section
      id="getting-started"
      className={`${styles.section} ${styles.communitySection}`}
      aria-labelledby="getting-started-heading"
    >
      <div className={styles.container}>
        <div className={styles.definitionGrid}>
          <div className={styles.definitionHeadingCol}>
            <h2 id="getting-started-heading" className={styles.heading}>
              We’ll help you get started
            </h2>
          </div>
          <div className={styles.definitionCopy}>
            <CommunityCardCarousel />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CohortLearningSection() {
  return (
    <section
      id="cohort-learning"
      className={`${styles.section} ${styles.cohortSection}`}
      aria-labelledby="cohort-learning-heading"
    >
      <div className={styles.cohortBackdrop} aria-hidden="true">
        <svg className={styles.orbitField} viewBox="0 0 1600 980" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="cohort-orbit-near" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.12" />
              <stop offset="0.44" stopColor="var(--color-accent)" stopOpacity="0.72" />
              <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="cohort-orbit-far" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="var(--color-action)" stopOpacity="0.22" />
              <stop offset="0.62" stopColor="var(--color-text-light)" stopOpacity="0.48" />
              <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <ellipse cx="780" cy="690" rx="970" ry="300" fill="none" stroke="url(#cohort-orbit-near)" strokeWidth="92" transform="rotate(-11 780 690)" />
          <ellipse cx="810" cy="660" rx="760" ry="218" fill="none" stroke="url(#cohort-orbit-far)" strokeWidth="48" transform="rotate(-11 810 660)" />
          <ellipse cx="820" cy="645" rx="545" ry="146" fill="none" stroke="var(--color-text-light)" strokeOpacity="0.12" strokeWidth="22" transform="rotate(-11 820 645)" />
        </svg>
        <span className={`${styles.floatShape} ${styles.shapeOne}`} />
        <span className={`${styles.floatShape} ${styles.shapeTwo}`} />
        <span className={`${styles.floatShape} ${styles.shapeThree}`} />
        <span className={`${styles.floatShape} ${styles.shapeFour}`} />
        <span className={`${styles.floatShape} ${styles.shapeFive}`} />
        <span className={`${styles.floatShape} ${styles.shapeSix}`} />
        <span className={`${styles.floatShape} ${styles.shapeSeven}`} />
        <span className={`${styles.floatShape} ${styles.shapeEight}`} />
        <span className={`${styles.floatShape} ${styles.shapeNine}`} />
      </div>

      <div className={`${styles.container} ${styles.cohortContainer}`}>
        <div className={styles.cohortIntro}>
          <h2 id="cohort-learning-heading" className={styles.heading}>
            Core Pillars of MWA
          </h2>
          <p className={`${styles.lead} ${styles.centeredLead}`}>
            A cohort moves through one program with shared milestones and
            regular exchange. At MWA, that experience spans three connected
            parts.
          </p>
        </div>

        <div className={styles.cohortCardField}>
          {cohortGroups.map((group, index) => (
            <article
              className={`${styles.cohortCard} ${[
                styles.academyCard,
                styles.fundingCard,
                styles.instituteCard,
              ][index]}`}
              key={group.title}
              onPointerMove={followPointer}
              onPointerLeave={resetPointer}
            >
              <div className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cohortMark}>
                <Image
                  src="/icons/icon-512.png"
                  alt=""
                  width={72}
                  height={72}
                  className={styles.cohortMarkImage}
                />
              </div>
              <h3>{group.title}</h3>
              <p>{group.body}</p>
              <ul className={styles.topicList} aria-label={`${group.title} topics`}>
                {group.topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
