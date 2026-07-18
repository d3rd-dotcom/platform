import CommunityCardCarousel from './CommunityCardCarousel';
import styles from './AnswerOpportunitySections.module.css';

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
        <div className={styles.definitionGrid}>
          <div className={styles.definitionHeadingCol}>
            <h2 id="community-education-heading" className={styles.heading}>
              We help your{' '}
              <span className={styles.headingAccent}>
                teen learn, build confidence
              </span>
              , and keep growing
            </h2>
          </div>
          <div className={styles.definitionCopy}>
            <p className={styles.lead}>
              Whether it&apos;s paralysis from a never-ending feed,
              interpersonal connections, or a phone that eats your evenings,
              Mental Wealth Academy helps people build the lives they want to
              live. Drawing from science and the spirit of life, our tools help
              you take the next step toward better mental wealth.
            </p>
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
