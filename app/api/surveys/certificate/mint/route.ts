import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Contract, Wallet, providers } from 'ethers';
import { randomUUID } from 'crypto';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureSurveyCertificateMintsSchema } from '@/lib/ensureSurveyCertificateMintsSchema';
import { uploadImageBuffer, uploadMetadataJson } from '@/lib/ipfs-upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── Config ──────────────────────────────────────────────────────────────────

const PROFILE_TO_TOKEN_ID: Record<string, number> = {
  Secure:           1,
  Anxious:          2,
  Avoidant:         3,
  'Fearful-Avoidant': 4,
};

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  Secure:             'A secure attachment style reflects comfort with intimacy and confidence in relationships.',
  Anxious:            'An anxious attachment style reflects heightened sensitivity to relational cues and a deep need for closeness.',
  Avoidant:           'An avoidant attachment style reflects a preference for self-reliance and distance from emotional dependency.',
  'Fearful-Avoidant': 'A fearful-avoidant attachment style reflects both a desire for closeness and a fear of it.',
};

// ─── Certificate image generation ────────────────────────────────────────────

async function generateCertificateImage(
  profileType: string,
  username: string,
): Promise<Buffer> {
  const certPath = path.join(process.cwd(), 'public', 'certificates', `${profileType}.png`);
  const fontPath = path.join(process.cwd(), 'app', 'fonts', 'DepartureMono-Regular.otf');

  const fontBase64 = fs.readFileSync(fontPath).toString('base64');
  const certBuffer = fs.readFileSync(certPath);

  const { width = 5103, height = 3217 } = await sharp(certBuffer).metadata();

  // Escape XML entities in the username
  const safeUsername = username
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const svgOverlay = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <style>
          @font-face {
            font-family: 'Departure Mono';
            src: url('data:font/otf;base64,${fontBase64}') format('opentype');
          }
        </style>
      </defs>
      <text
        x="2552"
        y="2100"
        font-family="'Departure Mono', monospace"
        font-size="145"
        fill="#ffffff"
        text-anchor="middle"
        dominant-baseline="auto"
      >${safeUsername}</text>
    </svg>
  `;

  return sharp(certBuffer)
    .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
    .png()
    .toBuffer();
}

// ─── On-chain helpers ─────────────────────────────────────────────────────────

const CERT_ABI = [
  'function mint(address to, uint256 tokenId) external',
  'function hasMinted(address, uint256) view returns (bool)',
];

function getContractAddress(): string {
  const addr = process.env.SURVEY_CERTIFICATES_ADDRESS;
  if (!addr) throw new Error('SURVEY_CERTIFICATES_ADDRESS is not set.');
  return addr;
}

function getBlueSigner(): Wallet {
  const key = process.env.AZURA_PRIVATE_KEY;
  if (!key) throw new Error('AZURA_PRIVATE_KEY is not set.');
  const rpc = process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
  const provider = new providers.StaticJsonRpcProvider(rpc, { chainId: 8453, name: 'base' });
  return new Wallet(key.startsWith('0x') ? key : `0x${key}`, provider);
}

async function checkAlreadyMintedOnChain(wallet: string, tokenId: number): Promise<boolean> {
  try {
    const signer = getBlueSigner();
    const contract = new Contract(getContractAddress(), CERT_ABI, signer);
    return await contract.hasMinted(wallet, tokenId);
  } catch {
    return false;
  }
}

async function mintOnChain(to: string, tokenId: number): Promise<string> {
  const signer = getBlueSigner();
  const contract = new Contract(getContractAddress(), CERT_ABI, signer);
  const tx = await contract.mint(to, tokenId);
  const receipt = await tx.wait();
  return receipt.transactionHash as string;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    profileType?: string;
    walletAddress?: string;
  };

  const { profileType, walletAddress } = body;

  if (!profileType || !PROFILE_TO_TOKEN_ID[profileType]) {
    return NextResponse.json({ error: 'Invalid profileType.' }, { status: 400 });
  }

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: 'Invalid walletAddress.' }, { status: 400 });
  }

  // Wallet must belong to the authenticated user
  if (walletAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
    return NextResponse.json({ error: 'Wallet does not match authenticated user.' }, { status: 403 });
  }

  const tokenId = PROFILE_TO_TOKEN_ID[profileType];
  const surveyId = 'attachment-style';

  await ensureSurveyCertificateMintsSchema();

  // ── Idempotency: return existing mint if already done ──
  const existing = await sqlQuery<Array<{ tx_hash: string | null; image_uri: string | null; metadata_uri: string | null; status: string }>>(
    `SELECT tx_hash, image_uri, metadata_uri, status
     FROM survey_certificate_mints
     WHERE user_id = :userId AND survey_id = :surveyId
     LIMIT 1`,
    { userId: user.id, surveyId },
  );

  if (existing.length > 0 && existing[0].status === 'minted') {
    return NextResponse.json({
      success: true,
      alreadyMinted: true,
      txHash: existing[0].tx_hash,
      imageUri: existing[0].image_uri,
      metadataUri: existing[0].metadata_uri,
    });
  }

  // ── On-chain double-mint guard ──
  const alreadyOnChain = await checkAlreadyMintedOnChain(walletAddress, tokenId);
  if (alreadyOnChain) {
    return NextResponse.json({ error: 'This wallet already holds this certificate.' }, { status: 409 });
  }

  // ── Reserve a pending row (unique constraint blocks concurrent races) ──
  const mintId = randomUUID();
  try {
    await sqlQuery(
      `INSERT INTO survey_certificate_mints (id, user_id, survey_id, token_id, wallet, status)
       VALUES (:id, :userId, :surveyId, :tokenId, :wallet, 'pending')`,
      { id: mintId, userId: user.id, surveyId, tokenId, wallet: walletAddress },
    );
  } catch {
    // Duplicate — another request is already processing this mint
    return NextResponse.json({ error: 'Mint already in progress. Try again shortly.' }, { status: 409 });
  }

  try {
    // ── Generate personalized image ──
    const imageBuffer = await generateCertificateImage(profileType, user.username);
    const filename = `mwa-cert-${profileType.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id}.png`;

    // ── Upload image to IPFS ──
    const imageUri = await uploadImageBuffer(imageBuffer, filename);

    // ── Build and upload metadata ──
    const metadata = {
      name: `MWA — ${profileType} Attachment`,
      description: PROFILE_DESCRIPTIONS[profileType],
      image: imageUri,
      attributes: [
        { trait_type: 'Attachment Style', value: profileType },
        { trait_type: 'Survey',           value: 'Attachment Style' },
        { trait_type: 'Recipient',        value: user.username },
        { trait_type: 'Platform',         value: 'Mental Wealth Academy' },
      ],
    };
    const metadataUri = await uploadMetadataJson(metadata, filename.replace('.png', '.json'));

    // ── Mint on-chain ──
    const txHash = await mintOnChain(walletAddress, tokenId);

    // ── Record success ──
    await sqlQuery(
      `UPDATE survey_certificate_mints
       SET image_uri = :imageUri, metadata_uri = :metadataUri, tx_hash = :txHash, status = 'minted'
       WHERE id = :mintId`,
      { imageUri, metadataUri, txHash, mintId },
    );

    console.log(`[CERT-MINT] Minted ${profileType} cert for ${user.username} (${walletAddress}). TX: ${txHash}`);

    return NextResponse.json({ success: true, txHash, imageUri, metadataUri });

  } catch (err) {
    // Mark as failed so the unique constraint row doesn't block retries
    await sqlQuery(
      `UPDATE survey_certificate_mints SET status = 'failed' WHERE id = :mintId`,
      { mintId },
    ).catch(() => {});

    // Also delete so they can retry (failed rows would block the unique constraint)
    await sqlQuery(
      `DELETE FROM survey_certificate_mints WHERE id = :mintId AND status = 'failed'`,
      { mintId },
    ).catch(() => {});

    console.error('[CERT-MINT] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Mint failed. Please try again.' },
      { status: 500 },
    );
  }
}
