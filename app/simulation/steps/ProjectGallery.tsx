'use client';

import { useRef, useState, useEffect } from 'react';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import * as api from '@/lib/simulation-api';
import type { Project } from '@/lib/simulation-api';
import { useAsync } from '../usePolling';
import styles from '../simulation.module.css';

const SEED_POSTS = [
  { id: 'sp-1', title: 'If the treasury could fund one wild idea, what would yours be?', creator: 'Seraph', users: 3, amount: 130, img: '/anbel01.png' },
  { id: 'sp-2', title: 'What daily habit changed your mental health the most?', creator: 'Halo', users: 7, amount: 85, img: '/anbel02.png' },
  { id: 'sp-3', title: 'Would you try a brain-training game designed by the community?', creator: 'Vesper', users: 2, amount: 210, img: '/anbel03.png' },
  { id: 'sp-4', title: 'Open Dataset: Attention Metrics in LLM-Augmented Dev Workflows', creator: 'Orbit', users: 5, amount: 50, img: '/anbel04.png' },
  { id: 'sp-5', title: 'RFC: Open Protocol for Burnout Detection in Dev Teams', creator: 'Prism', users: 4, amount: 175, img: '/anbel05.png' },
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

  useEffect(() => {
    if (!creating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreating(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating]);

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

  if (loadingProjects) {
    return (
      <div className={styles.gallery}>
        <section className={`${styles.projectGrid} ${styles.projectGridLoading}`}>
          <div className={styles.loaderBlock} aria-live="polite">
            <DotmSquare3 speed={0.9} dotSize={5} gap={3} />
            <p className={styles.muted}>Loading worlds…</p>
          </div>
        </section>
      </div>
    );
  }

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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            Your Pocket
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => {
              play('click');
              setCreating(true);
            }}
            onMouseEnter={() => play('hover')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
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
        <div className={styles.backdrop} onClick={() => setCreating(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Create a new world</h2>
              <button className={styles.modalClose} onClick={() => setCreating(false)} aria-label="Close">✕</button>
            </div>
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

      <div className={styles.galleryBody}>
        <section className={styles.projectGrid}>
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
                {(p.ontology?.analysis_summary || p.simulation_requirement) && (
                  <p className={styles.projectCardExcerpt}>{p.ontology?.analysis_summary || p.simulation_requirement}</p>
                )}
                <span className={styles.observeBtn}>
                  Observe findings
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </span>
              </div>
              <div className={styles.projectCardVisual}>
                <div
                  className={styles.projectCardVisualInner}
                  style={{ background: 'var(--color-surface-2)' }}
                >
                  <span className={styles.projectStatus}>Pocket World</span>
                </div>
              </div>
            </button>
          ))}
        </section>
        <div className={styles.galleryRight}>
          <article className={styles.recentActivityCard}>
            <div className={styles.recentActivityHeader}>
              <h3 className={styles.recentActivityTitle}>Recent Activity</h3>
              <button className={styles.recentActivityLink} onClick={() => {}}>
                View all
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
            <div className={styles.recentActivityList}>
              {SEED_POSTS.map((post) => (
                <div key={post.id} className={styles.recentMiniCard}>
                  <div className={styles.recentMiniBody}>
                    <p className={styles.recentMiniTitle}>{post.title}</p>
                    <div className={styles.recentMiniMeta}>
                      <span>{post.creator}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      <span>{post.users}</span>
                      <span className={styles.recentMiniAmount}>${post.amount} available</span>
                    </div>
                  </div>
                  <div className={styles.recentMiniImage}>
                    <img src={post.img} alt="" />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}