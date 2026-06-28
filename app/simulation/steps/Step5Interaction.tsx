'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import * as api from '@/lib/simulation-api';
import type { AgentProfile } from '@/lib/simulation-api';
import {
  fetchSimulationData,
  saveTransferPayload,
} from '@/lib/simulation-to-research';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import type { WorkflowState } from '../SimulationWorkspace';
import AgentAvatar from '../AgentAvatar';
import styles from '../simulation.module.css';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export default function Step5Interaction({ wf }: { wf: WorkflowState }) {
  const router = useRouter();
  const { play } = useSound();
  const simId = wf.simulationId as string;
  const [mode, setMode] = useState<'report' | 'agent'>('report');
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [target, setTarget] = useState<AgentProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetId = target ? agentId(target) : undefined;

  useEffect(() => {
    api
      .getSimulationProfiles(simId, 'reddit')
      .then((res) => {
        const list = res.data?.profiles ?? [];
        if (list.length) {
          setProfiles(list);
          setTarget(list[0]);
        }
      })
      .catch(() => {});
  }, [simId]);

  useEffect(() => {
    setMessages([]);
  }, [mode, targetId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    play('click');
    setError(null);
    setInput('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setBusy(true);
    try {
      let reply = '';
      if (mode === 'report') {
        const res = await api.chatWithReport({
          simulation_id: simId,
          message: text,
          chat_history: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        reply = res.data?.response || '';
      } else if (target) {
        const res = await api.interviewAgents({
          simulation_id: simId,
          interviews: [{ agent_id: agentId(target) ?? 0, prompt: text }],
          // The selected cards are Reddit profiles. Querying both platform
          // personas doubles work and can outlive the 60-second proxy route.
          platform: 'reddit',
          timeout: 45,
          // Interactive chat uses the lightweight interview model rather than
          // executing another action in the already-running simulation model.
          use_interview_model: true,
        });
        const results = res.data?.result?.results || {};
        const first = Object.values(results)[0];
        reply = first?.response || 'No response.';
      }
      setMessages([...next, { role: 'assistant', content: reply || 'No response.' }]);
    } catch (e) {
      play('error');
      setError(e instanceof Error ? e.message : 'Message failed');
    } finally {
      setBusy(false);
    }
  };

  const transferToResearch = async () => {
    play('click');
    setTransferring(true);
    setError(null);
    try {
      const payload = await fetchSimulationData(
        wf.project.project_id,
        wf.graphId!,
        simId,
        wf.project.name,
      );
      saveTransferPayload(payload);
      router.push('/research');
    } catch (e) {
      play('error');
      setError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.simHeader}>
        <div>
          <h2 className={styles.panelTitle}><span className={styles.titleJa}>対話</span>Interaction</h2>
          <p className={styles.panelLead}>
            Question the world. Ask the Report Agent about emergent dynamics, or interview any agent
            directly about what they did and why.
          </p>
        </div>
        <div className={styles.simControls}>
          <button
            className={styles.secondaryBtn}
            onClick={transferToResearch}
            onMouseEnter={() => play('hover')}
            disabled={transferring}
          >
            {transferring ? 'Transferring…' : 'Transfer to R-Tool'}
          </button>
        </div>
      </div>

      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${mode === 'report' ? styles.modeBtnActive : ''}`}
          onClick={() => {
            play('click');
            setMode('report');
          }}
          onMouseEnter={() => play('hover')}
        >
          Report Agent
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'agent' ? styles.modeBtnActive : ''}`}
          onClick={() => {
            play('click');
            setMode('agent');
          }}
          onMouseEnter={() => play('hover')}
        >
          Interview an agent
        </button>
      </div>

      {mode === 'agent' && profiles.length > 0 && (
        <div className={styles.agentPicker}>
          {profiles.slice(0, 40).map((p, i) => {
            const aid = agentId(p) ?? i;
            return (
              <button
                key={aid}
                className={`${styles.agentPick} ${target && agentId(target) === agentId(p) ? styles.agentPickActive : ''}`}
                onClick={() => {
                  play('click');
                  setTarget(p);
                }}
                onMouseEnter={() => play('hover')}
                title={p.name || p.username || `Agent ${aid}`}
              >
                <AgentAvatar id={aid} size={32} />
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.chatWindow} ref={scrollRef}>
        {messages.length === 0 && (
          <p className={styles.muted}>
            {mode === 'report'
              ? 'Ask about trends, factions, turning points, or your prediction.'
              : target
                ? `Interview ${target.name || target.username || `Agent ${agentId(target)}`}.`
                : 'No agents available to interview.'}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`${styles.chatRow} ${m.role === 'user' ? styles.chatRowUser : ''}`}>
            {m.role === 'assistant' && mode === 'agent' && target && (
              <AgentAvatar id={agentId(target) ?? 0} size={30} />
            )}
            <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {busy && <p className={styles.muted}>Thinking…</p>}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.chatInputRow}>
        <input
          className={styles.input}
          value={input}
          placeholder={mode === 'report' ? 'Ask the Report Agent…' : 'Ask this agent…'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={busy || (mode === 'agent' && !target)}
        />
        <Button
          size="compact"
          onClick={send}
          onMouseEnter={() => play('hover')}
          disabled={busy || !input.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

// Backend identifies agents by `user_id`; fall back to `agent_id` if present.
function agentId(p: AgentProfile): string | number | undefined {
  return p.user_id ?? p.agent_id;
}
