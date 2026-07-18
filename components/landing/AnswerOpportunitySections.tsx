import styles from './AnswerOpportunitySections.module.css';

type CommunityIconName = 'path' | 'assignment' | 'peers' | 'progress';

function CommunityIcon({ name }: { name: CommunityIconName }) {
  if (name === 'path') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.blurbIcon}>
        <path d="M3 4.75A2.75 2.75 0 0 1 5.75 2H11v17.2c-1.15-.8-2.53-1.2-4.13-1.2H3V4.75Zm18 0A2.75 2.75 0 0 0 18.25 2H13v17.2c1.15-.8 2.53-1.2 4.13-1.2H21V4.75ZM5 20h2.1c1.5 0 2.77.67 3.9 2H5a2 2 0 0 1-2-2h2Zm14 0h-2.1c-1.5 0-2.77.67-3.9 2h6a2 2 0 0 0 2-2h-2Z" />
      </svg>
    );
  }

  if (name === 'assignment') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.blurbIcon}>
        <path d="M9 2h6a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2Zm0 4h6V4H9v2Zm8.7 4.3a1 1 0 0 0-1.4 0L11 15.58l-2.3-2.29a1 1 0 1 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l6-6a1 1 0 0 0 0-1.42Z" />
      </svg>
    );
  }

  if (name === 'peers') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.blurbIcon}>
        <path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM15.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM1 19a6.5 6.5 0 0 1 13 0v2H3a2 2 0 0 1-2-2Zm14.7-5.84A6.43 6.43 0 0 1 17 17v4h4a2 2 0 0 0 2-2 6 6 0 0 0-7.3-5.84Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.blurbIcon}>
      <path d="M3 17h4v4H3v-4Zm7-6h4v10h-4V11Zm7-8h4v18h-4V3Z" />
      <path d="M4.7 13.7a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0l2.4 2.4 4.8-4.8a1 1 0 1 1 1.4 1.4l-5.5 5.5a1 1 0 0 1-1.4 0l-2.4-2.4-4.3 4.3a1 1 0 0 1-1.4 0Z" />
    </svg>
  );
}

const communityBlurbs: Array<{ label: string; icon: CommunityIconName }> = [
  { label: 'Paths that start where you are', icon: 'path' },
  { label: 'Assignments with same-day payoff', icon: 'assignment' },
  { label: 'Peers who read your work', icon: 'peers' },
  { label: 'Progress you can watch compound', icon: 'progress' },
];

const cohortPrinciples = [
  {
    title: 'Shared direction',
    body: 'Everyone climbs toward the same objective, with milestones that keep the route visible. Momentum is easier to keep when it belongs to a group.',
  },
  {
    title: 'Your own work',
    body: 'You complete each mission yourself and explain it in your own words. That is how a reader becomes someone worth reading.',
  },
  {
    title: 'Real exchange',
    body: 'Teach-backs, discussion, and honest feedback at set points along the way. Explaining an idea once teaches you twice.',
  },
  {
    title: 'Visible progress',
    body: 'You watch the map fill in: what is done, what comes next, and where your attention counts most.',
  },
];

const compactItems = [
  ['Objective', 'Where the cohort is headed and the milestones along the way.'],
  ['Schedule', 'When you meet, what showing up looks like, and how to catch up.'],
  ['Contribution', 'The work you agree to bring, written in your own words.'],
  ['Feedback', 'Specific, useful, and kind. That is the bar.'],
  ['Privacy', 'What people share inside the cohort stays inside the cohort.'],
  ['Facilitation', 'Who keeps things on course, and who to talk to if something feels off.'],
];

export function CommunityEducationSection() {
  return (
    <section
      id="community-education"
      className={`${styles.section} ${styles.communitySection}`}
      aria-labelledby="community-education-heading"
    >
      <div className={styles.container}>
        <p className={styles.eyebrow}>Community education</p>
        <div className={styles.definitionGrid}>
          <h2 id="community-education-heading" className={styles.heading}>
            What is community education?
          </h2>
          <div className={styles.definitionCopy}>
            <p className={styles.lead}>
              Community education is learning built around the people doing it.
              At Mental Wealth Academy, that means a library the whole academy
              writes together: you study a guide, explain it in your own words,
              and your note becomes part of the map the next learner follows.
            </p>
            <ul className={styles.inlineList} aria-label="Community education features">
              {communityBlurbs.map((blurb) => (
                <li key={blurb.label}>
                  <span className={styles.blurbIconWrap}>
                    <CommunityIcon name={blurb.icon} />
                  </span>
                  <span>{blurb.label}</span>
                </li>
              ))}
            </ul>
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
      <div className={styles.container}>
        <p className={styles.eyebrow}>Collaborative learning</p>
        <h2 id="cohort-learning-heading" className={styles.heading}>
          What is a cohort-based learning experience?
        </h2>
        <p className={`${styles.lead} ${styles.centeredLead}`}>
          A cohort is a group moving through a program together: same
          milestones, same deadlines, shared momentum. At Mental Wealth Academy
          you study on your own, then bring back what you found, and every note
          you contribute makes the shared knowledge network a little smarter.
        </p>

        <div className={styles.principleGrid}>
          {cohortPrinciples.map((principle, index) => (
            <article className={styles.principleCard} key={principle.title}>
              <span className={styles.cardIndex} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>

        <details className={styles.compact}>
          <summary>Read the cohort compact</summary>
          <div className={styles.compactBody}>
            <p>
              Every cohort publishes its expectations before you join, so you
              always know what you are signing up for.
            </p>
            <dl className={styles.compactGrid}>
              {compactItems.map(([term, description]) => (
                <div className={styles.compactItem} key={term}>
                  <dt>{term}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      </div>
    </section>
  );
}

export function EducationalRoleSection() {
  return (
    <section
      id="educational-role"
      className={`${styles.section} ${styles.roleSection}`}
      aria-labelledby="educational-role-heading"
    >
      <div className={styles.roleContainer}>
        <p className={styles.eyebrow}>Study support</p>
        <h2 id="educational-role-heading" className={styles.heading}>
          What do a cohort and an AI add to studying?
        </h2>
        <p className={styles.lead}>
          Studying alone works until the week it doesn&apos;t. A cohort puts
          people around your effort: shared milestones, someone to explain your
          work to, and proof that you showed up. Blue reads your field notes,
          remembers where you left off, and drafts the next mission from what
          you were already curious about.
        </p>
        <p className={styles.roleNote}>
          The result is a study practice that keeps moving. The cohort holds
          the schedule, Blue holds the thread, and you do the thinking.
        </p>
      </div>
    </section>
  );
}
