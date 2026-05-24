'use client';

import { useRef, useState } from 'react';
import * as api from '@/lib/simulation-api';
import type { Project } from '@/lib/simulation-api';
import { useAsync } from '../usePolling';
import styles from '../simulation.module.css';

export default function ProjectGallery({
  online,
  onOpen,
}: {
  online: boolean | null;
  onOpen: (p: Project) => void;
}) {
  const { data, loading, refetch } = useAsync(() => api.listProjects(50), []);
  const projects = data?.data ?? [];

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [requirement, setRequirement] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setError(null);
    if (!requirement.trim()) {
      setError('Describe what you want to predict or simulate.');
      return;
    }
    if (!files.length) {
      setError('Add at least one source document (pdf, md, or txt).');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('simulation_requirement', requirement);
      fd.append('project_name', name || 'Untitled world');
      if (additionalContext.trim()) {
        fd.append('additional_context', additionalContext.trim());
      }
      const res = await api.generateOntology(fd);
      const projectId = res.data?.project_id;
      if (!projectId) throw new Error('No project id returned');
      const full = await api.getProject(projectId);
      if (full.data) onOpen(full.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create world');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.gallery}>
      <header className={styles.galleryHeader}>
        <div>
          <h1 className={styles.galleryTitle}>Simulations</h1>
          <p className={styles.gallerySub}>
            Turn a document into a living world of autonomous agents, then read the future it produces.
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setCreating((v) => !v)}>
          {creating ? 'Close' : 'New world'}
        </button>
      </header>

      {online === false && (
        <div className={styles.warnBanner}>
          The simulation engine is offline. Set <code>SIMULATION_API_URL</code> and{' '}
          <code>SIMULATION_API_SECRET</code> to your deployed backend (see{' '}
          <code>simulation-backend/DEPLOY.md</code>). You can still browse the
          interface, but building worlds needs the backend running.
        </div>
      )}

      {creating && (
        <div className={styles.createCard}>
          <label className={styles.field}>
            <span>World name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aftermath of the rate cut"
            />
          </label>
          <label className={styles.field}>
            <span>What should this world predict?</span>
            <textarea
              className={styles.textarea}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              rows={3}
              placeholder="Describe the scenario and the question you want answered."
            />
          </label>
          <label className={styles.field}>
            <span>People, entities, and relationships (optional)</span>
            <textarea
              className={styles.textarea}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={8}
              placeholder={`Add facts your documents may not include.\n\nPeople:\n- Maya Chen: grant reviewer and mentor.\n\nRelationships:\n- James -> WORKS_WITH -> Maya Chen\n- Maya Chen -> REVIEWS -> Artizen application`}
            />
            <small className={styles.fieldHint}>
              Use one clear fact per line. These details become source context for graph entities
              and directed relationships.
            </small>
          </label>
          <label className={styles.field}>
            <span>Source documents</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,.md,.markdown,.txt"
              className={styles.fileInput}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <span className={styles.fileList}>{files.map((f) => f.name).join(', ')}</span>
            )}
          </label>
          {error && <p className={styles.errorText}>{error}</p>}
          <button className={styles.primaryBtn} onClick={submit} disabled={busy}>
            {busy ? 'Analyzing documents…' : 'Build knowledge graph'}
          </button>
        </div>
      )}

      <section className={styles.projectGrid}>
        {loading && <p className={styles.muted}>Loading worlds…</p>}
        {!loading && projects.length === 0 && (
          <p className={styles.muted}>No worlds yet. Create your first one above.</p>
        )}
        {projects.map((p) => (
          <button key={p.project_id} className={styles.projectCard} onClick={() => onOpen(p)}>
            <div className={styles.projectCardTop}>
              <span className={styles.projectStatus} data-status={p.status}>
                {prettyStatus(p.status)}
              </span>
            </div>
            <h3 className={styles.projectCardName}>{p.name}</h3>
            {p.simulation_requirement && (
              <p className={styles.projectCardReq}>{p.simulation_requirement}</p>
            )}
            <span className={styles.projectCardMeta}>
              {p.files?.length ? `${p.files.length} document(s)` : 'No documents'}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

function prettyStatus(s: string) {
  return s
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
