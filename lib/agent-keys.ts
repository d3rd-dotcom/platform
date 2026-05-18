/**
 * Agent wallet key management for custodial (platform-managed) agent accounts.
 *
 * Custodial agents have their private key generated server-side and stored
 * encrypted with AES-256-GCM. The plaintext key only ever exists in memory
 * while signing on the agent's behalf — it is never returned to a client.
 *
 * The encryption secret comes from AGENT_KEY_ENCRYPTION_SECRET. It is run
 * through SHA-256 to produce a fixed 32-byte key, so the env var can be any
 * sufficiently random string (a 32+ byte hex/base64 value is recommended).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedKey {
  encryptedKey: string; // base64 ciphertext
  iv: string;           // base64 12-byte nonce
  authTag: string;      // base64 GCM auth tag
}

function getEncryptionKey(): Buffer {
  const secret = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AGENT_KEY_ENCRYPTION_SECRET is not set (or too short). It is required to register custodial agents.'
    );
  }
  return createHash('sha256').update(secret).digest();
}

/** Generates a fresh EVM keypair for a new custodial agent. */
export function generateAgentWallet(): { address: string; privateKey: `0x${string}` } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address.toLowerCase(), privateKey };
}

/** Encrypts an agent private key for storage in agent_wallet_keys. */
export function encryptAgentKey(privateKey: string): EncryptedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  return {
    encryptedKey: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

/** Decrypts a stored agent private key. Throws if the secret is wrong or data is tampered. */
export function decryptAgentKey(record: EncryptedKey): `0x${string}` {
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedKey, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8') as `0x${string}`;
}

/**
 * Signs the standard Mental Wealth Academy sign-in message with a custodial
 * agent's key and returns an `address:signature:timestamp` Bearer token,
 * matching the format verified by getWalletAddressFromRequest().
 */
export async function signAgentSignInToken(
  privateKey: `0x${string}`
): Promise<{ token: string; timestamp: number; expiresAt: number }> {
  const account = privateKeyToAccount(privateKey);
  const address = account.address.toLowerCase();
  const timestamp = Date.now();
  const message = `Sign in to Mental Wealth Academy\n\nWallet: ${address}\nTimestamp: ${timestamp}`;
  const signature = await account.signMessage({ message });
  return {
    token: `${address}:${signature}:${timestamp}`,
    timestamp,
    expiresAt: timestamp + 5 * 60 * 1000,
  };
}
