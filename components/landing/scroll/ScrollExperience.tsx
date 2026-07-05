'use client';

import { useEffect } from 'react';
import { CinematicLayer } from './CinematicLayer';

// Act tints washed over the viewport as the visitor scrolls through the story.
// Keyed by the data-act attribute on each act wrapper in LandingDeferredSections.
const ACT_TINTS: Record<string, string> = {
  hero: 'rgba(81, 104, 255, 0.06)',
  simulate: 'rgba(81, 104, 255, 0.10)',
  ecosystem: 'rgba(68, 233, 144, 0.08)',
  belonging: 'rgba(255, 119, 41, 0.07)',
  ascend: 'rgba(139, 149, 255, 0.10)',
};

export function ScrollExperience() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    if (reducedMotion) {
      // No smooth scroll, no scrubbing — reveal targets must still be visible.
      document
        .querySelectorAll<HTMLElement>('[data-reveal]')
        .forEach((el) => (el.style.opacity = '1'));
      return;
    }

    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({
        duration: 1.15,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });

      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(() => {
        // Hero: content drifts up slower than the scroll and fades as it leaves.
        const heroContent = document.querySelector('[data-hero-parallax]');
        if (heroContent) {
          gsap.to(heroContent, {
            yPercent: -18,
            autoAlpha: 0.15,
            ease: 'none',
            scrollTrigger: {
              trigger: heroContent,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
        }

        // Section reveals: rise and settle, once per element.
        document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            y: 72,
            autoAlpha: 0,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              once: true,
            },
          });
        });

        // B-roll parallax: the video pane moves slower than the band.
        document.querySelectorAll<HTMLElement>('[data-band-media]').forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: -8 },
            {
              yPercent: 8,
              ease: 'none',
              scrollTrigger: {
                trigger: el.parentElement,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            }
          );
        });

        // The single pin of the page: the final band holds for a beat.
        const pinned = document.querySelector<HTMLElement>('[data-band-pin]');
        if (pinned) {
          ScrollTrigger.create({
            trigger: pinned,
            start: 'top top',
            end: '+=45%',
            pin: true,
            pinSpacing: true,
          });
        }

        // Act tints: crossfade the cinematic layer wash per story act.
        const tintTarget = document.getElementById('cine-tint');
        const setTint = (act: string) => {
          if (tintTarget) tintTarget.style.backgroundColor = ACT_TINTS[act] ?? ACT_TINTS.hero;
        };
        setTint('hero');
        document.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
          const act = el.dataset.act ?? 'hero';
          ScrollTrigger.create({
            trigger: el,
            start: 'top 55%',
            end: 'bottom 55%',
            onToggle: (self) => {
              if (self.isActive) setTint(act);
            },
          });
        });
      });

      // Deferred sections stream in after idle; re-measure when layout grows.
      let refreshTimer: number | undefined;
      const resizeObserver = new ResizeObserver(() => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 250);
      });
      resizeObserver.observe(document.body);
      window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

      cleanup = () => {
        resizeObserver.disconnect();
        window.clearTimeout(refreshTimer);
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <CinematicLayer />;
}

export default ScrollExperience;
