// Keeps every surface that shows the personal course in sync, so a deleted or
// replaced course can never keep showing anywhere. A change broadcasts three
// ways and subscribers refetch on all of them:
// - same tab: a window event
// - other tabs: a localStorage write (fires their `storage` listener)
// - safety net: refetch whenever the tab regains focus or becomes visible

import { setStorageItem } from './safe-storage';

const COURSE_EVENT = 'personalCourseUpdated';
const STORAGE_KEY = 'personalCourse.rev';

/** Cache-busted URL for the personal course API — always misses HTTP caches. */
export function personalCourseUrl(): string {
  return `/api/course/personal?t=${Date.now()}`;
}

export function broadcastPersonalCourseUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COURSE_EVENT));
  setStorageItem(STORAGE_KEY, String(Date.now()));
}

/** Subscribe to course changes; returns the cleanup function. */
export function onPersonalCourseUpdated(refetch: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = () => refetch();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) refetch();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') refetch();
  };
  window.addEventListener(COURSE_EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', onEvent);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener(COURSE_EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', onEvent);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
