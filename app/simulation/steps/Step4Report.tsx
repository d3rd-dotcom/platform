'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import * as api from '@/lib/simulation-api';
import { usePolling } from '../usePolling';
import type { WorkflowState } from '../SimulationWorkspace';
import styles from '../simulation.module.css';

export default function Step4Report({
  wf,
  onReportId,
  onDone,
}: {
  wf: WorkflowState;
  onReportId: (id: string) => void;
  onDone: () => void;
}) {
  const { play } = useSound();
  const simId = wf.simulationId as string;
  const [reportId, setReportId] = useState<string | null>(wf.reportId);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyReport = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const finishWithReport = async (id: string, announceSuccess = true) => {
    setReportId(id);
    onReportId(id);
    setDone(true);
    setGenerating(false);
    setTaskId(null);
    if (announceSuccess) play('success');
    try {
      const full = await api.getReport(id);
      setContent(full.data?.markdown_content || full.data?.content || '');
    } catch {
      setContent('');
    }
  };

  const generate = async (force = false) => {
    if (force) play('click');
    setError(null);
    setGenerating(true);
    setContent('');
    setLogs([]);
    setDone(false);
    try {
      const res = await api.generateReport({ simulation_id: simId, force_regenerate: force });
      const id = res.data?.report_id ?? null;
      const nextTaskId = res.data?.task_id ?? null;
      setReportId(id);
      setTaskId(nextTaskId);
      if (id) onReportId(id);
      if (id && (res.data?.already_generated || res.data?.status === 'completed')) {
        await finishWithReport(id);
        return;
      }
      if (!id || !nextTaskId) {
        throw new Error('Report generation did not return a task id.');
      }
    } catch (e) {
      play('error');
      setError(e instanceof Error ? e.message : 'Failed to start report');
      setGenerating(false);
    }
  };

  // Start new work or restore an in-progress/completed report when returning to this step.
  useEffect(() => {
    let active = true;

    const initialize = async () => {
      if (!reportId) {
        await generate(false);
        return;
      }

      setGenerating(true);
      setError(null);
      try {
        const res = await api.getReportStatus({ simulation_id: simId });
        if (!active) return;

        const status = res.data?.status;
        const finalId = res.data?.result?.report_id || res.data?.report_id || reportId;
        if (status === 'completed' && finalId) {
          await finishWithReport(finalId, false);
        } else if (status === 'failed') {
          setError(res.data?.error || 'Report generation failed');
          setGenerating(false);
        } else if (status === 'not_started') {
          setReportId(null);
          await generate(false);
        }
        // Pending/processing/planning/generating states continue through polling below.
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not restore report status');
        setGenerating(false);
      }
    };

    initialize();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportPoll = usePolling(() => api.getReportStatus({ task_id: taskId || undefined, simulation_id: simId }), {
    enabled: !!(taskId || reportId) && generating && !done,
    intervalMs: 2500,
    stop: (res) => res.data?.status === 'completed' || res.data?.status === 'failed',
    onData: async (res) => {
      const st = res.data?.status;
      if (reportId) {
        try {
          const log = await api.getAgentLog(reportId, logs.length);
          if (log.data?.lines?.length) setLogs((prev) => [...prev, ...log.data!.lines]);
        } catch {}
      }
      if (st === 'failed') {
        play('error');
        setError(res.data?.error || 'Report generation failed');
        setGenerating(false);
      } else if (st === 'completed') {
        // On completion the real report id comes back under result.report_id.
        const finalId = res.data?.result?.report_id || res.data?.report_id || reportId;
        if (finalId) {
          await finishWithReport(finalId);
        } else {
          setError('Report generation completed without a report id.');
          setGenerating(false);
        }
      }
    },
  });

  useEffect(() => {
    if (!reportPoll.error || !generating) return;
    play('error');
    setError(reportPoll.error.message);
    setGenerating(false);
  }, [generating, play, reportPoll.error]);

  return (
    <div className={styles.panel}>
      <div className={styles.simHeader}>
        <h2 className={styles.panelTitle}>Report</h2>
        <div className={styles.simControls}>
          {!done && (
            <>
              <Button
                size="compact"
                onClick={() => generate(true)}
                onMouseEnter={() => play('hover')}
                disabled={generating}
              >
                {generating ? 'Generating…' : 'Generate report'}
              </Button>
              {generating && (
                <span className={styles.loaderInline} aria-hidden>
                  <DotmSquare3 speed={0.9} dotSize={4} gap={3} />
                </span>
              )}
            </>
          )}
          {done && (
            <>
              <button className={styles.secondaryBtnSm} onClick={copyReport} onMouseEnter={() => play('hover')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className={styles.secondaryBtnSm} onClick={() => generate(true)} onMouseEnter={() => play('hover')}>
                Regenerate
              </button>
              <Button
                size="compact"
                onClick={() => {
                  play('navigation');
                  onDone();
                }}
                onMouseEnter={() => play('hover')}
              >
                Discuss findings →
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {generating && (
        <div className={styles.logBox}>
          {logs.length === 0 && (
            <div className={styles.loaderBlock} aria-live="polite">
              <DotmSquare3 speed={0.9} dotSize={5} gap={3} />
              <span className={styles.muted}>Report Agent is thinking…</span>
            </div>
          )}
          {logs.slice(-40).map((l, i) => (
            <div key={i} className={styles.logLine}>
              {l}
            </div>
          ))}
        </div>
      )}

      {content && (
        <article className={styles.reportBody}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
