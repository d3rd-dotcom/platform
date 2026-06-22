'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter, Bar, Line } from 'react-chartjs-2';
import Image from 'next/image';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getTransferPayload, clearTransferPayload } from '@/lib/simulation-to-research';
import styles from './page.module.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// ── Types ────────────────────────────────────────────────
type ColumnType = 'numeric' | 'categorical';
interface ColumnDef { name: string; type: ColumnType; }
type DataRow = Record<string, string | number>;

type ChartType = 'scatter' | 'histogram' | 'bar' | 'line' | 'boxplot';
type TestType = 'ttest' | 'correlation' | 'regression' | 'anova';

// ── Stats Helpers ────────────────────────────────────────
function mean(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function variance(arr: number[]) {
  const m = mean(arr);
  return arr.length > 1 ? arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1) : 0;
}
function std(arr: number[]) { return Math.sqrt(variance(arr)); }
function round2(n: number) { return Math.round(n * 100) / 100; }
function median(arr: number[]) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pearson(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y);
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(x.reduce((s, xi) => s + Math.pow(xi - mx, 2), 0) * y.reduce((s, yi) => s + Math.pow(yi - my, 2), 0));
  return den === 0 ? 0 : num / den;
}

// ── Distribution Functions ──────────────────────────────
function lnGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let s = c[0];
  for (let i = 1; i < g + 2; i++) s += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(s);
}

function betaCF(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 3e-14;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBetaVal = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBetaVal);
  if (x > (a + 1) / (a + b + 2)) return 1 - regularizedIncompleteBeta(b, a, 1 - x);
  return front * betaCF(a, b, x) / a;
}

function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = 0.5 * regularizedIncompleteBeta(df / 2, 0.5, x);
  return t >= 0 ? 1 - p : p;
}

function fCDF(f: number, d1: number, d2: number): number {
  if (f <= 0) return 0;
  const x = d1 * f / (d1 * f + d2);
  return regularizedIncompleteBeta(d1 / 2, d2 / 2, x);
}

function pFromT(t: number, df: number): number { return 2 * (1 - tCDF(Math.abs(t), df)); }
function pFromF(f: number, d1: number, d2: number): number { return 1 - fCDF(f, d1, d2); }
function formatP(p: number): string { return p < 0.0001 ? '< .0001' : p.toFixed(4); }

// ── Extended Descriptive Stats ──────────────────────────
function quartile(arr: number[], q: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function skewness(arr: number[]): number {
  const n = arr.length;
  if (n < 3) return 0;
  const m = mean(arr), s = std(arr);
  if (s === 0) return 0;
  return (n / ((n - 1) * (n - 2))) * arr.reduce((a, v) => a + Math.pow((v - m) / s, 3), 0);
}

function kurtosis(arr: number[]): number {
  const n = arr.length;
  if (n < 4) return 0;
  const m = mean(arr), s = std(arr);
  if (s === 0) return 0;
  const sum4 = arr.reduce((a, v) => a + Math.pow((v - m) / s, 4), 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4 - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
}

function tTest(a: number[], b: number[]) {
  const na = a.length, nb = b.length;
  if (na < 2 || nb < 2) return null;
  const ma = mean(a), mb = mean(b), sa = std(a), sb = std(b);
  const se = Math.sqrt(sa * sa / na + sb * sb / nb);
  if (se === 0) return null;
  const t = (ma - mb) / se;
  const df = Math.pow(sa * sa / na + sb * sb / nb, 2) / (Math.pow(sa * sa / na, 2) / (na - 1) + Math.pow(sb * sb / nb, 2) / (nb - 1));
  const pooledSD = Math.sqrt(((na - 1) * sa * sa + (nb - 1) * sb * sb) / (na + nb - 2));
  const d = pooledSD > 0 ? (ma - mb) / pooledSD : 0;
  const p = pFromT(t, df);
  return { t: round2(t), df: round2(df), d: round2(d), ma: round2(ma), mb: round2(mb), na, nb, p };
}

function anova(groups: number[][]) {
  const allVals = groups.flat();
  const grandMean = mean(allVals);
  const k = groups.length;
  const N = allVals.length;
  if (k < 2 || N <= k) return null;
  const ssBetween = groups.reduce((s, g) => s + g.length * Math.pow(mean(g) - grandMean, 2), 0);
  const ssWithin = groups.reduce((s, g) => { const m = mean(g); return s + g.reduce((a, v) => a + Math.pow(v - m, 2), 0); }, 0);
  const dfBetween = k - 1;
  const dfWithin = N - k;
  if (dfWithin === 0 || ssWithin === 0) return null;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msBetween / msWithin;
  const p = pFromF(f, dfBetween, dfWithin);
  return { f: round2(f), dfBetween, dfWithin, p, msBetween: round2(msBetween), msWithin: round2(msWithin) };
}

function inferColumnType(values: string[]): ColumnType {
  const nonEmpty = values.filter(v => v.trim() !== '');
  if (nonEmpty.length === 0) return 'categorical';
  const numericCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  return numericCount / nonEmpty.length > 0.8 ? 'numeric' : 'categorical';
}

function parseCsv(text: string): { columns: ColumnDef[]; rows: DataRow[] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return { columns: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rawRows = lines.slice(1).map(line => {
    const vals: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    vals.push(current.trim());
    return vals;
  });

  const colValues = headers.map((_, ci) => rawRows.map(r => r[ci] || ''));
  const columns: ColumnDef[] = headers.map((name, ci) => ({ name, type: inferColumnType(colValues[ci]) }));
  const rows: DataRow[] = rawRows.map(vals => {
    const row: DataRow = {};
    headers.forEach((h, i) => {
      const v = vals[i] || '';
      row[h] = columns[i].type === 'numeric' && !isNaN(Number(v)) && v !== '' ? Number(v) : v;
    });
    return row;
  });
  return { columns, rows };
}

// ── Demo Data ────────────────────────────────────────────
const DEMO_CSV = `name,age,group,score,hours,satisfaction,region
Alice,28,A,82,12,4.2,North
Bob,35,B,67,8,3.1,South
Carol,22,A,91,15,4.7,North
David,41,B,58,6,2.8,East
Eve,30,A,88,14,4.5,West
Frank,27,B,72,9,3.4,South
Grace,33,A,95,16,4.9,North
Hank,45,B,54,5,2.5,East
Iris,29,A,85,13,4.3,West
Jack,38,B,63,7,3.0,South
Kim,24,A,90,15,4.6,North
Leo,36,B,60,6,2.9,East
Mia,31,A,87,14,4.4,West
Noah,42,B,55,5,2.6,South
Olga,26,A,93,16,4.8,North`;

// ── Chart Config ─────────────────────────────────────────
const monoFont = "'Departure Mono', monospace";
const buttonFont = "'Departure Mono', monospace";
const ACCENT_CLASSES = ['statTilePrimary', 'statTileAccent', 'statTileTertiary', 'statTileSecondary', 'statTileMental'] as const;
const CHART_COLORS = [
  { bg: 'rgba(81,104,255,0.6)', border: '#5168FF' },
  { bg: 'rgba(116,196,101,0.6)', border: '#74C465' },
  { bg: 'rgba(255,119,41,0.6)', border: '#FF7729' },
  { bg: 'rgba(151,36,166,0.6)', border: '#9724A6' },
  { bg: 'rgba(80,89,155,0.6)', border: '#50599B' },
  { bg: 'rgba(255,200,41,0.6)', border: '#E5B01A' },
];

export default function ResearchTab() {
  const { theme } = useTheme();
  // ── Data State ──────────────────────────────────────
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [inputMode, setInputMode] = useState<'csv' | 'manual'>('csv');
  const [csvText, setCsvText] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Manual mode
  const [schemaLocked, setSchemaLocked] = useState(false);
  const [schemaDraft, setSchemaDraft] = useState<ColumnDef[]>([{ name: '', type: 'numeric' }]);
  const [manualRow, setManualRow] = useState<Record<string, string>>({});

  // Chart state
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [chartX, setChartX] = useState('');
  const [chartY, setChartY] = useState('');
  const [chartGroup, setChartGroup] = useState('');
  const [chartBins, setChartBins] = useState(5);

  // Correlation state
  const [corrSelected, setCorrSelected] = useState<string[]>([]);

  // Test state
  const [testType, setTestType] = useState<TestType>('ttest');
  const [testGroupVar, setTestGroupVar] = useState('');
  const [testGroup1, setTestGroup1] = useState('');
  const [testGroup2, setTestGroup2] = useState('');
  const [testOutcomeVar, setTestOutcomeVar] = useState('');
  const [testVar1, setTestVar1] = useState('');
  const [testVar2, setTestVar2] = useState('');
  const [testResult, setTestResult] = useState<Record<string, string | number> | null>(null);
  const [testLabel, setTestLabel] = useState('');

  const [dragging, setDragging] = useState(false);

  // Blue panel state
  const [blueGenerated, setBlueGenerated] = useState(false);
  const [blueRating, setBlueRating] = useState<'up' | 'down' | null>(null);

  // Chart ref for export
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const numericCols = columns.filter(c => c.type === 'numeric');
  const categoricalCols = columns.filter(c => c.type === 'categorical');
  const n = rows.length;
  const isDarkTheme = theme === 'dark';
  const gridColor = isDarkTheme ? 'rgba(235,232,247,0.12)' : 'rgba(26,27,36,0.08)';
  const tickColor = isDarkTheme ? 'rgba(235,232,247,0.62)' : '#6b6890';
  const labelColor = isDarkTheme ? 'rgba(247,245,255,0.9)' : '#1A1B24';
  const chartCanvasBackground = isDarkTheme ? '#191a26' : '#ffffff';

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const colVals = (col: string) => rows.map(r => r[col]).filter((v): v is number => typeof v === 'number');

  const loadData = useCallback((cols: ColumnDef[], data: DataRow[]) => {
    setColumns(cols);
    setRows(data);
    const numCols = cols.filter(c => c.type === 'numeric').map(c => c.name);
    setCorrSelected(numCols);
    // Auto-set chart defaults
    if (numCols.length >= 2) { setChartX(numCols[0]); setChartY(numCols[1]); }
    else if (numCols.length >= 1) { setChartX(numCols[0]); }
    setChartGroup('');
    // Auto-set test defaults
    const catCols = cols.filter(c => c.type === 'categorical');
    if (catCols.length > 0 && numCols.length > 0) {
      setTestGroupVar(catCols[0].name);
      setTestOutcomeVar(numCols[0]);
    }
    if (numCols.length >= 2) { setTestVar1(numCols[0]); setTestVar2(numCols[1]); }
    setTestResult(null);
    setBlueGenerated(false);
    setBlueRating(null);
    showToast(`DATASET LOADED — N=${data.length}, ${cols.length} VARIABLES`);
  }, [showToast]);

  // Auto-load simulation data transferred from Step 5
  useEffect(() => {
    const payload = getTransferPayload();
    if (payload && payload.csv) {
      const { columns: cols, rows: data } = parseCsv(payload.csv);
      if (cols.length > 0 && data.length > 0) {
        loadData(cols, data);
      }
      clearTransferPayload();
    }
  }, [loadData, showToast]);

  const parseAndLoad = useCallback((text: string) => {
    setParsing(true);
    // Defer heavy parsing so UI can show loading state first
    setTimeout(() => {
      const { columns: cols, rows: data } = parseCsv(text);
      if (cols.length === 0 || data.length === 0) {
        showToast('COULD NOT PARSE CSV — CHECK FORMAT');
      } else {
        loadData(cols, data);
      }
      setParsing(false);
    }, 0);
  }, [loadData, showToast]);

  const handleCsvImport = () => {
    const text = csvText.trim();
    if (!text) { showToast('PASTE CSV DATA FIRST'); return; }
    parseAndLoad(text);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parseAndLoad(text);
    };
    reader.readAsText(file);
  };

  const loadDemo = () => {
    setCsvText(DEMO_CSV);
    const { columns: cols, rows: data } = parseCsv(DEMO_CSV);
    loadData(cols, data);
  };

  // Manual mode
  const addSchemaCol = () => setSchemaDraft(prev => [...prev, { name: '', type: 'numeric' }]);
  const removeSchemaCol = (i: number) => setSchemaDraft(prev => prev.filter((_, idx) => idx !== i));
  const updateSchemaCol = (i: number, field: 'name' | 'type', value: string) => {
    setSchemaDraft(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const lockSchema = () => {
    const valid = schemaDraft.filter(c => c.name.trim() !== '');
    if (valid.length === 0) { showToast('ADD AT LEAST ONE COLUMN'); return; }
    const cols = valid.map(c => ({ name: c.name.trim(), type: c.type as ColumnType }));
    setColumns(cols);
    setRows([]);
    setCorrSelected(cols.filter(c => c.type === 'numeric').map(c => c.name));
    setSchemaLocked(true);
    showToast(`SCHEMA LOCKED — ${cols.length} COLUMNS`);
  };

  const addManualRow = () => {
    const row: DataRow = {};
    let valid = true;
    columns.forEach(c => {
      const v = manualRow[c.name] || '';
      if (c.type === 'numeric') {
        if (v === '' || isNaN(Number(v))) { valid = false; }
        else { row[c.name] = Number(v); }
      } else {
        row[c.name] = v;
      }
    });
    if (!valid) { showToast('FILL ALL NUMERIC FIELDS WITH VALID NUMBERS'); return; }
    setRows(prev => [...prev, row]);
    setManualRow({});
    showToast(`ROW ${rows.length + 1} ADDED`);
  };

  const resetSchema = () => {
    setSchemaLocked(false);
    setColumns([]);
    setRows([]);
    setSchemaDraft([{ name: '', type: 'numeric' }]);
    setManualRow({});
  };

  // ── Correlation helpers ────────────────────────────
  const toggleCorrCol = (name: string) => {
    setCorrSelected(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  };
  const selectAllCorr = () => setCorrSelected(numericCols.map(c => c.name));

  // ── Run statistical test ──────────────────────────
  const runTest = () => {
    if (n < 3) { showToast('NEED AT LEAST 3 ROWS'); return; }

    if (testType === 'ttest') {
      if (!testGroupVar || !testOutcomeVar || !testGroup1 || !testGroup2) { showToast('SELECT ALL VARIABLES'); return; }
      const a = rows.filter(r => String(r[testGroupVar]) === testGroup1).map(r => r[testOutcomeVar]).filter((v): v is number => typeof v === 'number');
      const b = rows.filter(r => String(r[testGroupVar]) === testGroup2).map(r => r[testOutcomeVar]).filter((v): v is number => typeof v === 'number');
      const result = tTest(a, b);
      if (!result) { showToast('NOT ENOUGH DATA IN EACH GROUP'); return; }
      const dInterp = Math.abs(result.d) >= 0.8 ? 'large' : Math.abs(result.d) >= 0.5 ? 'medium' : 'small';
      setTestResult({
        [`M (${testGroup1})`]: result.ma,
        [`M (${testGroup2})`]: result.mb,
        [`n (${testGroup1})`]: result.na,
        [`n (${testGroup2})`]: result.nb,
        't-statistic': result.t,
        'df': result.df,
        'p-value': formatP(result.p),
        [`Cohen's d`]: `${result.d} (${dInterp})`,
      });
      setTestLabel(`Independent Samples t-Test: ${testOutcomeVar} by ${testGroupVar}`);
    } else if (testType === 'correlation') {
      if (!testVar1 || !testVar2) { showToast('SELECT TWO VARIABLES'); return; }
      const x = colVals(testVar1), y = colVals(testVar2);
      if (x.length < 3 || y.length < 3) { showToast('NOT ENOUGH NUMERIC DATA'); return; }
      const minLen = Math.min(x.length, y.length);
      const r = pearson(x.slice(0, minLen), y.slice(0, minLen));
      const tStat = minLen > 2 ? r * Math.sqrt((minLen - 2) / (1 - r * r)) : 0;
      const pVal = minLen > 2 ? pFromT(tStat, minLen - 2) : 1;
      setTestResult({
        'Pearson r': round2(r),
        'r\u00B2': round2(r * r),
        'N (pairs)': minLen,
        't-statistic': round2(tStat),
        'p-value': formatP(pVal),
      });
      setTestLabel(`Pearson Correlation: ${testVar1} \u00D7 ${testVar2}`);
    } else if (testType === 'regression') {
      if (!testVar1 || !testVar2) { showToast('SELECT DEPENDENT AND INDEPENDENT VARIABLES'); return; }
      const y = colVals(testVar1), x = colVals(testVar2);
      if (x.length < 3 || y.length < 3) { showToast('NOT ENOUGH NUMERIC DATA'); return; }
      const minLen = Math.min(x.length, y.length);
      const xSlice = x.slice(0, minLen), ySlice = y.slice(0, minLen);
      const r = pearson(xSlice, ySlice);
      const slopeVal = std(ySlice) !== 0 ? r * (std(ySlice) / (std(xSlice) || 1)) : 0;
      const interceptVal = mean(ySlice) - slopeVal * mean(xSlice);
      const tSlope = minLen > 2 ? r * Math.sqrt((minLen - 2) / (1 - r * r)) : 0;
      const pSlope = minLen > 2 ? pFromT(tSlope, minLen - 2) : 1;
      setTestResult({
        [`Intercept (\u03B2\u2080)`]: round2(interceptVal),
        [`Slope (\u03B2\u2081)`]: round2(slopeVal),
        'Slope t-stat': round2(tSlope),
        'Slope p-value': formatP(pSlope),
        'Pearson r': round2(r),
        'R\u00B2': `${round2(r * r * 100)}%`,
        'Equation': `\u0176 = ${round2(slopeVal)}x + ${round2(interceptVal)}`,
      });
      setTestLabel(`OLS Regression: ${testVar1} ~ ${testVar2}`);
    } else if (testType === 'anova') {
      if (!testGroupVar || !testOutcomeVar) { showToast('SELECT GROUPING AND OUTCOME VARIABLES'); return; }
      const groupNames = [...new Set(rows.map(r => String(r[testGroupVar])))];
      const groups = groupNames.map(g => rows.filter(r => String(r[testGroupVar]) === g).map(r => r[testOutcomeVar]).filter((v): v is number => typeof v === 'number'));
      const validGroups = groups.filter(g => g.length > 0);
      if (validGroups.length < 2) { showToast('NEED AT LEAST 2 GROUPS WITH DATA'); return; }
      const result = anova(validGroups);
      if (!result) { showToast('CANNOT COMPUTE ANOVA — CHECK DATA'); return; }
      setTestResult({
        'F-statistic': result.f,
        'df (between)': result.dfBetween,
        'df (within)': result.dfWithin,
        'MS (between)': result.msBetween,
        'MS (within)': result.msWithin,
        'p-value': formatP(result.p),
        'Groups': groupNames.join(', '),
      });
      setTestLabel(`One-Way ANOVA: ${testOutcomeVar} by ${testGroupVar}`);
    }
    showToast('TEST COMPLETE');
  };

  // Unique values for a categorical column
  const uniqueVals = (col: string) => [...new Set(rows.map(r => String(r[col])))];

  // ── Correlation matrix data ────────────────────────
  const corrCols = corrSelected.filter(c => numericCols.some(nc => nc.name === c));
  const corrData = corrCols.map(c => colVals(c));

  // ── Chart rendering ────────────────────────────────
  const renderChart = () => {
    if (n === 0) return <div className={styles.emptyState}><p className={styles.emptyStateText}>Load data to see charts</p></div>;

    if (chartType === 'scatter') {
      if (!chartX || !chartY) return <div className={styles.emptyState}><p className={styles.emptyStateText}>Select X and Y variables</p></div>;
      const xVals = colVals(chartX), yVals = colVals(chartY);
      const minLen = Math.min(xVals.length, yVals.length);
      if (chartGroup && categoricalCols.some(c => c.name === chartGroup)) {
        const groups = uniqueVals(chartGroup);
        const datasets = groups.map((g, gi) => {
          const indices = rows.map((r, i) => String(r[chartGroup]) === g ? i : -1).filter(i => i >= 0 && i < minLen);
          return {
            label: g,
            data: indices.map(i => ({ x: xVals[i], y: yVals[i] })),
            backgroundColor: CHART_COLORS[gi % CHART_COLORS.length].bg,
            borderColor: CHART_COLORS[gi % CHART_COLORS.length].border,
            borderWidth: 2, pointRadius: 6,
          };
        });
        return <Scatter data={{ datasets }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: monoFont, size: 10 }, color: labelColor } } }, scales: { x: { title: { display: true, text: chartX, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } }, y: { title: { display: true, text: chartY, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } } } }} />;
      }
      const data = xVals.slice(0, minLen).map((x, i) => ({ x, y: yVals[i] }));
      return <Scatter data={{ datasets: [{ label: `${chartX} vs ${chartY}`, data, backgroundColor: 'rgba(81,104,255,0.6)', borderColor: '#5168FF', borderWidth: 2, pointRadius: 6 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: monoFont, size: 10 }, color: labelColor } } }, scales: { x: { title: { display: true, text: chartX, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } }, y: { title: { display: true, text: chartY, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } } } }} />;
    }

    if (chartType === 'histogram') {
      if (!chartX) return <div className={styles.emptyState}><p className={styles.emptyStateText}>Select a variable</p></div>;
      const vals = colVals(chartX);
      if (vals.length === 0) return <div className={styles.emptyState}><p className={styles.emptyStateText}>No numeric data for {chartX}</p></div>;
      const minV = Math.min(...vals), maxV = Math.max(...vals);
      const binWidth = (maxV - minV) / chartBins || 1;
      const binLabels = Array.from({ length: chartBins }, (_, i) => `${round2(minV + i * binWidth)}\u2013${round2(minV + (i + 1) * binWidth)}`);
      const binCounts = binLabels.map((_, i) => vals.filter(v => v >= minV + i * binWidth && (i === chartBins - 1 ? v <= minV + (i + 1) * binWidth : v < minV + (i + 1) * binWidth)).length);
      return <Bar data={{ labels: binLabels, datasets: [{ data: binCounts, backgroundColor: CHART_COLORS.map(c => c.bg), borderColor: CHART_COLORS.map(c => c.border), borderWidth: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: chartX, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { display: false }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } }, y: { title: { display: true, text: 'Frequency', font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor }, beginAtZero: true } } }} />;
    }

    if (chartType === 'bar') {
      if (!chartX || !chartY) return <div className={styles.emptyState}><p className={styles.emptyStateText}>Select category and value variables</p></div>;
      const cats = uniqueVals(chartX);
      const means = cats.map(c => { const vals = rows.filter(r => String(r[chartX]) === c).map(r => r[chartY]).filter((v): v is number => typeof v === 'number'); return mean(vals); });
      return <Bar data={{ labels: cats, datasets: [{ label: `Mean ${chartY} by ${chartX}`, data: means, backgroundColor: cats.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].bg), borderColor: cats.map((_, i) => CHART_COLORS[i % CHART_COLORS.length].border), borderWidth: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: monoFont, size: 10 }, color: labelColor } } }, scales: { x: { title: { display: true, text: chartX, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { display: false }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } }, y: { title: { display: true, text: `Mean ${chartY}`, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor }, beginAtZero: true } } }} />;
    }

    if (chartType === 'line') {
      if (!chartX || !chartY) return <div className={styles.emptyState}><p className={styles.emptyStateText}>Select X and Y variables</p></div>;
      const xVals = rows.map(r => r[chartX]);
      const yVals = rows.map(r => r[chartY]).filter((v): v is number => typeof v === 'number');
      const labels = xVals.map(v => String(v));
      return <Line data={{ labels, datasets: [{ label: `${chartY} over ${chartX}`, data: yVals, borderColor: '#5168FF', backgroundColor: 'rgba(81,104,255,0.1)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#5168FF', fill: true, tension: 0.3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: monoFont, size: 10 }, color: labelColor } } }, scales: { x: { title: { display: true, text: chartX, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } }, y: { title: { display: true, text: chartY, font: { family: buttonFont, size: 10 }, color: tickColor }, grid: { color: gridColor }, ticks: { font: { family: monoFont, size: 9 }, color: tickColor } } } }} />;
    }

    if (chartType === 'boxplot') {
      if (!chartX || !chartY) return <div className={styles.emptyState}><p className={styles.emptyStateText}>Select a grouping variable (X) and numeric variable (Y)</p></div>;
      const groups = uniqueVals(chartX);
      const groupStats = groups.map(g => {
        const vals = rows.filter(r => String(r[chartX]) === g).map(r => r[chartY]).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
        if (vals.length === 0) return null;
        return { name: g, min: vals[0], q1: quartile(vals, 0.25), med: median(vals), q3: quartile(vals, 0.75), max: vals[vals.length - 1], n: vals.length };
      }).filter(Boolean) as { name: string; min: number; q1: number; med: number; q3: number; max: number; n: number }[];
      if (groupStats.length === 0) return <div className={styles.emptyState}><p className={styles.emptyStateText}>No numeric data for selected groups</p></div>;
      const globalMin = Math.min(...groupStats.map(g => g.min));
      const globalMax = Math.max(...groupStats.map(g => g.max));
      const range = globalMax - globalMin || 1;
      const pad = range * 0.05;
      const yMin = globalMin - pad, yMax = globalMax + pad;
      const yRange = yMax - yMin;
      const svgW = 600, svgH = 240, leftPad = 50, rightPad = 20, topPad = 10, botPad = 30;
      const plotW = svgW - leftPad - rightPad, plotH = svgH - topPad - botPad;
      const boxW = Math.min(60, plotW / groupStats.length * 0.6);
      const toY = (v: number) => topPad + plotH - ((v - yMin) / yRange) * plotH;
      const ticks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4);

      return (
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className={styles.boxPlotSvg}>
          {/* Y-axis ticks */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={leftPad} y1={toY(t)} x2={leftPad + plotW} y2={toY(t)} stroke={gridColor} strokeWidth={1} />
              <text x={leftPad - 6} y={toY(t) + 3} textAnchor="end" fill={tickColor} fontSize={9} fontFamily="'Departure Mono', monospace">{round2(t)}</text>
            </g>
          ))}
          {/* Boxes */}
          {groupStats.map((g, i) => {
            const cx = leftPad + (plotW / groupStats.length) * (i + 0.5);
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <g key={g.name}>
                {/* Whisker line */}
                <line x1={cx} y1={toY(g.max)} x2={cx} y2={toY(g.min)} stroke={color.border} strokeWidth={1.5} />
                {/* Whisker caps */}
                <line x1={cx - boxW * 0.3} y1={toY(g.max)} x2={cx + boxW * 0.3} y2={toY(g.max)} stroke={color.border} strokeWidth={2} />
                <line x1={cx - boxW * 0.3} y1={toY(g.min)} x2={cx + boxW * 0.3} y2={toY(g.min)} stroke={color.border} strokeWidth={2} />
                {/* IQR box */}
                <rect x={cx - boxW / 2} y={toY(g.q3)} width={boxW} height={toY(g.q1) - toY(g.q3)} fill={color.bg} stroke={color.border} strokeWidth={2} />
                {/* Median line */}
                <line x1={cx - boxW / 2} y1={toY(g.med)} x2={cx + boxW / 2} y2={toY(g.med)} stroke={color.border} strokeWidth={3} />
                {/* Group label */}
                <text x={cx} y={svgH - 8} textAnchor="middle" fill={labelColor} fontSize={10} fontFamily="'Departure Mono', monospace" fontWeight={600}>{g.name}</text>
                {/* N label */}
                <text x={cx} y={svgH - 19} textAnchor="middle" fill={tickColor} fontSize={8} fontFamily="'Departure Mono', monospace">n={g.n}</text>
              </g>
            );
          })}
          {/* Y-axis label */}
          <text x={12} y={topPad + plotH / 2} textAnchor="middle" fill={tickColor} fontSize={10} fontFamily="'Departure Mono', monospace" transform={`rotate(-90, 12, ${topPad + plotH / 2})`}>{chartY}</text>
        </svg>
      );
    }

    return null;
  };

  // ── Matrix cell class ─────────────────────────────
  const getMatrixCellClass = (i: number, j: number, r: number) => {
    if (i === j) return styles.matrixDiag;
    if (r > 0.5) return styles.matrixHighPos;
    if (r > 0.2) return styles.matrixModPos;
    if (r < -0.2) return styles.matrixNeg;
    return styles.matrixLow;
  };

  const getFindingClass = (cls: string) => {
    if (cls === 'sig') return `${styles.findingTag} ${styles.findingTagSig}`;
    if (cls === 'warn') return `${styles.findingTag} ${styles.findingTagWarn}`;
    return `${styles.findingTag} ${styles.findingTagInfo}`;
  };

  // ── Blue Interpretation (computed only when generated) ──
  const computeBlueInterpretation = () => {
    if (n < 3) return { text: '', findings: [] as { cls: string; label: string }[] };
    const numNames = numericCols.map(c => c.name);
    const catNames = categoricalCols.map(c => c.name);
    let text = `Dataset: N=${n} observations across ${columns.length} variables (${numNames.length} numeric, ${catNames.length} categorical). `;
    const top3 = numNames.slice(0, 3);
    if (top3.length > 0) {
      text += top3.map(c => { const v = colVals(c); return `${c}: M=${round2(mean(v))}, SD=${round2(std(v))}`; }).join('; ') + '. ';
    }
    if (corrCols.length >= 2) {
      let maxR = 0, maxPair = '';
      for (let i = 0; i < corrCols.length; i++) {
        for (let j = i + 1; j < corrCols.length; j++) {
          const r = Math.abs(pearson(corrData[i], corrData[j]));
          if (r > maxR) { maxR = r; maxPair = `${corrCols[i]}\u2194${corrCols[j]}`; }
        }
      }
      if (maxR > 0) text += `Strongest correlation: r(${maxPair})=${round2(maxR)}. `;
    }
    if (testResult && testLabel) text += `Last test: ${testLabel}. `;
    if (n < 30) text += 'Note: N<30 limits statistical power; interpret with caution.';
    const findings = [
      { cls: 'info', label: `N = ${n}` },
      { cls: 'info', label: `${numNames.length} NUMERIC` },
      { cls: 'info', label: `${catNames.length} CATEGORICAL` },
      { cls: n >= 30 ? 'sig' : 'warn', label: n >= 30 ? 'POWER: ADEQUATE' : 'POWER: LOW (N<30)' },
    ];
    return { text, findings };
  };

  // ── Blue rating localStorage helpers ──
  const getDatasetHash = () => {
    const str = rows.map(r => Object.values(r).join(',')).join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return `blue-rating-${hash}`;
  };

  const handleBlueGenerate = () => {
    setBlueGenerated(true);
    // Load persisted rating for this dataset
    try {
      const saved = localStorage.getItem(getDatasetHash());
      setBlueRating(saved === 'up' || saved === 'down' ? saved : null);
    } catch { setBlueRating(null); }
  };

  const handleBlueRate = (rating: 'up' | 'down') => {
    const next = blueRating === rating ? null : rating;
    setBlueRating(next);
    try {
      if (next) localStorage.setItem(getDatasetHash(), next);
      else localStorage.removeItem(getDatasetHash());
    } catch { /* noop */ }
    showToast(next ? 'FEEDBACK RECORDED' : 'FEEDBACK CLEARED');
  };

  // ── Export helpers ──────────────────────────────────
  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportResults = () => {
    if (n === 0) { showToast('NO DATA TO EXPORT'); return; }
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const svgChartW = 520, svgChartH = 220;

    function barChartSVG(data: {label: string; value: number}[], title: string, color: string) {
      if (data.length === 0) return '';
      const maxV = Math.max(...data.map(d => Math.abs(d.value)), 0.01);
      const padL = 60, padR = 20, padT = 20, padB = 40;
      const cw = svgChartW - padL - padR;
      const ch = svgChartH - padT - padB;
      const barW = Math.min(40, cw / data.length - 8);
      const bars = data.map((d, i) => {
        const x = padL + (cw / data.length) * i + (cw / data.length - barW) / 2;
        const h = (Math.abs(d.value) / maxV) * ch;
        const y = d.value >= 0 ? padT + ch - h : padT + ch;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${color}" opacity="0.85"/>
<text x="${x + barW / 2}" y="${svgChartH - 6}" text-anchor="middle" font-size="10" fill="rgba(232,230,240,0.6)">${d.label}</text>
<text x="${x + barW / 2}" y="${d.value >= 0 ? y - 6 : y + h + 14}" text-anchor="middle" font-size="10" fill="${color}">${round2(d.value)}</text>`;
      }).join('\n');
      return `<div class="sec"><h2>${title}</h2><svg width="${svgChartW}" height="${svgChartH}" viewBox="0 0 ${svgChartW} ${svgChartH}">
<line x1="${padL}" y1="${padT + ch}" x2="${padL + cw}" y2="${padT + ch}" stroke="rgba(255,255,255,0.1)"/>
${bars}</svg></div>`;
    }

    function histSVG(vals: number[], label: string) {
      if (vals.length < 3) return '';
      const bins = 8;
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const bw = (mx - mn) / bins || 1;
      const counts = Array(bins).fill(0);
      vals.forEach(v => { const i = Math.min(Math.floor((v - mn) / bw), bins - 1); counts[i]++; });
      const maxC = Math.max(...counts, 1);
      const padL = 50, padR = 20, padT = 20, padB = 40;
      const cw = svgChartW - padL - padR, ch = svgChartH - padT - padB;
      const barW = cw / bins - 2;
      const bars = counts.map((c, i) => {
        const x = padL + (cw / bins) * i + 1;
        const h = (c / maxC) * ch;
        const y = padT + ch - h;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="2" fill="var(--color-primary)" opacity="0.75"/>`;
      }).join('\n');
      return `<div class="sec"><h2>Distribution: ${label}</h2><svg width="${svgChartW}" height="${svgChartH}" viewBox="0 0 ${svgChartW} ${svgChartH}">
<line x1="${padL}" y1="${padT + ch}" x2="${padL + cw}" y2="${padT + ch}" stroke="rgba(255,255,255,0.1)"/>
${bars}
<text x="${padL}" y="${svgChartH - 6}" font-size="9" fill="rgba(232,230,240,0.4)">${round2(mn)}</text>
<text x="${padL + cw}" y="${svgChartH - 6}" text-anchor="end" font-size="9" fill="rgba(232,230,240,0.4)">${round2(mx)}</text>
</svg></div>`;
    }

    let cssVars = `--color-primary: #8b95ff;`;
    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>R-Tool Report</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0c0d17;color:#e8e6f0;padding:40px;${cssVars}}
.report{max-width:960px;margin:0 auto}
h1{font-size:28px;font-weight:700;letter-spacing:-0.02em;margin-bottom:2px;background:linear-gradient(135deg,#8b95ff,#a78bfa,#f2a0b5);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.meta{color:rgba(232,230,240,0.45);font-size:13px;margin-bottom:6px}
.summary{display:flex;gap:12px;margin-bottom:32px;flex-wrap:wrap}
.stat{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;flex:1;min-width:120px;text-align:center}
.stat-n{font-size:28px;font-weight:700;color:#c8c6ff}
.stat-l{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(232,230,240,0.45);margin-top:4px}
.sec{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:24px}
.sec h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(232,230,240,0.55);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)}
table{width:100%;border-collapse:collapse;font-size:12px;font-family:'SF Mono',Consolas,monospace}
th{text-align:left;padding:6px 10px;color:rgba(232,230,240,0.45);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid rgba(255,255,240,0.08)}
td{padding:6px 10px;border-bottom:1px solid rgba(255,255,240,0.04)}
.lk{color:rgba(232,230,240,0.65)}
.rv{color:#c8c6ff;font-weight:600;text-align:right}
.bar{display:inline-block;height:6px;border-radius:3px;vertical-align:middle}
.matrix{display:grid;gap:3px}
.mc{text-align:center;padding:6px;border-radius:4px;font-size:11px;font-weight:600;font-family:'SF Mono',Consolas,monospace}
.mh{color:rgba(232,230,240,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.06em}
.trr{color:#8cf2bd}
.trv{color:#c8c6ff}
svg{display:block;margin:0 auto}
</style></head><body><div class="report">
<h1>Statistical Report</h1>
<div class="meta">R-Tool Workbench &middot; ${ts}</div>
<div class="summary">
<div class="stat"><div class="stat-n">${n}</div><div class="stat-l">Observations</div></div>
<div class="stat"><div class="stat-n">${columns.length}</div><div class="stat-l">Variables</div></div>
<div class="stat"><div class="stat-n">${numericCols.length}</div><div class="stat-l">Numeric</div></div>
<div class="stat"><div class="stat-n">${categoricalCols.length}</div><div class="stat-l">Categorical</div></div>
</div>`;

    // Data table
    html += `<div class="sec"><h2>Data Table (${n} rows)</h2><div style="overflow-x:auto"><table><tr>${columns.map(c => `<th>${c.name}</th>`).join('')}</tr>`;
    rows.forEach(r => {
      html += `<tr>${columns.map(c => `<td class="rv">${typeof r[c.name] === 'number' ? round2(r[c.name] as number) : String(r[c.name] ?? '')}</td>`).join('')}</tr>`;
    });
    html += `</table></div></div>`;

    // Bar chart of means
    if (numericCols.length > 0) {
      const meansData = numericCols.map(c => ({label: c.name, value: mean(colVals(c.name))}));
      html += barChartSVG(meansData, 'Variable Means', '#8b95ff');
    }

    // Histograms for numeric columns
    numericCols.forEach(col => {
      html += histSVG(colVals(col.name), col.name);
    });

    // Descriptive stats table
    html += `<div class="sec"><h2>Descriptive Statistics</h2><table><tr>${['Variable','Mean','SD','Median','Min','Max','Q1','Q3','Skew','Kurt'].map(h => `<th>${h}</th>`).join('')}</tr>`;
    numericCols.forEach(col => {
      const v = colVals(col.name);
      html += `<tr><td class="lk">${col.name}</td>${[mean(v), std(v), median(v), Math.min(...v), Math.max(...v), quartile(v, 0.25), quartile(v, 0.75), skewness(v), kurtosis(v)].map(x => `<td class="rv">${round2(x)}</td>`).join('')}</tr>`;
    });
    html += `</table></div>`;

    // Correlation heatmap
    if (corrCols.length >= 2) {
      const nc = corrCols.length;
      html += `<div class="sec"><h2>Pearson Correlation Matrix</h2><div class="matrix" style="grid-template-columns:${'auto '.repeat(nc + 1)}">`;
      html += `<div class="mc mh"></div>`;
      corrCols.forEach(c => { html += `<div class="mc mh">${c}</div>`; });
      corrCols.forEach((rowC, i) => {
        html += `<div class="mc mh">${rowC}</div>`;
        corrCols.forEach((colC, j) => {
          const r = i === j ? 1 : pearson(corrData[i], corrData[j]);
          const abs = Math.abs(r);
          const hue = r >= 0 ? 140 : 20;
          html += `<div class="mc" style="background:hsla(${hue},${Math.round(abs * 80 + 10)}%,50%,${abs * 0.5 + 0.1});color:hsl(${hue},40%,85%);border:1px solid hsla(${hue},${Math.round(abs * 80 + 10)}%,60%,0.2)">${round2(r).toFixed(2)}</div>`;
        });
      });
      html += `</div></div>`;
    }

    // Test results
    if (testResult && testLabel) {
      const pVal = testResult['p-value'] ?? testResult['p (two-tailed)'] ?? testResult['p (F-test)'];
      html += `<div class="sec"><h2>${testLabel}</h2><table>`;
      Object.entries(testResult).forEach(([k, v]) => {
        const val = typeof v === 'number' ? v : parseFloat(v);
        if (!isNaN(val)) {
          const barW = Math.min(Math.abs(val) * 60, 180);
          const hue = val >= 0 ? 140 : 20;
          html += `<tr><td class="lk">${k}</td><td class="rv">${round2(val)}</td><td><span class="bar" style="width:${barW}px;background:hsl(${hue},70%,50%)"></span></td></tr>`;
        } else {
          html += `<tr><td class="lk">${k}</td><td class="rv" colspan="2">${String(v)}</td></tr>`;
        }
      });
      if (pVal !== undefined) {
        const sig = typeof pVal === 'number' && pVal < 0.05;
        html += `<tr><td class="lk">Significance</td><td class="${sig ? 'trr' : 'trv'}" colspan="2">${sig ? 'Statistically significant (p < 0.05)' : 'Not statistically significant (p ≥ 0.05)'}</td></tr>`;
      }
      html += `</table></div>`;
    }

    html += `</div></body></html>`;
    downloadFile(html, `r-tool-report-${Date.now()}.html`, 'text/html');
    showToast('REPORT EXPORTED');
  };

  const exportChart = () => {
    const container = chartContainerRef.current;
    if (!container) { showToast('NO CHART TO EXPORT'); return; }

    // For Chart.js canvases
    const canvas = container.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = `r-tool-chart-${Date.now()}.png`; a.click();
      showToast('CHART EXPORTED');
      return;
    }

    // For SVG box plots
    const svg = container.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width * 2; c.height = img.height * 2;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = chartCanvasBackground;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const pngUrl = c.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl; a.download = `r-tool-chart-${Date.now()}.png`; a.click();
        URL.revokeObjectURL(url);
        showToast('CHART EXPORTED');
      };
      img.src = url;
      return;
    }

    showToast('NO CHART TO EXPORT');
  };

  return (
    <>
      <div>
        {/* Header Bar */}
        <div className={styles.headerBar}>
          <div className={styles.headerLeft}>
            <span className={styles.logoText}>MWA</span>
            <span className={styles.logoTag}>R-Tool Workbench</span>
          </div>
          <div className={styles.headerCenter}>
            <button className={styles.btnHeaderDemo} onClick={loadDemo}>LOAD DEMO DATA</button>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.headerStat}>
              Dataset
              <strong className={styles.headerStatValue}>N = {n}</strong>
            </div>
            <div className={styles.headerStat}>
              Variables
              <strong className={styles.headerStatValue}>{columns.length}</strong>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.content}>

          <div className={styles.sectionsRow}>

            {/* 01 — Data */}
            <div>
              <div className={styles.sectionLabel}>01 — Data</div>
              <div className={styles.entryPanel}>
                <div className={styles.brutCard}>
                  <div style={{ marginBottom: 20 }}>
                    <div className={styles.entryTitle}>Import or Enter Data</div>
                    <p className={styles.entryDesc}>Paste CSV, upload a .csv file, or define a schema and enter rows manually.</p>
                  </div>

                  {/* Mode tabs */}
                  <div className={styles.tabBar}>
                    <button className={inputMode === 'csv' ? styles.tabBtnActive : styles.tabBtn} onClick={() => setInputMode('csv')}>CSV / File</button>
                    <button className={inputMode === 'manual' ? styles.tabBtnActive : styles.tabBtn} onClick={() => setInputMode('manual')}>Manual Entry</button>
                  </div>

                  {inputMode === 'csv' ? (
                    <div className={styles.entryForm}>
                      <div
                        className={styles.fieldGroup}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleFileDrop}
                      >
                        <label className={styles.fieldLabel}>Paste or Drop CSV Data</label>
                        <textarea
                          className={styles.csvTextarea}
                          value={csvText}
                          onChange={e => setCsvText(e.target.value)}
                          placeholder="Paste CSV here or drag & drop a .csv file&#10;&#10;name,age,group,score&#10;Alice,28,A,82&#10;Bob,35,B,67"
                          rows={6}
                          style={dragging ? { borderColor: 'var(--color-primary)', background: 'color-mix(in oklch, var(--color-primary) 5%, transparent)' } : undefined}
                        />
                      </div>
                      <div className={styles.buttonRow}>
                        <button className={styles.btnPrimary} onClick={handleCsvImport} disabled={parsing}>
                          {parsing ? 'PARSING...' : 'LOAD DATA'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.entryForm}>
                      {!schemaLocked ? (
                        <>
                          <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Define Schema</label>
                            <div className={styles.fieldHint}>Add column names and types, then lock the schema to begin entering rows.</div>
                          </div>
                          {schemaDraft.map((col, i) => (
                            <div key={i} className={styles.inputRow}>
                              <div className={styles.fieldGroup}>
                                <input
                                  className={styles.input}
                                  value={col.name}
                                  onChange={e => updateSchemaCol(i, 'name', e.target.value)}
                                  placeholder="Column name"
                                />
                              </div>
                              <div className={styles.fieldGroup} style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <select className={styles.select} value={col.type} onChange={e => updateSchemaCol(i, 'type', e.target.value)}>
                                  <option value="numeric">Numeric</option>
                                  <option value="categorical">Categorical</option>
                                </select>
                                {schemaDraft.length > 1 && (
                                  <button className={styles.btnOutline} style={{ padding: '8px 12px', flexShrink: 0 }} onClick={() => removeSchemaCol(i)}>&times;</button>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className={styles.buttonRow}>
                            <button className={styles.btnOutline} onClick={addSchemaCol}>+ COLUMN</button>
                            <button className={styles.btnPrimary} onClick={lockSchema}>LOCK SCHEMA</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>Add Row</label>
                            <div className={styles.fieldHint}>Schema: {columns.map(c => `${c.name} (${c.type})`).join(', ')}</div>
                          </div>
                          {columns.map(col => (
                            <div key={col.name} className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>{col.name} ({col.type})</label>
                              <input
                                className={styles.input}
                                type={col.type === 'numeric' ? 'number' : 'text'}
                                value={manualRow[col.name] || ''}
                                onChange={e => setManualRow(prev => ({ ...prev, [col.name]: e.target.value }))}
                                placeholder={col.type === 'numeric' ? '0' : 'value'}
                              />
                            </div>
                          ))}
                          <div className={styles.buttonRow}>
                            <button className={styles.btnPrimary} onClick={addManualRow}>+ ADD ROW</button>
                            <button className={styles.btnOutline} onClick={resetSchema}>RESET SCHEMA</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* 02 — Data Table */}
            <div>
              <div className={styles.sectionLabel}>02 — Data Table</div>
              <div className={styles.dataTableWrapper}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      {columns.map(c => <th key={c.name}>{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length + 1} className={styles.emptyRow}>
                          NO DATA — IMPORT CSV OR ENTER ROWS
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, i) => (
                        <tr key={i}>
                          <td className={styles.tdN}>{i + 1}</td>
                          {columns.map(c => (
                            <td key={c.name}>{typeof r[c.name] === 'number' ? round2(r[c.name] as number) : String(r[c.name] ?? '')}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* 03 — Descriptive Statistics */}
          <div>
            <div className={styles.sectionLabel}>03 — Descriptive Statistics</div>
            <div className={styles.brutCard}>
              {numericCols.length === 0 || n === 0 ? (
                <div className={styles.emptyState}><p className={styles.emptyStateText}>Load data with numeric columns to see statistics</p></div>
              ) : (
                <>
                  <div className={styles.statsGrid}>
                    <div className={`${styles.statTile} ${styles.statTilePrimary}`}>
                      <div className={styles.statTileLabel}>N (obs)</div>
                      <div className={styles.statTileValue}>{n}</div>
                    </div>
                    {numericCols.map((col, i) => {
                      const vals = colVals(col.name);
                      return (
                        <div key={col.name} className={`${styles.statTile} ${styles[ACCENT_CLASSES[(i + 1) % ACCENT_CLASSES.length]]}`}>
                          <div className={styles.statTileLabel}>{col.name}</div>
                          <div className={styles.statTileValue}>{round2(mean(vals))}</div>
                          <div className={styles.statTileSub}>SD: {round2(std(vals))} | Med: {round2(median(vals))}</div>
                          <div className={styles.statTileSub}>Min: {round2(Math.min(...vals))} | Max: {round2(Math.max(...vals))}</div>
                          <div className={styles.statTileSub}>Q1: {round2(quartile(vals, 0.25))} | Q3: {round2(quartile(vals, 0.75))}</div>
                          <div className={styles.statTileSub}>Skew: {round2(skewness(vals))} | Kurt: {round2(kurtosis(vals))}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 04 — Visualizations */}
          <div>
            <div className={styles.sectionLabel}>04 — Visualizations</div>
            <div className={styles.tabBar}>
              {(['bar', 'scatter', 'histogram', 'line', 'boxplot'] as ChartType[]).map(tab => (
                <button
                  key={tab}
                  className={chartType === tab ? styles.tabBtnActive : styles.tabBtn}
                  onClick={() => setChartType(tab)}
                >
                  {tab === 'bar' ? 'Bar' : tab === 'scatter' ? 'Scatter' : tab === 'histogram' ? 'Histogram' : tab === 'line' ? 'Line' : 'Box'}
                </button>
              ))}
            </div>

            {/* Variable selectors */}
            <div className={styles.inputRow} style={{ marginBottom: 16 }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>X Axis</label>
                <select className={styles.select} value={chartX} onChange={e => setChartX(e.target.value)}>
                  <option value="">Select column</option>
                  {(chartType === 'bar' || chartType === 'boxplot' ? columns : numericCols).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              {chartType !== 'histogram' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Y Axis</label>
                  <select className={styles.select} value={chartY} onChange={e => setChartY(e.target.value)}>
                    <option value="">Select column</option>
                    {numericCols.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {chartType === 'scatter' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Group By (optional)</label>
                  <select className={styles.select} value={chartGroup} onChange={e => setChartGroup(e.target.value)}>
                    <option value="">None</option>
                    {categoricalCols.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {chartType === 'histogram' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Bins</label>
                  <input className={styles.input} type="number" min={2} max={30} value={chartBins} onChange={e => setChartBins(parseInt(e.target.value) || 5)} />
                </div>
              )}
            </div>

            <div className={styles.chartSingle}>
              <div className={styles.chartTitle}>
                <span>
                  {chartType === 'scatter' && `${chartX || '?'} vs. ${chartY || '?'}`}
                  {chartType === 'histogram' && `Distribution of ${chartX || '?'}`}
                  {chartType === 'bar' && `Mean ${chartY || '?'} by ${chartX || '?'}`}
                  {chartType === 'line' && `${chartY || '?'} over ${chartX || '?'}`}
                  {chartType === 'boxplot' && `${chartY || '?'} by ${chartX || '?'}`}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={styles.chartTypeBadge}>
                    {chartType === 'scatter' ? 'XY' : chartType === 'histogram' ? 'HIST' : chartType === 'bar' ? 'BAR' : chartType === 'line' ? 'LINE' : 'BOX'}
                  </span>
                  {n > 0 && <button className={styles.btnExport} onClick={exportChart} title="Export chart as PNG">PNG</button>}
                </span>
              </div>
              <div className={styles.chartContainer} ref={chartContainerRef}>
                {renderChart()}
              </div>
            </div>
          </div>

          {/* 05 — Correlation Matrix */}
          <div>
            <div className={styles.sectionLabel}>05 — Pearson Correlation Matrix</div>
            <div className={styles.brutCardMatrix}>
              {numericCols.length < 2 || n < 5 ? (
                <div className={styles.emptyState}><p className={styles.emptyStateText}>Need {'\u2265'} 5 rows and {'\u2265'} 2 numeric columns for correlations</p></div>
              ) : (
                <>
                  <div className={styles.checkboxRow}>
                    <button className={styles.btnOutline} style={{ padding: '6px 12px', fontSize: '0.65rem' }} onClick={selectAllCorr}>SELECT ALL</button>
                    {numericCols.map(c => (
                      <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: buttonFont, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer' }}>
                        <input type="checkbox" checked={corrSelected.includes(c.name)} onChange={() => toggleCorrCol(c.name)} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                  {corrCols.length >= 2 && (
                    <>
                      <div className={styles.matrixGrid} style={{ gridTemplateColumns: `120px repeat(${corrCols.length}, 1fr)` }}>
                        <div className={`${styles.matrixCell} ${styles.matrixHeader}`}></div>
                        {corrCols.map(c => (
                          <div key={c} className={`${styles.matrixCell} ${styles.matrixHeader}`}>{c}</div>
                        ))}
                        {corrCols.map((rowC, i) => (
                          <div key={`row-${rowC}`} style={{ display: 'contents' }}>
                            <div className={`${styles.matrixCell} ${styles.matrixHeader}`}>{rowC}</div>
                            {corrCols.map((colC, j) => {
                              const r = pearson(corrData[i], corrData[j]);
                              return (
                                <div key={`${i}-${j}`} className={`${styles.matrixCell} ${getMatrixCellClass(i, j, r)}`}>
                                  {i === j ? '1.00' : round2(r).toFixed(2)}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <p className={styles.corrNote}>
                        Pearson r — N={n}. Green = positive (r{'>'}0.20), Orange = negative (r{'<'}{'\u2212'}0.20).
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 06 — Statistical Tests */}
          <div>
            <div className={styles.sectionLabel}>06 — Statistical Tests</div>
            <div className={styles.brutCard}>
              <div className={styles.tabBar}>
                {(['ttest', 'correlation', 'regression', 'anova'] as TestType[]).map(t => (
                  <button key={t} className={testType === t ? styles.tabBtnActive : styles.tabBtn} onClick={() => { setTestType(t); setTestResult(null); }}>
                    {t === 'ttest' ? 'T-Test' : t === 'correlation' ? 'Correlation' : t === 'regression' ? 'Regression' : 'ANOVA'}
                  </button>
                ))}
              </div>

              {n < 3 ? (
                <div className={styles.emptyState}><p className={styles.emptyStateText}>Add {'\u2265'} 3 rows to run tests</p></div>
              ) : (
                <>
                  {/* Variable selectors per test type */}
                  <div className={styles.inputRow} style={{ marginBottom: 16 }}>
                    {(testType === 'ttest' || testType === 'anova') && (
                      <>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Grouping Variable</label>
                          <select className={styles.select} value={testGroupVar} onChange={e => { setTestGroupVar(e.target.value); setTestGroup1(''); setTestGroup2(''); }}>
                            <option value="">Select categorical column</option>
                            {categoricalCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Outcome Variable</label>
                          <select className={styles.select} value={testOutcomeVar} onChange={e => setTestOutcomeVar(e.target.value)}>
                            <option value="">Select numeric column</option>
                            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                    {testType === 'ttest' && testGroupVar && (
                      <>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Group 1</label>
                          <select className={styles.select} value={testGroup1} onChange={e => setTestGroup1(e.target.value)}>
                            <option value="">Select</option>
                            {uniqueVals(testGroupVar).map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Group 2</label>
                          <select className={styles.select} value={testGroup2} onChange={e => setTestGroup2(e.target.value)}>
                            <option value="">Select</option>
                            {uniqueVals(testGroupVar).filter(v => v !== testGroup1).map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                    {(testType === 'correlation' || testType === 'regression') && (
                      <>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>{testType === 'regression' ? 'Dependent Y' : 'Variable 1'}</label>
                          <select className={styles.select} value={testVar1} onChange={e => setTestVar1(e.target.value)}>
                            <option value="">Select numeric column</option>
                            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>{testType === 'regression' ? 'Independent X' : 'Variable 2'}</label>
                          <select className={styles.select} value={testVar2} onChange={e => setTestVar2(e.target.value)}>
                            <option value="">Select numeric column</option>
                            {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className={styles.buttonRow} style={{ marginBottom: 16 }}>
                    <button className={styles.btnPrimary} onClick={runTest}>RUN TEST</button>
                    <button className={styles.btnOutline} onClick={exportResults}>EXPORT RESULTS</button>
                  </div>

                  {testResult && (
                    <div>
                      <div className={styles.inferTitle}>
                        {testLabel}
                      </div>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr><th>Statistic</th><th>Value</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(testResult).map(([k, v]) => (
                            <tr key={k}><td>{k}</td><td className={styles.tdMean}>{String(v)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      <p className={styles.inferNote}>
                        {testType === 'ttest' && "Welch\u2019s t-test; two-tailed p from t-distribution. Cohen\u2019s d: small \u2265 0.2, medium \u2265 0.5, large \u2265 0.8."}
                        {testType === 'correlation' && 'Pearson product-moment correlation. p from t-transform: t = r\u221A((n\u22122)/(1\u2212r\u00B2)).'}
                        {testType === 'regression' && 'OLS regression. Slope p from t-distribution. R\u00B2 = proportion of Y variance explained by X.'}
                        {testType === 'anova' && 'One-way ANOVA. F-ratio tests equality of group means. p from F-distribution.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 07 — Blue Interpretation */}
          <div>
            <div className={styles.sectionLabel}>07 — Blue Statistical Interpretation</div>
            <div className={styles.bluePanel}>
              <div className={styles.blueId}>
                <Image src="/blue/blue-left.png" alt="Blue" width={72} height={131} className={styles.bluePfp} />
                <div className={styles.blueNameLabel}>Blue</div>
              </div>
              <div>
                <div className={styles.blueOutputLabel}>{'// Automated Statistical Interpretation'}</div>
                {!blueGenerated ? (
                  <div className={styles.bluePrompt}>
                    <p className={styles.bluePromptText}>
                      {n < 3 ? 'Load data to enable analysis' : 'Click to generate statistical interpretation'}
                    </p>
                    {n >= 3 && (
                      <button className={styles.btnGenerate} onClick={handleBlueGenerate}>
                        GENERATE ANALYSIS
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {(() => { const { text, findings } = computeBlueInterpretation(); return (
                      <>
                        <div className={styles.blueInterpretation}>{text}</div>
                        <div className={styles.blueFindingsRow}>
                          <div className={styles.blueFindings}>
                            {findings.map((f, i) => (
                              <span key={i} className={getFindingClass(f.cls)}>{f.label}</span>
                            ))}
                          </div>
                          <div className={styles.blueRatingRow}>
                            <button
                              className={`${styles.ratingBtn} ${blueRating === 'up' ? styles.ratingBtnActiveUp : ''}`}
                              onClick={() => handleBlueRate('up')}
                              title="Helpful"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                            </button>
                            <button
                              className={`${styles.ratingBtn} ${blueRating === 'down' ? styles.ratingBtnActiveDown : ''}`}
                              onClick={() => handleBlueRate('down')}
                              title="Not helpful"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" /></svg>
                            </button>
                          </div>
                        </div>
                      </>
                    ); })()}
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Toast */}
      <div className={`${styles.toast} ${toastVisible ? styles.toastShow : ''}`}>
        {toastMsg}
      </div>
    </>
  );
}
