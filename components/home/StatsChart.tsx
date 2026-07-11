'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/components/theme/ThemeProvider';
import styles from './StatsChart.module.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Series = {
  days: string[];
  missions: number[];
  notes: number[];
  balloons: number[];
  guides: number[];
};

// The app's established chart palette (see ResearchTab): green / blue / purple / orange.
const NOTES = '#74C465';
const MISSIONS = '#5168FF';
const GUIDES = '#9724A6';
const BALLOONS = '#FF7729';

const font = "'Space Grotesk', sans-serif";

// A gentle, obviously-decorative sample so the card always reads as a chart
// before any real activity exists. Never presented as the user's real numbers.
function sampleSeries(): Series {
  const today = new Date();
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const notes = days.map((_, i) => Math.max(0, Math.round(1.5 + 1.3 * Math.sin(i / 3))));
  const missions = days.map((_, i) => Math.max(0, Math.round(1 + Math.cos(i / 4))));
  const guides = days.map((_, i) => Math.max(0, Math.round(0.8 + 0.9 * Math.sin(i / 6 + 2))));
  const balloons = days.map((_, i) => Math.max(0, Math.round(18 + 13 * Math.sin(i / 5 + 1))));
  return { days, notes, missions, guides, balloons };
}

// Progressive "draw-on" line animation with easing: each point eases in from
// the previous point's position, staggered left → right.
function progressiveAnimation(pointCount: number) {
  const total = 1400;
  const step = pointCount > 0 ? total / pointCount : total;
  const prevY = (ctx: any) =>
    ctx.index === 0
      ? ctx.chart.scales.y.getPixelForValue(0)
      : ctx.chart
          .getDatasetMeta(ctx.datasetIndex)
          .data[ctx.index - 1].getProps(['y'], true).y;
  return {
    x: {
      type: 'number',
      easing: 'easeInOutCubic',
      duration: step,
      from: NaN,
      delay(ctx: any) {
        if (ctx.type !== 'data' || ctx.xStarted) return 0;
        ctx.xStarted = true;
        return ctx.index * step;
      },
    },
    y: {
      type: 'number',
      easing: 'easeInOutCubic',
      duration: step,
      from: prevY,
      delay(ctx: any) {
        if (ctx.type !== 'data' || ctx.yStarted) return 0;
        ctx.yStarted = true;
        return ctx.index * step;
      },
    },
  };
}

export default function StatsChart() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState<Series | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'sample'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/me/activity-series', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: Series) => {
        if (!alive) return;
        const hasAny = [json.missions, json.notes, json.balloons, json.guides].some((s) =>
          s?.some((v) => v > 0),
        );
        if (hasAny) {
          setData(json);
          setStatus('ready');
        } else {
          setData(sampleSeries());
          setStatus('sample');
        }
      })
      .catch(() => {
        if (!alive) return;
        setData(sampleSeries());
        setStatus('sample');
      });
    return () => {
      alive = false;
    };
  }, []);

  const isSample = status === 'sample';
  const gridColor = isDark ? 'rgba(235,232,247,0.10)' : 'rgba(26,27,36,0.07)';
  const tickColor = isDark ? 'rgba(235,232,247,0.55)' : '#6b6890';
  const labelColor = isDark ? 'rgba(247,245,255,0.88)' : '#1A1B24';
  const alpha = isSample ? 0.4 : 1;

  const chartData = useMemo(() => {
    if (!data) return null;
    const labels = data.days.map((d) => {
      const dt = new Date(`${d}T00:00:00Z`);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    });
    const rgba = (hex: string, a: number) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    const line = (label: string, values: number[], color: string, axis: 'y' | 'y1') => ({
      label,
      data: values,
      borderColor: rgba(color, alpha),
      backgroundColor: axis === 'y1' ? rgba(color, 0.13 * alpha) : 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: isSample ? 0 : 5,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: isDark ? '#191a26' : '#ffffff',
      pointHoverBackgroundColor: color,
      pointHitRadius: 12,
      tension: 0.35,
      fill: axis === 'y1',
      yAxisID: axis,
    });
    return {
      labels,
      datasets: [
        line('Field notes', data.notes, NOTES, 'y'),
        line('Missions', data.missions, MISSIONS, 'y'),
        line('Guides', data.guides, GUIDES, 'y'),
        line('Balloons', data.balloons, BALLOONS, 'y1'),
      ],
    };
  }, [data, alpha, isSample, isDark]);

  if (status === 'loading') return <div className={styles.state}>Loading your activity…</div>;

  const axisTicks = {
    font: { family: font, size: 9 },
    color: tickColor,
    precision: 0 as const,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // Top padding clears the "My Stats" title that overlays the chart's top-left.
    layout: { padding: { top: 30, right: 8, bottom: 2, left: 8 } },
    animation: progressiveAnimation(data?.days.length ?? 30),
    // Smoothly grow the hovered points so they "pop" as the cursor moves.
    transitions: { active: { animation: { duration: 300, easing: 'easeOutCubic' } } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 7,
          boxHeight: 7,
          padding: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { family: font, size: 10 },
          color: labelColor,
        },
      },
      tooltip: {
        enabled: !isSample,
        titleFont: { family: font, size: 11 },
        bodyFont: { family: font, size: 11 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { ...axisTicks, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
      },
      y: {
        position: 'left',
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: axisTicks,
      },
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: axisTicks,
      },
    },
  } as unknown as ChartOptions<'line'>;

  return (
    <div className={styles.chartBox}>
      <Line data={chartData!} options={options} />
    </div>
  );
}
