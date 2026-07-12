'use client';

import { useEffect } from 'react';
import { useSound } from '@/hooks/useSound';
import type { SoundType } from '@/lib/sound-engine';

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
  'canvas',
].join(',');

const HOVER_SELECTOR = `${INTERACTIVE_SELECTOR}, article, [data-landing-sound-hover]`;

function closestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(selector) : null;
}

function belongsToLandingPage(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element?.closest('[data-landing-page]'));
}

function hasSoundDisabled(element: HTMLElement): boolean {
  return Boolean(element.closest('[data-landing-sound="off"]'));
}

function clickSoundFor(element: HTMLElement): SoundType {
  if (element instanceof HTMLAnchorElement || element.getAttribute('role') === 'link') {
    return 'click';
  }

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      return element.checked ? 'toggle-off' : 'toggle-on';
    }
    return 'click';
  }

  if (element.hasAttribute('aria-expanded')) {
    return element.getAttribute('aria-expanded') === 'true' ? 'toggle-off' : 'toggle-on';
  }

  return 'click';
}

/**
 * Adds one delegated sound layer to the landing page. Delegation means sections
 * loaded later by LandingDeferredSections receive the same sounds automatically.
 */
export function LandingSoundEffects() {
  const { play } = useSound();

  useEffect(() => {
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      const element = closestElement(event.target, HOVER_SELECTOR);
      if (!belongsToLandingPage(element) || hasSoundDisabled(element)) return;

      const previous = event.relatedTarget;
      if (previous instanceof Node && element.contains(previous)) return;

      play(element.matches(INTERACTIVE_SELECTOR) ? 'hover' : 'soft-hover');
    };

    const onPointerDown = (event: PointerEvent) => {
      const element = closestElement(event.target, INTERACTIVE_SELECTOR);
      if (!belongsToLandingPage(element) || hasSoundDisabled(element)) return;

      if (
        element.matches(':disabled') ||
        element.getAttribute('aria-disabled') === 'true'
      ) {
        play('error');
      }
    };

    const onClick = (event: MouseEvent) => {
      const element = closestElement(event.target, INTERACTIVE_SELECTOR);
      if (!belongsToLandingPage(element) || hasSoundDisabled(element)) return;
      if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return;

      play(clickSoundFor(element));
    };

    const onFocusIn = (event: FocusEvent) => {
      const element = closestElement(event.target, 'input, select, textarea');
      if (!belongsToLandingPage(element) || hasSoundDisabled(element)) return;
      play('input-focus');
    };

    const onInvalid = (event: Event) => {
      const element = closestElement(event.target, 'input, select, textarea');
      if (!belongsToLandingPage(element) || hasSoundDisabled(element)) return;
      play('error');
    };

    document.addEventListener('pointerover', onPointerOver, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('invalid', onInvalid, true);

    return () => {
      document.removeEventListener('pointerover', onPointerOver, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('invalid', onInvalid, true);
    };
  }, [play]);

  return null;
}
