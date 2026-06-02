/**
 * Shared catalog of the events shown on /home.
 *
 * This is the single source of truth for event data: the Dashboard renders from
 * it, and the reminder cron (app/api/events/reminders) reads the same list to
 * decide which events are coming up. Keep `startsAt` as an ISO-8601 UTC string
 * so the cron can compare it against the clock; `dateLabel`/`timeLabel` are the
 * human-friendly strings shown in the card.
 *
 * An item with an `href` (e.g. the course) is a link, not a registerable event —
 * registration only applies to items that have a real `startsAt` and no `href`.
 */
export interface EventItem {
  id: string;
  /**
   * CSS background for the card header — a noisy mesh gradient (MagicPattern
   * style). The grain itself is an SVG overlay applied in CSS (.eventNoise);
   * this just sets the colour mesh, one per event.
   */
  gradient: string;
  heading: string;
  category: string;
  /** ISO-8601 UTC start time, or null for evergreen/link items. */
  startsAt: string | null;
  dateLabel: string;
  timeLabel: string;
  description: string;
  /** Link-style item (opens a page) instead of a register button. */
  href?: string;
  ctaLabel?: string;
  /**
   * Action-style item: the button triggers a one-off action instead of an RSVP.
   * 'email-test' fires an instant "hello from Blue" email — a live prod check
   * that our email pipeline reaches the user's inbox.
   */
  action?: 'email-test';
  actionLabel?: string;
  /** Where it happens — included in the reminder email. */
  location?: string;
}

export const PATHWAY_EVENT_ID = 'ethereal-pathway';

export const EVENTS: EventItem[] = [
  {
    id: PATHWAY_EVENT_ID,
    gradient:
      'radial-gradient(at 18% 22%, #6f8bff 0px, transparent 55%), radial-gradient(at 82% 8%, #a98bff 0px, transparent 50%), radial-gradient(at 50% 100%, #4150c8 0px, transparent 55%), linear-gradient(135deg, #5168ff, #3a2f8f)',
    heading: 'Ethereal Pathway',
    category: 'Course',
    startsAt: null,
    dateLabel: 'Season 1',
    timeLabel: 'May 5 - Aug 16',
    description:
      'Follow the 12-week course through readings and missions. Complete each week to unlock the next step.',
    href: '/course',
    ctaLabel: 'Start course',
  },
  {
    id: 'crypto-tutorial',
    gradient:
      'radial-gradient(at 16% 20%, #4fd4d4 0px, transparent 55%), radial-gradient(at 86% 12%, #5fa8ff 0px, transparent 50%), radial-gradient(at 60% 100%, #2f7fe0 0px, transparent 55%), linear-gradient(135deg, #2bb3c9, #3a5bd0)',
    heading: 'Crypto Tutorial',
    category: 'Workshop',
    // Thursday, June 4, 2026 — 4:00 PM EST (UTC-5).
    startsAt: '2026-06-04T21:00:00Z',
    dateLabel: 'Thursday, June 4',
    timeLabel: '4:00 PM EST',
    description:
      'A hands-on walkthrough of wallets, gas, and your first onchain transaction — get set up safely and learn the ropes alongside the cohort.',
  },
  {
    id: 'cohort-campfire',
    gradient:
      'radial-gradient(at 18% 18%, #ffb15b 0px, transparent 55%), radial-gradient(at 84% 16%, #ff6f91 0px, transparent 50%), radial-gradient(at 55% 100%, #e85d3a 0px, transparent 55%), linear-gradient(135deg, #ff9a5b, #e0492f)',
    heading: 'Cohort Campfire Check-in',
    category: 'Community',
    // Friday, June 5, 2026 — 7:00 PM EST (UTC-5).
    startsAt: '2026-06-06T00:00:00Z',
    dateLabel: 'Friday, June 5',
    timeLabel: '7:00 PM EST',
    description:
      'An informal end-of-week gathering to share wins, blockers, and what the next week looks like.',
  },
  {
    id: 'meet-blue',
    gradient:
      'radial-gradient(at 20% 22%, #6fe3df 0px, transparent 55%), radial-gradient(at 82% 10%, #b39bff 0px, transparent 50%), radial-gradient(at 50% 100%, #5168ff 0px, transparent 55%), linear-gradient(135deg, #58d0d0, #7d6bf0)',
    heading: 'Meet Blue',
    category: 'Introduction',
    startsAt: null,
    dateLabel: 'Anytime',
    timeLabel: 'Instant email',
    description:
      'Say hello to Blue, your guide. Get an instant intro email — and a quick check that our reminders land in your inbox.',
    action: 'email-test',
    actionLabel: 'Say hello',
  },
];

const EVENTS_BY_ID = new Map(EVENTS.map((ev) => [ev.id, ev]));

export function getEventById(id: string): EventItem | undefined {
  return EVENTS_BY_ID.get(id);
}

/** An event is registerable if it has a real start time and isn't a link. */
export function isRegisterableEvent(ev: EventItem): boolean {
  return !ev.href && !!ev.startsAt;
}

/**
 * Events starting within the given window from now (default 48h). Used by the
 * reminder cron to find what's coming up. Past events and link items are
 * excluded.
 */
export function getEventsStartingWithin(windowMs = 48 * 60 * 60 * 1000, now = Date.now()): EventItem[] {
  return EVENTS.filter((ev) => {
    if (!ev.startsAt) return false;
    const start = new Date(ev.startsAt).getTime();
    return start >= now && start - now <= windowMs;
  });
}
