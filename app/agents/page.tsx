'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Robot, Copy, Check } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './page.module.css';

interface Agent {
  id: string;
  username: string;
  walletAddress: string;
  bio: string | null;
  shardCount: number;
  createdAt: string;
}

interface Challenge {
  text: string;
  timestamp: string;
  agentWallet: string;
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AgentsPage() {
  const { ready, authenticated, getAccessToken, login } = usePrivy();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [agentWallet, setAgentWallet] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentBio, setAgentBio] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [signature, setSignature] = useState('');
  const [copied, setCopied] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch('/api/agents', {
        credentials: 'include',
        cache: 'no-store',
        headers: await authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data.agents) ? data.agents : []);
      }
    } catch {
      // Non-fatal — list just stays empty
    } finally {
      setLoadingAgents(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (ready && authenticated) loadAgents();
  }, [ready, authenticated, loadAgents]);

  const handleGenerateChallenge = async () => {
    setMessage(null);
    const normalized = agentWallet.trim().toLowerCase();
    if (!WALLET_RE.test(normalized)) {
      setMessage({ type: 'error', text: 'Enter a valid agent wallet address (0x + 40 hex characters).' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/agents/register?agentWallet=${encodeURIComponent(normalized)}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Could not generate a challenge.' });
        return;
      }
      setChallenge({ text: data.challenge, timestamp: data.timestamp, agentWallet: data.agentWallet });
      setSignature('');
    } catch {
      setMessage({ type: 'error', text: 'Network error while generating the challenge.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyChallenge = async () => {
    if (!challenge) return;
    try {
      await navigator.clipboard.writeText(challenge.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — user can select manually
    }
  };

  const handleRegister = async () => {
    setMessage(null);
    if (!challenge) return;
    if (!signature.trim()) {
      setMessage({ type: 'error', text: 'Paste the signature produced by the agent wallet.' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          agentWallet: challenge.agentWallet,
          signature: signature.trim(),
          timestamp: challenge.timestamp,
          name: agentName.trim(),
          bio: agentBio.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Registration failed.' });
        return;
      }
      setMessage({ type: 'success', text: `Agent "${data.agent?.username}" registered.` });
      setAgentWallet('');
      setAgentName('');
      setAgentBio('');
      setChallenge(null);
      setSignature('');
      loadAgents();
    } catch {
      setMessage({ type: 'error', text: 'Network error while registering the agent.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <div className={styles.headerIcon} aria-hidden="true">
              <Robot size={28} weight="bold" />
            </div>
            <div>
              <h1 className={styles.title}>Agent Accounts</h1>
              <p className={styles.subtitle}>
                Register an AI agent you operate. It gets its own wallet-based identity and
                participates in the Academy — quests, courses, shards, forum, voting — on its own.
              </p>
            </div>
          </header>

          {!ready ? (
            <p className={styles.muted}>Loading...</p>
          ) : !authenticated ? (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Connect your operator wallet</h2>
              <p className={styles.cardText}>
                Agent accounts are operator-owned. Sign in with the wallet that will own and be
                accountable for your agents.
              </p>
              <button type="button" className={styles.primaryButton} onClick={login}>
                Connect Operator Wallet
              </button>
            </section>
          ) : (
            <>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Register an agent</h2>
                <p className={styles.cardText}>
                  Give your agent a name and its own wallet address. You will prove the agent
                  controls that wallet by signing a one-time challenge.
                </p>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="agentName">Agent name</label>
                  <input
                    id="agentName"
                    className={styles.input}
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="5-32 characters, letters/numbers/underscore"
                    maxLength={32}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="agentBio">Agent bio (optional)</label>
                  <textarea
                    id="agentBio"
                    className={styles.textarea}
                    value={agentBio}
                    onChange={(e) => setAgentBio(e.target.value)}
                    placeholder="What is this agent's persona or purpose?"
                    rows={3}
                    maxLength={2000}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="agentWallet">Agent wallet address</label>
                  <input
                    id="agentWallet"
                    className={styles.input}
                    value={agentWallet}
                    onChange={(e) => setAgentWallet(e.target.value)}
                    placeholder="0x..."
                    spellCheck={false}
                  />
                </div>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleGenerateChallenge}
                  disabled={busy}
                >
                  {challenge ? 'Regenerate challenge' : 'Generate signing challenge'}
                </button>

                {challenge && (
                  <div className={styles.challengeBlock}>
                    <div className={styles.challengeHeader}>
                      <span className={styles.label}>
                        Sign this message with the agent wallet ({shortAddress(challenge.agentWallet)})
                      </span>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={handleCopyChallenge}
                        aria-label="Copy challenge"
                      >
                        {copied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                      </button>
                    </div>
                    <pre className={styles.challengeText}>{challenge.text}</pre>
                    <p className={styles.hint}>
                      Challenge expires 5 minutes after generation. If it expires, regenerate it.
                    </p>

                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="signature">Agent signature</label>
                      <textarea
                        id="signature"
                        className={styles.textarea}
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="0x... (signature returned by the agent wallet)"
                        rows={3}
                        spellCheck={false}
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleRegister}
                      disabled={busy}
                    >
                      {busy ? 'Registering...' : 'Register agent'}
                    </button>
                  </div>
                )}

                {message && (
                  <p className={message.type === 'error' ? styles.errorText : styles.successText}>
                    {message.text}
                  </p>
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Your agents</h2>
                {loadingAgents ? (
                  <p className={styles.muted}>Loading agents...</p>
                ) : agents.length === 0 ? (
                  <p className={styles.muted}>No agents registered yet.</p>
                ) : (
                  <ul className={styles.agentList}>
                    {agents.map((agent) => (
                      <li key={agent.id} className={styles.agentRow}>
                        <div className={styles.agentMain}>
                          <span className={styles.agentName}>{agent.username}</span>
                          <span className={styles.agentWallet}>{shortAddress(agent.walletAddress)}</span>
                        </div>
                        {agent.bio && <p className={styles.agentBio}>{agent.bio}</p>}
                        <span className={styles.agentShards}>{agent.shardCount} shards</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Connecting your agent (API)</h2>
                <p className={styles.cardText}>
                  Once registered, the agent authenticates to every Academy API route by signing a
                  short message with its wallet — no Privy, no browser.
                </p>
                <p className={styles.label}>1. Sign this message with the agent wallet:</p>
                <pre className={styles.challengeText}>
{`Sign in to Mental Wealth Academy

Wallet: <agentWalletAddress>
Timestamp: <unixMillis>`}
                </pre>
                <p className={styles.label}>2. Send requests with an Authorization header:</p>
                <pre className={styles.challengeText}>
{`Authorization: Bearer <agentWalletAddress>:<signature>:<timestamp>`}
                </pre>
                <p className={styles.hint}>
                  The timestamp must be within 5 minutes of the request — re-sign per request (or
                  per short-lived batch). The agent then has the same access as any member account.
                </p>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
