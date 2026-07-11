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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/components/theme/ThemeProvider';
import styles from './StatsChart.module.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Series = { days: string[]; missions: number[]; notes: number[]; balloons: number[] };

// The app's established chart palette (see ResearchTab): blue / green / orange.
const MISSIONS = '#5168FF';
const NOTES = '#74C465';
const BALLOONS = '#FF7729';

const font = "'Space Grotesk', sans-serif";

export default function StatsChart() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState<Series | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/me/activity-series', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: Series) => {
        if (!alive) return;
        setData(json);
        const hasAny = [json.missions, json.notes, json.balloons].some((s) => s?.some((v) => v > 0));
        setStatus(hasAny ? 'ready' : 'empty');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, []);

  const gridColor = isDark ? 'rgba(235,232,247,0.10)' : 'rgba(26,27,36,0.07)';
  const tickColor = isDark ? 'rgba(235,232,247,0.55)' : '#6b6890';
  const labelColor = isDark ? 'rgba(247,245,255,0.88)' : '#1A1B24';

  const chartData = useMemo(() => {
    if (!data) return null;
    // Show a short weekday-ish label only every ~5 days to avoid crowding.
    const labels = data.days.map((d) => {
      const dt = new Date(`${d}T00:00:00Z`);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    });
    const line = (label: string, values: number[], color: string, axis: 'y' | 'y1') => ({
      label,
      data: values,
      borderColor: color,
      backgroundColor: axis === 'y1' ? `${color}22` : 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color,
      tension: 0.35,
      fill: axis === 'y1',
      yAxisID: axis,
    });
    return {
      labels,
      datasets: [
        line('Field notes', data.notes, NOTES, 'y'),
        line('Missions', data.missions, MISSIONS, 'y'),
        line('Balloons popped', data.balloons, BALLOONS, 'y1'),
      ],
    };
  }, [data]);

  if (status === 'loading') return <div className={styles.state}>Loading your activity…</div>;
  if (status === 'error') return <div className={styles.state}>Could not load your stats.</div>;
  if (status === 'empty')
    return (
      <div className={styles.state}>
        No activity yet. Write a field note, finish a mission, or pop a balloon and it charts here.
      </div>
    );

  const axisTicks = {
    font: { family: font, size: 9 },
    color: tickColor,
    precision: 0 as const,
  };

  return (
    <div className={styles.chartBox}>
      <Line
        data={chartData!}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                font: { family: font, size: 10 },
                color: labelColor,
              },
            },
            tooltip: {
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
              title: { display: true, text: 'notes / missions', font: { family: font, size: 9 }, color: tickColor },
              grid: { color: gridColor },
              ticks: axisTicks,
            },
            y1: {
              position: 'right',
              beginAtZero: true,
              title: { display: true, text: 'balloons', font: { family: font, size: 9 }, color: tickColor },
              grid: { drawOnChartArea: false },
              ticks: axisTicks,
            },
          },
        }}
      />
    </div>
  );
}
