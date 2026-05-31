/**
 * Pinata IPFS upload utilities.
 * Used by the certificate mint route to pin personalized images and metadata.
 */

const PINATA_API = 'https://api.pinata.cloud';

function getPinataJwt(): string {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is not set — cannot upload to IPFS.');
  return jwt;
}

/**
 * Upload a raw buffer (image) to Pinata.
 * Returns an ipfs:// URI pointing to the pinned file.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: 'image/png' }),
    filename,
  );
  form.append(
    'pinataMetadata',
    JSON.stringify({ name: filename }),
  );

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getPinataJwt()}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata image upload failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}

/**
 * Upload a metadata JSON object to Pinata.
 * Returns an ipfs:// URI pointing to the pinned JSON.
 */
export async function uploadMetadataJson(
  metadata: Record<string, unknown>,
  name: string,
): Promise<string> {
  const body = {
    pinataMetadata: { name },
    pinataContent: metadata,
  };

  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getPinataJwt()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata JSON upload failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}
