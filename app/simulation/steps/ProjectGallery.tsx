'use client';

import { useRef, useState } from 'react';
import { DotmSquare15 } from '@/components/dot-matrix/DotmSquare15';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import * as api from '@/lib/simulation-api';
import type { Project } from '@/lib/simulation-api';
import { useAsync } from '../usePolling';
import styles from '../simulation.module.css';

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)',
  'linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%)',
  'linear-gradient(135deg, #993556 0%, #D4537E 100%)',
  'linear-gradient(135deg, #185FA5 0%, #378ADD 100%)',
  'linear-gradient(135deg, #854F0B 0%, #EF9F27 100%)',
  'linear-gradient(135deg, #3B6D11 0%, #639922 100%)',
];

export default function ProjectGallery({
  online,
  onOpen,
}: {
  online: boolean | null;
  onOpen: (p: Project) => void;
}) {
  const { play } = useSound();
  const { data, loading, refetch } = useAsync(() => api.listProjects(50), []);
  const projects = data?.data ?? [];
  const loadingProjects = loading && projects.length === 0;

  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [requirement, setRequirement] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    play('click');
    setError(null);
    if (!requirement.trim()) {
      play('error');
      setError('Describe what you want to predict or simulate.');
      return;
    }
    if (!files.length) {
      play('error');
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
      if (full.data) {
        play('success');
        onOpen(full.data);
      }
    } catch (e) {
      play('error');
      setError(e instanceof Error ? e.message : 'Failed to create world');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.gallery}>
      <header className={styles.galleryHeader}>
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterBtn} ${activeFilter === 'recent' ? styles.filterBtnActive : ''}`}
            onClick={() => {
              play('click');
              setActiveFilter(activeFilter === 'recent' ? null : 'recent');
            }}
            onMouseEnter={() => play('hover')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Recent Worlds
          </button>
          <button
            className={`${styles.filterBtn} ${activeFilter === 'pocket' ? styles.filterBtnActive : ''}`}
            onClick={() => {
              play('click');
              setActiveFilter(activeFilter === 'pocket' ? null : 'pocket');
            }}
            onMouseEnter={() => play('hover')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h16a2 2 0 0 1 2 2v6a10 10 0 0 1-10 10A10 10 0 0 1 2 11V5a2 2 0 0 1 2-2z"/><polyline points="8 10 12 14 16 10"/></svg>
            Your Pocket
          </button>
          <button
            className={`${styles.filterBtn} ${creating ? styles.filterBtnActive : ''}`}
            onClick={() => {
              play('click');
              setCreating((v) => !v);
            }}
            onMouseEnter={() => play('hover')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><line x1="9" y1="3" x2="9" y2="7"/><line x1="5" y1="7" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/><line x1="19" y1="7" x2="15" y2="7"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Simulate Reality
          </button>
        </div>
      </header>

      {online === false && (
        <div className={styles.warnBanner}>
          The simulation engine is offline. Set <code>SIMULATION_API_URL</code> and{' '}
          <code>SIMULATION_API_SECRET</code> to your deployed backend (see{' '}
          <code>simulation-backend/DEPLOY.md</code>). You can still browse the interface, but
          building worlds needs the backend running.
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
              rows={2}
              placeholder="Describe the scenario and the question you want answered."
            />
          </label>
          <div className={styles.field}>
            <button
              type="button"
              className={styles.accordionToggle}
              onClick={() => {
                play('click');
                setContextOpen((v) => !v);
              }}
              onMouseEnter={() => play('hover')}
              aria-expanded={contextOpen}
            >
              <span>People, entities, and relationships (optional)</span>
              <span className={styles.accordionChevron} aria-hidden>
                {contextOpen ? '−' : '+'}
              </span>
            </button>
            {contextOpen && (
              <>
                <textarea
                  className={styles.textarea}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={4}
                  placeholder="Add key people, groups, or connections."
                />
                <small className={styles.fieldHint}>
                  Use one clear fact per line. These details become source context for graph entities
                  and directed relationships.
                </small>
              </>
            )}
          </div>
          <div className={styles.createCardFooter}>
            <div className={styles.field}>
              <span id="source-documents-label">Source documents</span>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept=".pdf,.md,.markdown,.txt"
                className={styles.fileInput}
                aria-labelledby="source-documents-label"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <button
                type="button"
                className={styles.filePickerBtn}
                onClick={() => {
                  play('click');
                  fileInput.current?.click();
                }}
                onMouseEnter={() => play('hover')}
              >
                Choose files
              </button>
              {files.length > 0 && (
                <span className={styles.fileList}>{files.map((f) => f.name).join(', ')}</span>
              )}
            </div>
            {error && <p className={styles.errorText}>{error}</p>}
            <Button onClick={submit} onMouseEnter={() => play('hover')} disabled={busy}>
              {busy ? 'Analyzing documents…' : 'Build knowledge graph'}
            </Button>
          </div>
        </div>
      )}

      <section
        className={`${styles.projectGrid} ${loadingProjects ? styles.projectGridLoading : ''}`}
      >
        {loadingProjects && (
          <div className={styles.loaderBlock} aria-live="polite">
            <DotmSquare15 speed={0.9} dotSize={5} gap={3} />
            <p className={styles.muted}>Loading worlds…</p>
          </div>
        )}
        {!loading && projects.length === 0 && (
          <p className={styles.muted}>No worlds yet. Create your first one above.</p>
        )}
        {projects.map((p, i) => (
          <button
            key={p.project_id}
            className={styles.projectCard}
            onClick={() => {
              play('navigation');
              onOpen(p);
            }}
            onMouseEnter={() => play('hover')}
          >
            <div className={styles.projectCardBody}>
              <h3 className={styles.projectCardName}>{p.name}</h3>
              <p className={styles.projectCardAuthor}>by you</p>
              {p.simulation_requirement && (
                <p className={styles.projectCardExcerpt}>{p.simulation_requirement}</p>
              )}
              <span className={styles.observeBtn}>
                Observe findings
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </span>
            </div>
            <div className={styles.projectCardVisual}>
              <div
                className={styles.projectCardVisualInner}
                style={{ background: BANNER_GRADIENTS[i % BANNER_GRADIENTS.length] }}
              >
                <span className={styles.projectStatus}>Pocket World</span>
              </div>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}