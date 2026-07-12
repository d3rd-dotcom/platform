import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHasMembershipAccess } from '@/lib/membership-access';

/**
 * Authenticated proxy to the Azure World simulation backend (Flask + OASIS).
 *
 * The backend runs as its own internet-facing service. Rather than letting the
 * browser hit it directly (which would leave it unauthenticated — the NFT gate
 * is client-side only and trivially bypassed by curl), every call is funneled
 * through here. This route:
 *   1. Verifies the caller is a logged-in VIP-membership-card holder — the same
 *      check the /simulation gate uses, but enforced server-side where it counts.
 *   2. Forwards the request with a shared secret the backend requires, so the
 *      backend can refuse anything that doesn't come from this proxy.
 *
 * The backend URL is read from a server-only env var (no NEXT_PUBLIC_), so it is
 * never shipped to the browser.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BACKEND = (
  process.env.SIMULATION_API_URL ||
  process.env.NEXT_PUBLIC_SIMULATION_API_URL ||
  'http://localhost:5001'
).replace(/\/$/, '');

// Local-dev escape hatch (non-production only), mirroring the client gate's
// bypass so a developer without Privy/the NFT can still exercise the flow.
const DEV_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.SIMULATION_DEV_BYPASS === 'true';

async function authorize(): Promise<NextResponse | null> {
  if (DEV_BYPASS) return null;

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const isMember = await walletHasMembershipAccess(user.walletAddress);
  if (!isMember) {
    return NextResponse.json(
      { success: false, error: 'Pro membership required.' },
      { status: 403 },
    );
  }
  return null;
}

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  // The backend health endpoint is public and contains no user data. Keep it
  // outside the membership gate so the UI reports connectivity, not auth state.
  const isPublicHealthCheck =
    request.method === 'GET' && path.length === 1 && path[0] === 'health';
  if (!isPublicHealthCheck) {
    const denied = await authorize();
    if (denied) return denied;
  }

  const target = `${BACKEND}/${path.join('/')}${request.nextUrl.search}`;

  // Build a clean header set — never pass the user's cookies/Authorization on to
  // the backend. The backend trusts only the shared secret.
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const secret = process.env.SIMULATION_API_SECRET;
  if (secret) headers.set('x-simulation-secret', secret);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  // Read the raw bytes so multipart uploads (with their boundary) pass through
  // intact alongside the original content-type header.
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  let res: Response;
  try {
    res = await fetch(target, { method: request.method, headers, body, cache: 'no-store' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Simulation backend unreachable.' },
      { status: 502 },
    );
  }

  const resContentType = res.headers.get('content-type');
  if (!isPublicHealthCheck && !resContentType?.toLowerCase().includes('application/json')) {
    console.error('[Simulation Proxy] Backend API returned a non-JSON response', {
      path: `/${path.join('/')}`,
      status: res.status,
      contentType: resContentType,
    });
    return NextResponse.json(
      {
        success: false,
        error:
          'Simulation service returned an unexpected response. Check SIMULATION_API_URL and the backend deployment.',
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  if (resContentType) outHeaders.set('content-type', resContentType);
  outHeaders.set('cache-control', 'no-store');
  const buf = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buf, { status: res.status, headers: outHeaders });
}

type Ctx = { params: { path?: string[] } };

export const GET = (req: NextRequest, { params }: Ctx) => forward(req, params.path ?? []);
export const POST = (req: NextRequest, { params }: Ctx) => forward(req, params.path ?? []);
export const PUT = (req: NextRequest, { params }: Ctx) => forward(req, params.path ?? []);
export const PATCH = (req: NextRequest, { params }: Ctx) => forward(req, params.path ?? []);
export const DELETE = (req: NextRequest, { params }: Ctx) => forward(req, params.path ?? []);
