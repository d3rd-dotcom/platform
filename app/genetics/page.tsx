'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { useSNPMatcherWorker, proxy } from '@/hooks/useSNPMatcherWorker';
import { FileUpload } from '@/components/genetics/FileUpload';
import { GeneticsChat } from '@/components/genetics/GeneticsChat';
import { GenosetDisplay } from '@/components/genetics/GenosetDisplay';
import { WikiContent } from '@/components/genetics/WikiContent';
import type { Piece } from '@/components/genetics/gallery/snpArt';
import type { ParseResult, MatchedSNP, MatchedGenoset, SNPRecord } from '@/types/genetics';
import styles from './page.module.css';

const OsirisGallery = dynamic(
  () => import('@/components/genetics/gallery/OsirisGallery').then((m) => m.OsirisGallery),
  { ssr: false, loading: () => <div className={styles.galleryFallback} /> },
);

const ProMembershipModal = dynamic(
  () => import('@/components/pro-membership-modal/ProMembershipModal'),
  { ssr: false },
);

type AppMode = 'upload' | 'browse';
type Dossier = 'marker' | 'genosets' | 'blue';
type AccessState = 'checking' | 'granted' | 'locked';

/** A gallery hangs a selection. It does not hang the whole archive. */
const HANG_LIMIT = 600;

const CHROMOSOMES = [
  '1','2','3','4','5','6','7','8','9','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','X','Y','MT',
];

const CLINICAL_SIGNIFICANCE_OPTIONS = [
  'Pathogenic','Likely pathogenic','Benign','Likely benign',
  'Uncertain significance','risk factor','association',
];

/** Wiki markup makes a poor wall label. Reduce it to one plain sentence. */
function toCaption(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const plain = content
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/<[^>]+>/g, ' ')
    .replace(/['"=*#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return undefined;
  const sentence = plain.split(/(?<=\.)\s/)[0];
  return sentence.length > 96 ? `${sentence.slice(0, 96).trimEnd()}…` : sentence;
}

function toMagnitude(content: string | undefined): number | undefined {
  if (!content) return undefined;
  const m = content.match(/magnitude\s*[=|:]?\s*([0-9]+(?:\.[0-9]+)?)/i);
  return m ? Number(m[1]) : undefined;
}

function GeneticsLab() {
  const [mode, setMode] = useState<AppMode>('upload');
  const [dossier, setDossier] = useState<Dossier>('marker');
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [dbError, setDbError] = useState<Error | null>(null);
  const [dbStats, setDbStats] = useState<{ totalSNPs: number } | null>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [matches, setMatches] = useState<MatchedSNP[] | null>(null);
  const [genosets, setGenosets] = useState<MatchedGenoset[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isMatchingGenosets, setIsMatchingGenosets] = useState(false);
  const [matchError, setMatchError] = useState<Error | null>(null);

  // Browse (the public wing)
  const [searchTerm, setSearchTerm] = useState('');
  const [chromosome, setChromosome] = useState('');
  const [gene, setGene] = useState('');
  const [clinicalSignificance, setClinicalSignificance] = useState('');
  const [disease, setDisease] = useState('');
  const [browseResults, setBrowseResults] = useState<SNPRecord[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLParagraphElement>(null);

  const { api: workerApi, isReady: isWorkerReady, error: workerError } = useSNPMatcherWorker();

  useEffect(() => {
    if (!isWorkerReady || !workerApi) return;

    async function loadDB() {
      if (!workerApi) return;
      try {
        setIsDbLoading(true);
        setDbError(null);

        await workerApi.loadDatabase(
          '/api/proxy/snpedia-db',
          proxy((progress: number) => {
            if (progressBarRef.current) progressBarRef.current.style.width = `${progress}%`;
            if (progressTextRef.current) progressTextRef.current.textContent = `${Math.round(progress)}% complete`;
          }),
        );

        const stats = await workerApi.getDatabaseStats();
        setDbStats(stats);
        setIsDbLoading(false);
      } catch (err) {
        console.error('Error loading database:', err);
        setDbError(err instanceof Error ? err : new Error('Failed to load database'));
        setIsDbLoading(false);
      }
    }

    loadDB();
  }, [isWorkerReady, workerApi]);

  // Search only runs once the archive is actually open.
  useEffect(() => {
    if (mode !== 'browse' || !workerApi || isDbLoading) return;
    let stale = false;

    (async () => {
      setIsSearching(true);
      try {
        const { results, total } = await workerApi.searchSNPs({
          searchTerm: searchTerm || undefined,
          chromosome: chromosome || undefined,
          gene: gene || undefined,
          clinicalSignificance: clinicalSignificance || undefined,
          disease: disease || undefined,
          limit: HANG_LIMIT,
        });
        if (stale) return;
        setBrowseResults(results);
        setBrowseTotal(total);
        setSelectedId(results[0]?.rsid ?? null);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if (!stale) setIsSearching(false);
      }
    })();

    return () => { stale = true; };
  }, [mode, workerApi, isDbLoading, searchTerm, chromosome, gene, clinicalSignificance, disease]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!workerApi) return;

      try {
        const content = await file.text();
        setIsParsing(true);
        setMatchError(null);

        const result = await workerApi.parseFile(
          content,
          proxy((current: number, total: number) => {
            const progress = total > 0 ? (current / total) * 100 : 0;
            if (progressBarRef.current) progressBarRef.current.style.width = `${progress}%`;
            if (progressTextRef.current) progressTextRef.current.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} lines read`;
          }),
        );

        setParseResult(result);
        setDetectedFormat(result.detectedFormat || null);
        setIsParsing(false);

        if (result.genotypes.length === 0) throw new Error('No valid SNP data found in file');

        setIsMatching(true);
        const matchedSNPs = await workerApi.matchSNPs(
          result.genotypes,
          proxy((current: number, total: number) => {
            const progress = total > 0 ? (current / total) * 100 : 0;
            if (progressBarRef.current) progressBarRef.current.style.width = `${progress}%`;
            if (progressTextRef.current) progressTextRef.current.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} markers spliced`;
          }),
        );

        setMatches(matchedSNPs);
        setIsMatching(false);

        setIsMatchingGenosets(true);
        const matchedGenosets = await workerApi.matchGenosets(
          matchedSNPs,
          proxy((current: number, total: number) => {
            const progress = total > 0 ? (current / total) * 100 : 0;
            if (progressBarRef.current) progressBarRef.current.style.width = `${progress}%`;
            if (progressTextRef.current) progressTextRef.current.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} genosets checked`;
          }),
        );

        setGenosets(matchedGenosets);
        setIsMatchingGenosets(false);
      } catch (err) {
        console.error('Error processing file:', err);
        setMatchError(err instanceof Error ? err : new Error('Unknown error'));
        setIsParsing(false);
        setIsMatching(false);
        setIsMatchingGenosets(false);
      }
    },
    [workerApi],
  );

  const handleReset = useCallback(() => {
    setParseResult(null);
    setDetectedFormat(null);
    setMatches(null);
    setGenosets(null);
    setMatchError(null);
    setSelectedId(null);
    setMode('upload');
    setDossier('marker');
  }, []);

  const hasResults = !!matches && genosets !== null;
  const hasError = dbError || matchError || workerError;
  const isProcessing = isParsing || isMatching || isMatchingGenosets;

  /** The user's own markers, loudest first — the private wing. */
  const ownPieces = useMemo<Piece[]>(() => {
    if (!matches) return [];
    return matches
      .filter((m) => m.genotypeData !== undefined)
      .sort((a, b) => (b.parsedData.magnitude ?? -1) - (a.parsedData.magnitude ?? -1))
      .slice(0, HANG_LIMIT)
      .map((m) => ({
        id: m.rsid,
        genotype: m.genotype,
        magnitude: m.parsedData.magnitude,
        label: `${m.rsid.toUpperCase()} · ${m.genotype}`,
        caption: toCaption(m.genotypeData?.content ?? m.snpData.content),
      }));
  }, [matches]);

  const browsePieces = useMemo<Piece[]>(
    () =>
      browseResults.map((r) => ({
        id: r.rsid,
        magnitude: toMagnitude(r.content),
        label: r.rsid.toUpperCase(),
        caption: toCaption(r.content),
      })),
    [browseResults],
  );

  const pieces = mode === 'browse' ? browsePieces : ownPieces;

  const selectedMatch = useMemo(
    () => (mode === 'upload' ? matches?.find((m) => m.rsid === selectedId) ?? null : null),
    [mode, matches, selectedId],
  );
  const selectedRecord = useMemo(
    () => (mode === 'browse' ? browseResults.find((r) => r.rsid === selectedId) ?? null : null),
    [mode, browseResults, selectedId],
  );

  const handleSelect = useCallback((piece: Piece) => {
    setSelectedId(piece.id);
    setDossier('marker');
  }, []);

  const hasActiveFilters = !!(searchTerm || chromosome || gene || clinicalSignificance || disease);
  const clearFilters = () => {
    setSearchTerm(''); setChromosome(''); setGene('');
    setClinicalSignificance(''); setDisease('');
  };

  /* ---------- dossier (right side of the terminal) ---------- */
  const renderDossier = () => {
    if (hasError) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>The archive did not open</p>
          <p className={styles.stateError}>
            {dbError?.message || matchError?.message || workerError?.message || 'An unknown error occurred'}
          </p>
          <button type="button" onClick={() => window.location.reload()} className={styles.terminalButton}>
            Reload the room
          </button>
        </div>
      );
    }

    if (isDbLoading) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Uncrating the archive</p>
          <div className={styles.progressBar}>
            <div ref={progressBarRef} className={styles.progressFill} style={{ width: '0%' }} />
          </div>
          <p ref={progressTextRef} className={styles.progressText}>0% complete</p>
          <p className={styles.stateHint}>Roughly 155MB of SNPedia. Thirty to sixty seconds.</p>
        </div>
      );
    }

    if (isProcessing) {
      const title = isParsing
        ? 'Reading your file'
        : isMatching
          ? 'Splicing markers to canvas'
          : 'Checking genosets';
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>{title}</p>
          <div className={styles.progressBar}>
            <div ref={progressBarRef} className={styles.progressFill} style={{ width: '0%' }} />
          </div>
          <p ref={progressTextRef} className={styles.progressText}>0 / 0</p>
        </div>
      );
    }

    if (dossier === 'blue') {
      return (
        <div className={styles.dossierScroll}>
          <GeneticsChat matches={matches} genosets={genosets} />
        </div>
      );
    }

    if (dossier === 'genosets' && genosets) {
      return (
        <div className={styles.dossierScroll}>
          <GenosetDisplay genosets={genosets} />
        </div>
      );
    }

    if (mode === 'upload' && !hasResults) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Bring your own genome</p>
          <p className={styles.stateHint}>
            23andMe, AncestryDNA, MyHeritage, or FamilyTreeDNA. It is read here, on this
            device, and hung on the wall above.
          </p>
          <div className={styles.uploadSlot}>
            <FileUpload onFileSelect={handleFileSelect} />
          </div>
        </div>
      );
    }

    if (isSearching && !pieces.length) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Searching the archive</p>
        </div>
      );
    }

    const content = selectedMatch
      ? selectedMatch.genotypeData?.content || selectedMatch.snpData.content
      : selectedRecord?.content;

    if (!content) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Nothing selected</p>
          <p className={styles.stateHint}>
            {pieces.length
              ? 'Walk the gallery above and choose a piece.'
              : 'No markers match these filters. The wing is empty.'}
          </p>
        </div>
      );
    }

    return (
      <div className={styles.dossierScroll}>
        <div className={styles.dossierHead}>
          <h2 className={styles.dossierTitle}>{(selectedId || '').toUpperCase()}</h2>
          {selectedMatch && <span className={styles.chip}>Your call: {selectedMatch.genotype}</span>}
          {selectedMatch?.parsedData.magnitude !== undefined && (
            <span className={styles.chip}>Magnitude {selectedMatch.parsedData.magnitude}</span>
          )}
        </div>
        <WikiContent content={content} />
      </div>
    );
  };

  return (
    <main className={styles.content}>
      {/* The room */}
      <section className={styles.galleryBand}>
        <OsirisGallery pieces={pieces} selectedId={selectedId} onSelect={handleSelect} />
      </section>

      {/* The terminal beneath it. It is a dark room, so the shared components
          inside it (upload, wiki body, genosets, chat) get the dark palette
          rather than a per-component override. */}
      <section className={styles.terminal} data-theme="dark">
        <p className={styles.statement}>
          Osiris Art Gallery of Genetic Research. Under the Humane Genome Project License
          (HGPL), Maverick Blue splices epigenetic markers — non cell — to digital artistry.
          Every rsid is a seed, and every seed paints exactly one canvas, the same canvas,
          forever. What hangs here is a portrait of a coordinate you happen to occupy. Your
          file is read on this device and leaves no residue.
        </p>

        <div className={styles.terminalGrid}>
          <aside className={styles.rail}>
            <div className={`${styles.railSection} ${styles.railSectionWing}`}>
              <span className={styles.railLabel}>Wing</span>
              <div className={styles.segmented}>
                <button
                  type="button"
                  onClick={() => { setMode('browse'); setDossier('marker'); setSelectedId(null); }}
                  disabled={isProcessing}
                  className={`${styles.segmentBtn} ${mode === 'browse' ? styles.segmentBtnActive : ''}`}
                >
                  Public archive
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('upload'); setDossier('marker'); setSelectedId(null); }}
                  disabled={isProcessing}
                  className={`${styles.segmentBtn} ${mode === 'upload' ? styles.segmentBtnActive : ''}`}
                >
                  {hasResults ? 'Your wing' : 'Bring a genome'}
                </button>
              </div>
            </div>

            <span className={styles.statusPill}>
              <span className={`${styles.statusDot} ${isDbLoading ? styles.statusDotLoading : ''}`} />
              {isDbLoading
                ? 'Uncrating the archive'
                : dbStats
                  ? `${dbStats.totalSNPs.toLocaleString()} markers catalogued`
                  : 'Archive idle'}
            </span>

            {mode === 'browse' && (
              <div className={styles.railSection}>
                <div className={styles.railHead}>
                  <span className={styles.railLabel}>Curate</span>
                  <span className={styles.railHeadRight}>
                    <span className={styles.railNote}>
                      {isSearching
                        ? 'Searching the archive'
                        : `Hanging ${pieces.length.toLocaleString()} of ${browseTotal.toLocaleString()}`}
                    </span>
                    {hasActiveFilters && (
                      <button type="button" onClick={clearFilters} className={styles.linkButton}>
                        Reset
                      </button>
                    )}
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="rsid, gene, disease, or text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.field}
                />

                <div className={styles.fieldRow}>
                  <select value={chromosome} onChange={(e) => setChromosome(e.target.value)} className={styles.field}>
                    <option value="">Any chromosome</option>
                    {CHROMOSOMES.map((chr) => <option key={chr} value={chr}>Chromosome {chr}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Gene"
                    value={gene}
                    onChange={(e) => setGene(e.target.value)}
                    className={styles.field}
                  />
                </div>

                <div className={styles.fieldRow}>
                  <select
                    value={clinicalSignificance}
                    onChange={(e) => setClinicalSignificance(e.target.value)}
                    className={styles.field}
                  >
                    <option value="">Any clinical significance</option>
                    {CLINICAL_SIGNIFICANCE_OPTIONS.map((sig) => <option key={sig} value={sig}>{sig}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Disease"
                    value={disease}
                    onChange={(e) => setDisease(e.target.value)}
                    className={styles.field}
                  />
                </div>
              </div>
            )}

            {mode === 'upload' && hasResults && (
              <div className={styles.railSection}>
                <span className={styles.railLabel}>Your collection</span>
                <p className={styles.railNote}>
                  {parseResult?.genotypes.length.toLocaleString()} markers read
                  {detectedFormat && <> · {detectedFormat.replace('-', ' ')}</>}
                  <br />
                  {pieces.length.toLocaleString()} hung · {genosets?.length.toLocaleString()} genosets
                </p>
                <button type="button" onClick={handleReset} className={styles.terminalButton}>
                  Bring another genome
                </button>
              </div>
            )}
          </aside>

          <div className={styles.dossier}>
            <header className={styles.dossierTabs}>
              <button
                type="button"
                onClick={() => setDossier('marker')}
                className={`${styles.tab} ${dossier === 'marker' ? styles.tabActive : ''}`}
              >
                Wall text
              </button>
              {hasResults && (
                <button
                  type="button"
                  onClick={() => setDossier('genosets')}
                  className={`${styles.tab} ${dossier === 'genosets' ? styles.tabActive : ''}`}
                >
                  Genosets
                </button>
              )}
              <button
                type="button"
                onClick={() => setDossier('blue')}
                className={`${styles.tab} ${dossier === 'blue' ? styles.tabActive : ''}`}
              >
                Ask Blue
              </button>
            </header>
            <div className={styles.dossierBody}>{renderDossier()}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function GeneticsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [access, setAccess] = useState<AccessState>('checking');
  const [showProModal, setShowProModal] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) {
      setAccess('locked');
      return;
    }
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/membership/holding-status', {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setAccess(data.hasVipMembershipCard ? 'granted' : 'locked');
        return;
      }
      setAccess('locked');
    } catch {
      setAccess('locked');
    }
  }, [ready, authenticated, getAccessToken]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const handleProModalClose = useCallback(() => {
    setShowProModal(false);
    setAccess('checking');
    checkAccess();
  }, [checkAccess]);

  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      {access === 'granted' ? (
        <GeneticsLab />
      ) : (
        <main className={styles.content}>
          <section className={styles.galleryBand}>
            <OsirisGallery pieces={[]} onSelect={() => {}} />
          </section>
          <section className={styles.terminal} data-theme="dark">
            <p className={styles.statement}>
              Osiris Art Gallery of Genetic Research. Under the Humane Genome Project
              License (HGPL), Maverick Blue splices epigenetic markers — non cell — to
              digital artistry. The room is open to members. Hold a VIP membership card
              and the walls fill with 110,000 markers from SNPedia, or with your own
              genome, read entirely on this device and uploaded nowhere.
            </p>
            <div className={styles.lockRow}>
              <button
                type="button"
                onClick={() => setShowProModal(true)}
                disabled={access === 'checking'}
                className={styles.unlockButton}
              >
                {access === 'checking' ? 'Checking membership' : 'Unlock with VIP membership'}
              </button>
              <span className={styles.lockNote}>Members only</span>
            </div>
          </section>
        </main>
      )}
      <ProMembershipModal isOpen={showProModal} onClose={handleProModalClose} />
    </div>
  );
}
