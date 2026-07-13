'use client';

import { Web3Provider } from '@/components/web3/Web3Provider';
import { MembershipSection } from './MembershipSection';

/**
 * The public landing route does not use the authenticated app shell. Scope the
 * wallet provider to the purchase section so Privy is available when a visitor
 * starts checkout without delaying the landing page's initial render.
 */
export function LandingMembershipSection() {
  return (
    <Web3Provider>
      <MembershipSection />
    </Web3Provider>
  );
}
