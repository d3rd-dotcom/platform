'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import UnicornScene from 'unicornstudio-react/next';
import Button from '@/components/button/Button';
import { useSound } from '@/hooks/useSound';
import * as api from '@/lib/simulation-api';
import type { Project } from '@/lib/simulation-api';
import { useAsync } from '../usePolling';
import styles from '../simulation.module.css';

const DEV_MOCK_PROJECTS: Project[] = [
  {
    project_id: 'mock-1',
    name: 'Aftermath of the Fed Rate Cut',
    status: 'graph_completed',
    simulation_requirement: 'Predict market reactions to the latest Fed rate cut across tech, real estate, and consumer sectors over the next 6 months.',
    created_at: '2026-06-18T10:00:00Z',
    updated_at: '2026-06-19T14:30:00Z',
  },
  {
    project_id: 'mock-2',
    name: 'CBDC Adoption in Southeast Asia',
    status: 'graph_completed',
    simulation_requirement: 'Simulate central bank digital currency adoption curves in Indonesia, Thailand, and Vietnam given current regulatory trajectories.',
    created_at: '2026-06-15T08:00:00Z',
    updated_at: '2026-06-17T11:00:00Z',
  },
  {
    project_id: 'mock-3',
    name: 'AI Regulation Impact on Open-Source LLM Development',
    status: 'graph_completed',
    simulation_requirement: 'Model how proposed EU and US AI regulations will affect open-source LLM contribution velocity, fork activity, and corporate adoption.',
    created_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-12T16:00:00Z',
  },
  {
    project_id: 'mock-4',
    name: 'Talent Migration Under Remote Work Policies',
    status: 'graph_completed',
    simulation_requirement: 'Project population shifts in US metro areas assuming 30% of knowledge workers remain fully remote through 2028.',
    created_at: '2026-06-05T07:00:00Z',
    updated_at: '2026-06-07T10:00:00Z',
  },
];



function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// Drive the card badge + call-to-action from the world's real state so a
// freshly-created world doesn't advertise "Observe findings" before it has any.
function worldCardState(p: Project, hasReport: boolean) {
  if (hasReport) return { badge: 'Report ready', cta: 'Observe findings' };
  switch (p.status) {
    case 'graph_building':
      return { badge: 'Building graph', cta: 'Resume build' };
    case 'failed':
    case 'error':
      return { badge: 'Needs attention', cta: 'Review' };
    case 'graph_completed':
    case 'graph_built':
      return { badge: 'Graph ready', cta: 'Open world' };
    case 'ontology_generated':
      return { badge: 'Draft', cta: 'Build graph' };
    default:
      return { badge: 'Draft', cta: 'Set up world' };
  }
}

export default function ProjectGallery({
  online,
  onOpen,
  canEdit,
  onRequireUpgrade,
}: {
  online: boolean | null;
  onOpen: (p: Project) => void;
  canEdit: boolean;
  onRequireUpgrade: () => void;
}) {
  const { play } = useSound();
  const { data, loading, refetch } = useAsync(() => api.listProjects(50), []);
  const projects = data?.data ?? [];
  const isOffline = online === false;
  const displayProjects = (isOffline || projects.length === 0) && !loading ? DEV_MOCK_PROJECTS : projects;
  const loadingProjects = loading && projects.length === 0;

  const allSims = useAsync(() => api.listSimulations(), []);
  const allReports = useAsync(() => api.listReports(), []);

  const reportByProject = useMemo(() => {
    const sims = allSims.data?.data ?? [];
    const reports = allReports.data?.data ?? [];
    const reportBySim = new Map<string, { title: string; summary: string }>();
    for (const r of reports) {
      const rec = r as Record<string, unknown>;
      const outline = rec.outline as { title?: string; summary?: string } | undefined;
      const simId = rec.simulation_id as string | undefined;
      if (rec.report_id && outline?.title && simId) {
        reportBySim.set(simId, {
          title: outline.title,
          summary: outline.summary ?? '',
        });
      }
    }
    const map = new Map<string, { title: string; summary: string }>();
    for (const s of sims) {
      const o = reportBySim.get(s.simulation_id);
      if (o) map.set(s.project_id, o);
    }
    return map;
  }, [allSims.data, allReports.data]);

  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});

  const castVote = useCallback((id: string, dir: 'up' | 'down') => {
    setVotes((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + (dir === 'up' ? 1 : -1) }));
  }, []);

  const share = useCallback(async (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    try {
      await navigator.share({ title: projectName, url: window.location.href });
    } catch {
      await navigator.clipboard?.writeText(window.location.href);
    }
  }, []);
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
    if (!canEdit) {
      play('error');
      onRequireUpgrade();
      return;
    }
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
        <header className={styles.galleryHeader}>
          <div className={styles.filterRow}>
            <div className={`${styles.filterBtn} ${styles.skeleton}`} style={{ width: 130 }}>&nbsp;</div>
            <div className={`${styles.filterBtn} ${styles.skeleton}`} style={{ width: 120 }}>&nbsp;</div>
            <div className={`${styles.actionBtn} ${styles.skeleton}`} style={{ width: 150 }}>&nbsp;</div>
          </div>
        </header>
        <section className={styles.projectGrid} aria-label="Loading worlds">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.projectCard}>
              <div className={styles.projectCardHeader}>
                <div className={styles.skeleton} style={{ width: 28, height: 12 }} />
                <div className={styles.skeleton} style={{ height: 12, width: '50%' }} />
              </div>
              <div className={styles.projectCardMain}>
                <div className={styles.projectCardBody}>
                  <div className={styles.skeleton} style={{ height: 20, width: '72%', marginBottom: 8 }} />
                  <div className={styles.skeleton} style={{ height: 12, width: '44%', marginBottom: 12 }} />
                  <div className={styles.skeleton} style={{ height: 12, width: '88%', marginBottom: 4 }} />
                  <div className={styles.skeleton} style={{ height: 12, width: '64%', marginBottom: 12 }} />
                  <div className={styles.skeleton} style={{ height: 14, width: 110, marginTop: 'auto' }} />
                </div>
                <div className={styles.projectCardVisual}>
                  <div className={styles.projectCardVisualInner}>
                    <div className={styles.skeleton} style={{ position: 'absolute', inset: 0, borderRadius: 10 }} />
                  </div>
                </div>
              </div>
              <div className={styles.projectCardFooter}>
                <div className={styles.skeleton} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <div className={styles.skeleton} style={{ width: 24, height: 12, borderRadius: 4 }} />
                <div className={styles.skeleton} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <div className={styles.skeleton} style={{ width: 28, height: 28, borderRadius: '50%', marginLeft: 'auto' }} />
              </div>
            </div>
          ))}
        </section>
        <aside className={styles.galleryRight}>
          <div className={styles.recentActivityCard}>
            <div className={styles.recentActivityHeader}>
              <div className={styles.skeleton} style={{ width: 20, height: 12 }} />
              <div className={styles.skeleton} style={{ height: 14, width: '40%' }} />
              <div className={styles.skeleton} style={{ width: 50, height: 10, marginLeft: 'auto' }} />
            </div>
            <div className={styles.phoneStage}>
              <div className={styles.phoneScreen}>
                <div className={styles.skeleton} style={{ width: '100%', height: 480 }} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className={styles.galleryWrap}>
      <div className={styles.feedHead}>
        <h2 className={styles.feedTitle}><span className={styles.titleJa}>世界</span>Simulated Pocket Worlds</h2>
      </div>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.394a.75.75 0 0 1 0 1.424l-1.183.394a1.5 1.5 0 0 0-.948.948l-.394 1.183a.75.75 0 0 1-1.424 0l-.394-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.394a.75.75 0 0 1 0-1.424l1.183-.394a1.5 1.5 0 0 0 .948-.948l.394-1.183A.75.75 0 0 1 16.5 15Z" clip-rule="evenodd"/></svg>
            Recent
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
            Your Worlds
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => {
              if (!canEdit) {
                play('error');
                onRequireUpgrade();
                return;
              }
              play('click');
              setCreating(true);
            }}
            onMouseEnter={() => play('hover')}
            title={canEdit ? undefined : 'Building a world requires VIP membership'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            Simulate
            {!canEdit && <span className={styles.vipTag}>VIP</span>}
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

      <section className={styles.projectGrid}>
        {!loading && !isOffline && projects.length === 0 && (
          <p className={styles.muted}>No worlds yet. Create your first one above.</p>
        )}
        {displayProjects.map((p, i) => {
          const article = reportByProject.get(p.project_id);
          const cardState = worldCardState(p, Boolean(article));
          const excerpt = article?.summary || p.simulation_requirement || '';
          return (
          <button
            key={p.project_id}
            className={styles.projectCard}
            onClick={() => {
              play('navigation');
              onOpen(p);
            }}
            onMouseEnter={() => play('hover')}
          >
            <div className={styles.projectCardHeader}>
              <span className={styles.projectCardKanji}>世界</span>
              <span className={styles.projectCardHeaderTitle}>{article?.title || p.name}</span>
            </div>
            <div className={styles.projectCardMain}>
            <div className={styles.projectCardBody}>
              {article ? (
                <h3 className={styles.projectCardName}>{article.title}</h3>
              ) : (
                <h3 className={styles.projectCardName}>{p.name}</h3>
              )}
              <p className={styles.projectCardAuthor}>by you · {formatDate(p.created_at)}</p>
              <p className={styles.projectCardExcerpt}>{excerpt || 'No description yet.'}</p>
              <span className={styles.observeBtn}>
                {cardState.cta}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </span>
              </div>
            <div className={styles.projectCardVisual}>
              <div
                className={`${styles.projectCardVisualInner} ${styles.projectCardVisualWithImage}`}
                style={{
                  backgroundImage: `url(${i === 0 ? '/world-first.jpg' : '/world-other.jpg'})`,
                }}
              >
                <span className={styles.projectStatus}>{cardState.badge}</span>
                </div>
              </div>
            </div>
            <div className={styles.projectCardFooter}>
              <button
                className={styles.projectCardVoteBtn}
                onClick={(e) => { e.stopPropagation(); castVote(p.project_id, 'up'); }}
                onMouseEnter={() => play('hover')}
                aria-label="Upvote"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
              </button>
              <span className={styles.projectCardVoteCount}>{votes[p.project_id] ?? 0}</span>
              <button
                className={styles.projectCardVoteBtn}
                onClick={(e) => { e.stopPropagation(); castVote(p.project_id, 'down'); }}
                onMouseEnter={() => play('hover')}
                aria-label="Downvote"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <button
                className={styles.projectCardShareBtn}
                onClick={(e) => share(e, article?.title || p.name)}
                onMouseEnter={() => play('hover')}
                aria-label="Share"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>
              </button>
              </div>
          </button>
          );
        })}
      </section>
      <aside className={styles.galleryRight}>
        <article className={styles.recentActivityCard}>
          <div className={styles.recentActivityHeader}>
            <span className={styles.recentActivityIcon}>世界</span>
            <h3 className={styles.recentActivityTitle}>Blue Research Unit 02</h3>
            <span className={styles.recentActivityEyebrow}>top creators</span>
          </div>
          <div className={styles.phoneStage}>
            <div className={styles.phoneScreen}>
              <UnicornScene
                projectId="lsL5y48OjUQx1IYb4hfS"
                sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.6/dist/unicornStudio.umd.js"
                width="100%"
                height="480px"
                scale={1}
                dpi={1.5}
                lazyLoad={false}
                showPlaceholderWhileLoading={false}
                className={styles.phoneScene}
              />
            </div>
          </div>
        </article>
      </aside>
      </div>
      </div>
  );
}