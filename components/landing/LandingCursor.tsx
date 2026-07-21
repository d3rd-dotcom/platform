'use client';

import { useEffect } from 'react';

// Blue replaces the system cursor across the landing page. Each state is a
// separate frame of the same portrait — only the glyph over her shoulder
// changes — so she stays still while the glyph reacts to what is under the
// pointer. Frames live in public/landing/cursor; sources are in
// design/cursor-source.
//
// Sizing: browsers ignore cursor images taller than 128px, so the frames ship
// at 86x96 with the hotspot on the arrow tip.
const HOTSPOT = '5 4';

// Surfaces that have no standard selector opt in with data-cursor="<state>".
const STATES = {
  pointer: 'default',
  hover: 'pointer',
  text: 'text',
  edit: 'text',
  target: 'grab',
  location: 'pointer',
  audio: 'pointer',
  potion: 'pointer',
  help: 'help',
  loading: 'progress',
  disabled: 'not-allowed',
  idle: 'default',
} as const;

type State = keyof typeof STATES;

const url = (state: State) =>
  `url(/landing/cursor/blue-${state}.png) ${HOTSPOT}, ${STATES[state]}`;

// Every rule below carries the same specificity, so document order decides
// which state wins: later entries override earlier ones. Keep disabled last.
const RULES: Array<[State, string]> = [
  ['hover', 'a[href], button, summary, label[for], select, [role="button"], [role="link"], [data-cursor="hover"]'],
  ['text', 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]), textarea, [contenteditable="true"], [data-cursor="text"]'],
  ['edit', '[data-cursor="edit"]'],
  ['target', '[data-cursor="grab"]'],
  ['location', '[data-cursor="location"]'],
  ['audio', '[data-cursor="audio"]'],
  ['potion', '[data-cursor="potion"]'],
  ['help', 'abbr[title], [data-cursor="help"]'],
  ['loading', '[aria-busy="true"], [data-cursor="loading"]'],
  ['disabled', ':disabled, [disabled], [aria-disabled="true"], [data-cursor="disabled"]'],
];

const IDLE_CLASS = 'blue-cursor-idle';
const IDLE_AFTER_MS = 6000;

const sheet = [
  `[data-landing-page], [data-landing-page] * { cursor: ${url('pointer')} !important; }`,
  ...RULES.map(
    ([state, selector]) =>
      `[data-landing-page] :where(${selector}) { cursor: ${url(state)} !important; }`
  ),
  // Idle outranks every state above, so Blue dozes off wherever she was left.
  `.${IDLE_CLASS} [data-landing-page], .${IDLE_CLASS} [data-landing-page] * { cursor: ${url('idle')} !important; }`,
].join('\n');

export const LandingCursor: React.FC = () => {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    // Preload so the first state change does not flash the system cursor.
    (Object.keys(STATES) as State[]).forEach((state) => {
      const img = new Image();
      img.src = `/landing/cursor/blue-${state}.png`;
    });

    const style = document.createElement('style');
    style.textContent = sheet;
    document.head.appendChild(style);

    const root = document.documentElement;
    let timer = 0;

    const wake = () => {
      root.classList.remove(IDLE_CLASS);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.classList.add(IDLE_CLASS), IDLE_AFTER_MS);
    };

    wake();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('scroll', wake, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('scroll', wake);
      root.classList.remove(IDLE_CLASS);
      style.remove();
    };
  }, []);

  return null;
};

export default LandingCursor;
