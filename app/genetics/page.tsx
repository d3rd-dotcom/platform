'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { useSNPMatcherWorker, proxy } from '@/hooks/useSNPMatcherWorker';
import { FileUpload } from '@/components/genetics/FileUpload';
import { ResultsDisplay } from '@/components/genetics/ResultsDisplay';
import { SNPBrowser } from '@/components/genetics/SNPBrowser';
import { GeneticsChat } from '@/components/genetics/GeneticsChat';
import type { ParseResult, MatchedSNP, MatchedGenoset } from '@/types/genetics';
import styles from './page.module.css';

const ProMembershipModal = dynamic(
  () => import('@/components/pro-membership-modal/ProMembershipModal'),
  { ssr: false },
);

type AppMode = 'upload' | 'browse';
type SpaceView = 'explore' | 'chat';
type AccessState = 'checking' | 'granted' | 'locked';

function GeneticsLab() {
  const [mode, setMode] = useState<AppMode>('upload');
  const [spaceView, setSpaceView] = useState<SpaceView>('explore');
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

  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLParagraphElement>(null);

  const { api: workerApi, isReady: isWorkerReady, error: workerError } = useSNPMatcherWorker();

  // Load database when worker is ready
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

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!workerApi) return;

      try {
        const content = await file.text();
        setSpaceView('explore');
        setIsParsing(true);
        setMatchError(null);

        const result = await workerApi.parseFile(
          content,
          proxy((current: number, total: number) => {
            const progress = total > 0 ? (current / total) * 100 : 0;
            if (progressBarRef.current) progressBarRef.current.style.width = `${progress}%`;
            if (progressTextRef.current) progressTextRef.current.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} lines processed`;
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
            if (progressTextRef.current) progressTextRef.current.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} SNPs processed`;
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
    setMode('upload');
    setSpaceView('explore');
  }, []);

  const hasResults = !!matches && genosets !== null;
  const hasError = dbError || matchError || workerError;
  const isProcessing = isParsing || isMatching || isMatchingGenosets;

  const spaceLabel = (() => {
    if (spaceView === 'chat') return 'Ask Blue';
    if (mode === 'browse') return 'SNPedia database';
    if (hasResults) return 'Your results';
    return 'Upload your data';
  })();

  return (
    <main className={styles.content}>
        {/* Controller */}
        <aside className={styles.controller}>
          <div>
            <p className={styles.eyebrow}>Genomics Lab</p>
            <h1 className={styles.title}>Genetics Browser</h1>
            <p className={styles.subtitle}>
              Match your raw DNA against SNPedia, surface genosets, and flag
              pharmacogenomic interactions — processed entirely in your browser.
            </p>
          </div>

          <span className={styles.statusPill}>
            <span className={`${styles.statusDot} ${isDbLoading ? styles.statusDotLoading : ''}`} />
            {isDbLoading
              ? 'Loading SNP database…'
              : dbStats
                ? `${dbStats.totalSNPs.toLocaleString()} SNPs ready`
                : 'Database idle'}
          </span>

          <div className={styles.controllerSection}>
            <span className={styles.sectionLabel}>Source</span>
            <div className={styles.segmented}>
              <button
                type="button"
                onClick={() => { setMode('browse'); setSpaceView('explore'); }}
                disabled={isProcessing}
                className={`${styles.segmentBtn} ${mode === 'browse' && spaceView === 'explore' ? styles.segmentBtnActive : ''}`}
              >
                Browse database
              </button>
              <button
                type="button"
                onClick={() => { setMode('upload'); setSpaceView('explore'); }}
                disabled={isProcessing}
                className={`${styles.segmentBtn} ${mode === 'upload' && spaceView === 'explore' ? styles.segmentBtnActive : ''}`}
              >
                {hasResults ? 'Your results' : 'Upload data'}
              </button>
            </div>
          </div>

          <div className={styles.controllerSection}>
            <span className={styles.sectionLabel}>Workspace</span>
            <div className={styles.segmented}>
              <button
                type="button"
                onClick={() => setSpaceView('explore')}
                className={`${styles.segmentBtn} ${spaceView === 'explore' ? styles.segmentBtnActive : ''}`}
              >
                Explore
              </button>
              <button
                type="button"
                onClick={() => setSpaceView('chat')}
                className={`${styles.segmentBtn} ${spaceView === 'chat' ? styles.segmentBtnActive : ''}`}
              >
                Ask Blue
              </button>
            </div>
          </div>

          {hasResults && (
            <div className={styles.controllerSection}>
              <span className={styles.sectionLabel}>Loaded file</span>
              <p className={styles.fileSummary}>
                {parseResult?.genotypes.length.toLocaleString()} SNPs
                {detectedFormat && <> · <strong>{detectedFormat.replace('-', ' ')}</strong></>}
                {parseResult && parseResult.errors.length > 0 && ` · ${parseResult.errors.length} skipped`}
              </p>
              <button type="button" onClick={handleReset} className={styles.resetButton}>
                Upload new file
              </button>
            </div>
          )}

          <p className={styles.privacyNote}>
            <strong>Your DNA never leaves this device.</strong> Parsing and matching run
            locally in a Web Worker; the only network request downloads the public
            SNPedia database.
          </p>
        </aside>

        {/* Space */}
        <section className={styles.space}>
          <header className={styles.spaceHeader}>
            <span className={styles.spaceLabel}>{spaceLabel}</span>
            {hasResults && spaceView === 'explore' && mode !== 'browse' && (
              <span className={styles.spaceBadge}>
                {matches!.length.toLocaleString()} matched
              </span>
            )}
          </header>

          <div className={styles.spaceBody}>
            {spaceView === 'chat' ? (
              <div className={styles.output}>
                <GeneticsChat matches={matches} genosets={genosets} />
              </div>
            ) : isDbLoading ? (
              <div className={styles.stateCard}>
                <div className={styles.spinner} />
                <h2 className={styles.stateTitle}>Loading SNP database</h2>
                <div className={styles.progressBar}>
                  <div ref={progressBarRef} className={styles.progressFill} style={{ width: '0%' }} />
                </div>
                <p ref={progressTextRef} className={styles.progressText}>0% complete</p>
                <p className={styles.stateHint}>Fetching ~155MB of SNPedia data (about 30–60 seconds)</p>
              </div>
            ) : hasError ? (
              <div className={styles.stateCard}>
                <svg className={styles.errorIcon} width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <h2 className={styles.errorTitle}>Something went wrong</h2>
                <p className={styles.errorText}>
                  {dbError?.message || matchError?.message || workerError?.message || 'An unknown error occurred'}
                </p>
                <button onClick={() => window.location.reload()} className={styles.retryButton}>
                  Reload
                </button>
              </div>
            ) : isParsing ? (
              <div className={styles.stateCard}>
                <div className={styles.spinner} />
                <h2 className={styles.stateTitle}>Parsing your file</h2>
                <div className={styles.progressBar}>
                  <div ref={progressBarRef} className={styles.progressFill} style={{ width: '0%' }} />
                </div>
                <p ref={progressTextRef} className={styles.progressText}>0 / 0 lines processed</p>
              </div>
            ) : isMatching ? (
              <div className={styles.stateCard}>
                <div className={styles.spinner} />
                <h2 className={styles.stateTitle}>Matching SNPs against SNPedia</h2>
                {parseResult && (
                  <p className={styles.stateSubtext}>Found {parseResult.genotypes.length.toLocaleString()} SNPs in your file</p>
                )}
                <div className={styles.progressBar}>
                  <div ref={progressBarRef} className={`${styles.progressFill} ${styles.progressGreen}`} style={{ width: '0%' }} />
                </div>
                <p ref={progressTextRef} className={styles.progressText}>0 / 0 SNPs processed</p>
              </div>
            ) : isMatchingGenosets ? (
              <div className={styles.stateCard}>
                <div className={styles.spinner} />
                <h2 className={styles.stateTitle}>Finding matching genosets</h2>
                {matches && (
                  <p className={styles.stateSubtext}>Checking genosets against {matches.length.toLocaleString()} matched SNPs</p>
                )}
                <div className={styles.progressBar}>
                  <div ref={progressBarRef} className={`${styles.progressFill} ${styles.progressPurple}`} style={{ width: '0%' }} />
                </div>
                <p ref={progressTextRef} className={styles.progressText}>0 / 0 genosets checked</p>
              </div>
            ) : mode === 'browse' && workerApi ? (
              <div className={styles.output}>
                <SNPBrowser workerApi={workerApi} />
              </div>
            ) : hasResults && matches && genosets ? (
              <div className={styles.output}>
                <ResultsDisplay matches={matches} genosets={genosets} />
              </div>
            ) : (
              <div className={styles.stateCard}>
                <div className={styles.emptyDropzone}>
                  <FileUpload onFileSelect={handleFileSelect} />
                </div>
              </div>
            )}
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
          <aside className={styles.controller}>
            <div>
              <p className={styles.eyebrow}>Genomics Lab · Members only</p>
              <h1 className={styles.title}>Genetics Browser</h1>
              <p className={styles.subtitle}>
                A VIP membership perk. Match your raw DNA file (23andMe, AncestryDNA,
                MyHeritage, FamilyTreeDNA) against 110k+ SNPs from SNPedia, detect
                genosets, and flag pharmacogenomic interactions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProModal(true)}
              disabled={access === 'checking'}
              className={styles.unlockButton}
            >
              {access === 'checking' ? 'Checking membership…' : 'Unlock with VIP membership'}
            </button>
            <p className={styles.privacyNote}>
              <strong>Your DNA never leaves this device.</strong> All parsing and matching
              run locally in your browser — nothing is uploaded.
            </p>
          </aside>
          <section className={styles.space}>
            <header className={styles.spaceHeader}>
              <span className={styles.spaceLabel}>Locked</span>
              <span className={styles.spaceBadge}>VIP</span>
            </header>
            <div className={styles.spaceBody}>
              <div className={styles.stateCard}>
                <h2 className={styles.stateTitle}>Genetics Lab is a Pro feature</h2>
                <p className={styles.stateSubtext}>
                  Hold a VIP membership card to unlock browser-native genomics analysis.
                </p>
                <button
                  type="button"
                  onClick={() => setShowProModal(true)}
                  disabled={access === 'checking'}
                  className={styles.retryButton}
                >
                  {access === 'checking' ? 'Checking…' : 'View membership'}
                </button>
              </div>
            </div>
          </section>
        </main>
      )}
      <ProMembershipModal isOpen={showProModal} onClose={handleProModalClose} />
    </div>
  );
}
