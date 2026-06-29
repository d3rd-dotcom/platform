import { walletHoldsAcademicAngel } from './academic-angels';

export type TokenGate = 'academic_angel' | 'vip_membership' | '';

const GATE_CHECKERS: Record<string, (wallet: string) => Promise<boolean>> = {
  academic_angel: walletHoldsAcademicAngel,
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
  if (!gate) return { granted: true, gate: '' };

  if (!wallet) return { granted: false, gate };

  const checker = GATE_CHECKERS[gate];
  if (!checker) return { granted: false, gate };

  const granted = await checker(wallet);
  return { granted, gate };
}
