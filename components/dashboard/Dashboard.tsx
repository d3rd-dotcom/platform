'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { CourseData } from '@/lib/personal-course';
import styles from './Dashboard.module.css';

interface DashboardProps {
  course: CourseData;
  initialProgress?: Record<string, unknown>;
  initialIntake?: Record<string, string>;
}

interface Profile {
  username: string | null;
  avatarUrl: string | null;
}

interface LeaderUser {
  rank: number;
  username: string;
  avatarUrl: string | null;
  shards: number;
}

function avatarColor(name: string): string {
  const colors = ['#5168FF', '#E85D3A', '#62BE8F', '#9B7ED9', '#F5A623'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Radar graph ── default baseline: every axis starts even, not a fake stat line.
const RADAR_AXES = [
  { label: 'Focus', value: 50, color: '#5168FF' },
  { label: 'Consistency', value: 50, color: '#3D8BFF' },
  { label: 'Energy', value: 50, color: '#7B8FFF' },
  { label: 'Clarity', value: 50, color: '#C084FC' },
  { label: 'Rest', value: 50, color: '#E8556D' },
  { label: 'Momentum', value: 50, color: '#FF8844' },
];

function getRadarPoint(index: number, scale: number, radius = 80) {
  const angle = (index / RADAR_AXES.length) * 2 * Math.PI - Math.PI / 2;
  const r = radius * scale;
  return { x: 100 + r * Math.cos(angle), y: 100 + r * Math.sin(angle) };
}

function getRadarPoints(scales: number[], radius = 80) {
  return scales
    .map((scale, index) => {
      const point = getRadarPoint(index, scale, radius);
      return `${point.x},${point.y}`;
    })
    .join(' ');
}

function DashboardRadar() {
  return (
    <div className={styles.radarWrap}>
      <svg viewBox="0 0 200 200" className={styles.radarSvg}>
        {[1.0, 0.78, 0.56, 0.34].map((scale, ri) => (
          <polygon
            key={`fill-${ri}`}
            points={getRadarPoints(RADAR_AXES.map(() => scale))}
            fill={ri % 2 === 0 ? 'var(--radar-fill-a)' : 'var(--radar-fill-b)'}
            stroke="none"
          />
        ))}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, ri) => (
          <polygon
            key={ri}
            points={getRadarPoints(RADAR_AXES.map(() => scale))}
            fill="none"
            stroke="var(--radar-ring-color)"
            strokeWidth={ri === 4 ? '1.2' : '1'}
          />
        ))}
        {RADAR_AXES.map((axis, i) => {
          const point = getRadarPoint(i, 1);
          return (
            <line
              key={i}
              x1="100"
              y1="100"
              x2={point.x}
              y2={point.y}
              stroke={axis.color}
              strokeWidth="1"
              opacity="var(--radar-axis-opacity)"
            />
          );
        })}
        {RADAR_AXES.map((axis, index) => {
          const prev = (index - 1 + RADAR_AXES.length) % RADAR_AXES.length;
          const next = (index + 1) % RADAR_AXES.length;
          const scales = RADAR_AXES.map((_, i) => {
            if (i === index) return axis.value / 100;
            if (i === prev || i === next) return 0.46;
            return 0.18;
          });
          return (
            <polygon
              key={`facet-${axis.label}`}
              points={getRadarPoints(scales)}
              fill={`${axis.color}1F`}
              stroke={axis.color}
              strokeWidth="1.1"
              opacity="0.82"
            />
          );
        })}
        <polygon
          points={getRadarPoints(RADAR_AXES.map((axis) => axis.value / 100))}
          fill="var(--radar-data-fill)"
          stroke="var(--radar-data-stroke)"
          strokeWidth="1.4"
        />
        {RADAR_AXES.map((axis, i) => {
          const point = getRadarPoint(i, axis.value / 100);
          return (
            <circle
              key={`node-${axis.label}`}
              cx={point.x}
              cy={point.y}
              r="3.2"
              fill={axis.color}
              stroke="var(--radar-node-stroke)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      {RADAR_AXES.map((axis, i) => {
        const labelPoint = getRadarPoint(i, 1.2);
        return (
          <span
            key={axis.label}
            className={styles.radarLabel}
            style={{
              left: `${(labelPoint.x / 200) * 100}%`,
              top: `${(labelPoint.y / 200) * 100}%`,
              color: axis.color,
            }}
          >
            {axis.label}
          </span>
        );
      })}
    </div>
  );
}

export default function Dashboard({ initialIntake }: DashboardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [intake, setIntake] = useState<Record<string, string>>(initialIntake ?? {});
  const [soulOpen, setSoulOpen] = useState(false);
  const [soulDraft, setSoulDraft] = useState('');
  const [eggShaking, setEggShaking] = useState(false);

  const soul = intake.voiceContext ?? '';

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) {
          setProfile({ username: d.user.username ?? null, avatarUrl: d.user.avatarUrl ?? null });
        }
      })
      .catch(() => {/* guest — placeholder profile */});
  }, []);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setLeaderboard(Array.isArray(d.users) ? d.users : []))
      .catch(() => {/* leaderboard is best-effort */});
  }, []);

  const saveSoul = useCallback(() => {
    const next = { ...intake, voiceContext: soulDraft.trim() };
    setIntake(next);
    setSoulOpen(false);
    fetch('/api/course/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: next }),
    }).catch(() => {/* guests aren't persisted — local state still updates */});
  }, [intake, soulDraft]);

  const pokeEgg = useCallback(() => {
    setEggShaking(true);
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const doonga = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, start);
      osc.frequency.exponentialRampToValueAtTime(68, start + 0.2);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    };
    const now = ctx.currentTime;
    doonga(now + 0.02);
    doonga(now + 0.34);
    window.setTimeout(() => ctx.close(), 900);
  }, []);

  const displayName = profile?.username || 'Welcome';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'M';

  return (
    <div className={styles.dashboard}>
      {/* ── Left: profile + radar ── */}
      <aside className={styles.leftCol}>
        <div className={styles.profileCard}>
          <div className={styles.profileContent}>
            <div className={styles.profileAvatar}>
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={displayName} className={styles.profileAvatarImg} />
              ) : (
                <span className={styles.profileAvatarFallback}>{initial}</span>
              )}
            </div>
            <span className={styles.profileName}>{displayName}</span>
            <span className={styles.profileMeta}>Active Lab Guest</span>
            <button
              type="button"
              className={styles.soulBtn}
              onClick={() => {
                setSoulDraft(soul);
                setSoulOpen(true);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M9 13h6M9 17h4" />
              </svg>
              Soul.md
            </button>
          </div>
        </div>

        <div className={styles.radarCard}>
          <span className={styles.cardLabel}>Your DNA</span>
          <p className={styles.radarHint}>
            How it feels to be you right now.
          </p>
          <DashboardRadar />
        </div>
      </aside>

      {/* ── Center: egg ── */}
      <main className={styles.centerCol}>
        <div className={styles.eggCard}>
          <button
            type="button"
            className={styles.eggMedia}
            onClick={pokeEgg}
            aria-label="Poke your egg"
          >
            <Image
              src="/stories/week-01/egg.png"
              alt=""
              fill
              className={`${styles.eggImg}${eggShaking ? ` ${styles.eggShake}` : ''}`}
              onAnimationEnd={() => setEggShaking(false)}
              priority
            />
          </button>
          <div className={styles.eggCaption}>
            <span className={styles.cardLabel}>Your egg</span>
            <h1 className={styles.eggTitle}>Nurturing Your Potential</h1>
            <p className={styles.eggText}>
              Complete Academy activities, quests, and check-ins to earn shards
              and nurture what is growing inside. What will hatch?
            </p>
          </div>
        </div>
      </main>

      {/* ── Right: leaderboard + Blue ── */}
      <aside className={styles.rightCol}>
        <div className={styles.leaderboardCard}>
          <div className={styles.leaderHead}>
            <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
            <span className={styles.leaderTitle}>Leaderboard</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className={styles.leaderEmpty}>No rankings yet — be the first to show up.</p>
          ) : (
            <ul className={styles.leaderList}>
              {leaderboard.slice(0, 5).map((u) => (
                <li key={u.rank} className={styles.leaderRow}>
                  <span className={styles.leaderRank}>{u.rank}</span>
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatarUrl} alt={u.username} className={styles.leaderAvatar} />
                  ) : (
                    <span
                      className={styles.leaderAvatar}
                      style={{ background: avatarColor(u.username || '?') }}
                    >
                      {(u.username || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.leaderName}>{u.username}</span>
                  <span className={styles.leaderShards}>{u.shards}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.blueBodyWrap}>
          <Image
            src="/images/blue-fullbody.png"
            alt="Blue"
            width={861}
            height={1543}
            className={styles.blueBody}
            priority
          />
        </div>
      </aside>

      {/* ── Soul.md popup ── */}
      {soulOpen && (
        <div className={styles.modalOverlay} onClick={() => setSoulOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Soul.md</h2>
            <p className={styles.modalHint}>
              Context Blue keeps about you. She reads this so her help stays specific to who you are.
            </p>
            <textarea
              className={styles.modalTextarea}
              value={soulDraft}
              onChange={(e) => setSoulDraft(e.target.value)}
              rows={11}
              placeholder="Anything you want Blue to know — what you're working through, what matters, what to avoid…"
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setSoulOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.modalSave} onClick={saveSoul}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
