import { walletHoldsAcademicAngel } from './academic-angels';
import { walletHasMembershipAccess } from './membership-access';

export type TokenGate = 'academic_angel' | 'vip_membership' | '';

const GATE_CHECKERS: Record<string, (wallet: string) => Promise<boolean>> = {
  academic_angel: walletHoldsAcademicAngel,
  vip_membership: walletHasMembershipAccess,
};

export function parseTokenGate(value: string): TokenGate {
  if (value === 'academic_angel' || value === 'vip_membership') return value;
  return '';
}

export async function checkCourseAccess(
  tokenGate: string,
  wallet: string | null | undefined,
): Promise<{ granted: boolean; gate: TokenGate }> {
  const gate = parseTokenGate(tokenGate);
  // An empty gate is public. A non-empty value outside the allow-list is a
  // configuration error and must never make a protected course public.
  if (!gate) return { granted: tokenGate === '', gate: '' };

  if (!wallet) return { granted: false, gate };

  const checker = GATE_CHECKERS[gate];
  if (!checker) return { granted: false, gate };

  const granted = await checker(wallet);
  return { granted, gate };
}
