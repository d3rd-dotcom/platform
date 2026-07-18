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
  { label: 'Accessible learning paths', icon: 'path' },
  { label: 'Practical assignments', icon: 'assignment' },
  { label: 'Peer discussion and feedback', icon: 'peers' },
  { label: 'Progress into advanced topics', icon: 'progress' },
];

const cohortPrinciples = [
  {
    title: 'Shared direction',
    body: 'Participants work toward a defined learning objective with milestones that make the route visible.',
  },
  {
    title: 'Individual contribution',
    body: 'Each person completes and explains their own work, so participation has a clear purpose.',
  },
  {
    title: 'Structured exchange',
    body: 'Discussion, teach-backs, and feedback happen at planned points in the learning experience.',
  },
  {
    title: 'Visible progress',
    body: 'The cohort can see what has been completed, what comes next, and where more attention is useful.',
  },
];

const compactItems = [
  ['Objective', 'The outcome and shared milestones for the cohort.'],
  ['Schedule', 'Dates, attendance expectations, and catch-up options.'],
  ['Contribution', 'The individual work each participant agrees to complete.'],
  ['Feedback', 'Standards for useful, specific, and respectful responses.'],
  ['Privacy', 'How participants are expected to handle what others share.'],
  ['Facilitation', 'The facilitator’s role and the route for participation concerns.'],
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
              Community education is learning organized around the needs and
              experiences of a shared community. Mental Wealth Academy combines
              structured guides, practical assignments, peer discussion, and
              pathways into deeper study.
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
          A cohort-based learning experience brings a group through a program
          using shared milestones, discussion, feedback, and peer accountability.
          At Mental Wealth Academy, participants study independently and
          contribute what they learn to a shared knowledge network.
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
              Every cohort publishes its operating expectations before enrollment
              so participants can make an informed choice.
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
        <p className={styles.eyebrow}>Educational role</p>
        <h2 id="educational-role-heading" className={styles.heading}>
          How is MWA different from group therapy?
        </h2>
        <p className={styles.lead}>
          Mental Wealth Academy provides education, structured reflection, and
          peer learning. Group therapy is clinical treatment delivered by
          qualified mental health professionals. Diagnosis and treatment belong
          with an appropriate licensed provider.
        </p>
        <p className={styles.roleNote}>
          MWA may complement someone&apos;s wider learning or wellbeing practices.
          It does not provide clinical assessment, diagnosis, or treatment.
        </p>
      </div>
    </section>
  );
}
