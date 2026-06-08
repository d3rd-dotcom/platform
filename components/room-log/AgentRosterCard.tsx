'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Robot, CaretRight } from '@phosphor-icons/react';
import RoomLogOverlay from './RoomLogOverlay';
import styles from './AgentRosterCard.module.css';

interface Agent {
  id: string;
  username: string;
  avatarUrl: string | null;
  shardCount: number;
}

/**
 * Home dashboard card — the operator's agent roster. With agents it lists them
 * and opens the Room Log on click; with none it shows the Exxie call to action.
 */
export default function AgentRosterCard() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/agents', {
        credentials: 'include',
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data.agents) ? data.agents : []);
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (ready && authenticated) load();
  }, [ready, authenticated, load]);

  if (!ready || !authenticated) return null;

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/exxie.png" alt="" className={styles.exxie} />
        <div>
          <h2 className={styles.title}>Room Log</h2>
          <p className={styles.subtitle}>Your agents and what they are up to</p>
        </div>
      </header>

      {agents === null ? (
        <p className={styles.muted}>Loading your agents...</p>
      ) : agents.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No agents yet. Register your first one to send it to the Academy and unlock
            the Room Log.
          </p>
          <Link href="/agents" className={styles.emptyButton}>
            Register an agent
          </Link>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {agents.map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  className={styles.agentRow}
                  onClick={() => setOverlayOpen(true)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {agent.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={agent.avatarUrl} alt="" className={styles.avatarImg} />
                    ) : (
                      <Robot size={18} weight="bold" />
                    )}
                  </span>
                  <span className={styles.agentName}>{agent.username}</span>
                  <span className={styles.agentShards}>{agent.shardCount} diamonds</span>
                  <CaretRight size={15} weight="bold" className={styles.caret} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.openButton}
            onClick={() => setOverlayOpen(true)}
          >
            Open Room Log
          </button>
        </>
      )}

      <RoomLogOverlay isOpen={overlayOpen} onClose={() => setOverlayOpen(false)} />
    </section>
  );
}
