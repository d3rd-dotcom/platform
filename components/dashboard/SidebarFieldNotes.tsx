'use client';

import { usePrivy } from '@privy-io/react-auth';
import DailyNotes from '@/components/daily-notes/DailyNotes';

// Sidebar entry point for the daily writing ritual on /dao. Compact mode's
// default label is "Field Notes"; clicking opens the same timed writing
// session used on /home.
export default function SidebarFieldNotes() {
  const { ready, authenticated } = usePrivy();
  return <DailyNotes enablePersistence={authenticated && ready} compact />;
}
