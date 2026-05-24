'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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
  const simId = wf.simulationId as string;
  const [reportId, setReportId] = useState<string | null>(wf.reportId);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const finishWithReport = async (id: string) => {
    setReportId(id);
    onReportId(id);
    setDone(true);
    setGenerating(false);
    setTaskId(null);
    try {
      const full = await api.getReport(id);
      setContent(full.data?.markdown_content || full.data?.content || '');
    } catch {
      setContent('');
    }
  };

  const generate = async (force = false) => {
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
      setError(e instanceof Error ? e.message : 'Failed to start report');
      setGenerating(false);
    }
  };

  // Auto-start the first time.
  useEffect(() => {
    if (!reportId && !generating && !done) generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportPoll = usePolling(() => api.getReportStatus({ task_id: taskId || undefined, simulation_id: simId }), {
    enabled: !!taskId && generating && !done,
    intervalMs: 2500,
    stop: (res) => res.data?.status === 'completed' || res.data?.status === 'failed',
    onData: async (res) => {
      const st = res.data?.status;
      try {
        const log = await api.getAgentLog(reportId as string, logs.length);
        if (log.data?.lines?.length) setLogs((prev) => [...prev, ...log.data!.lines]);
      } catch {}
      if (st === 'failed') {
        setError(res.data?.error || 'Report generation failed');
        setGenerating(false);
      } else if (st === 'completed') {
        setDone(true);
        setGenerating(false);
        // On completion the real report id comes back under result.report_id.
        const finalId = res.data?.result?.report_id || res.data?.report_id || reportId;
        if (finalId && finalId !== reportId) {
          setReportId(finalId);
          onReportId(finalId);
        }
        try {
          const full = await api.getReport(finalId as string);
          setContent(full.data?.markdown_content || full.data?.content || '');
        } catch {
          setContent('');
        }
      }
    },
  });

  useEffect(() => {
    if (!reportPoll.error || !generating) return;
    setError(reportPoll.error.message);
    setGenerating(false);
  }, [reportPoll.error, generating]);

  return (
    <div className={styles.panel}>
      <div className={styles.simHeader}>
        <div>
          <h2 className={styles.panelTitle}>Report</h2>
          <p className={styles.panelLead}>
            The Report Agent reads the whole simulation and synthesizes a forecast that answers your
            original question.
          </p>
        </div>
        <div className={styles.simControls}>
          {done ? (
            <>
              <button className={styles.secondaryBtn} onClick={() => generate(true)}>
                Regenerate
              </button>
              <button className={styles.primaryBtn} onClick={onDone}>
                Talk to the world →
              </button>
            </>
          ) : (
            <button className={styles.primaryBtn} onClick={() => generate(true)} disabled={generating}>
              {generating ? 'Generating…' : 'Generate report'}
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {generating && (
        <div className={styles.logBox}>
          {logs.length === 0 && <span className={styles.muted}>Report Agent is thinking…</span>}
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
