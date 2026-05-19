// Throwaway harness: tests candidate models through the Eliza Cloud gateway
// for the Blue research flow. Usage: node scripts/test-eliza-models.mjs [probe|quality]
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const KEY = env.ELIZA_API_KEY;
const BASE = (env.ELIZA_API_BASE_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const URL_ = `${BASE}/api/v1/chat/completions`;

const mode = process.argv[2] || 'probe';

const PROBE_PROMPT = 'Reply with exactly: research rails ok';
const QUALITY_PROMPT =
  'You are drafting an academic grant application. Write the "Background and Significance" ' +
  'section for a proposal on using brief daily expressive-writing interventions to reduce ' +
  'anxiety in undergraduate students. Use formal academic prose, full paragraphs, ground it ' +
  'in real bodies of literature, and aim for roughly 500-700 words. Plain text, no markdown.';

const PROBE_MODELS = [
  'anthropic/claude-opus-4.7',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-sonnet-4.6',
  'openai/gpt-5.5',
  'openai/gpt-5.2-pro',
  'openai/o3-deep-research',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.5-flash',
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-chat',
  'x-ai/grok-4.3',
  'qwen/qwen3.6-max-preview',
  'moonshotai/kimi-k2.6',
  'z-ai/glm-5',
];

// SSE / data-stream / JSON content extraction — mirrors lib/eliza-api.ts
function extract(raw) {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('data:') || /^[0-9a-f]:/.test(trimmed)) {
    let out = '';
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const payload = t.startsWith('data:') ? t.slice(5).trim() : t;
      if (!payload || payload === '[DONE]') continue;
      const ds = payload.match(/^([0-9a-f]):([\s\S]*)$/);
      if (ds) {
        if (ds[1] === '0') {
          try { out += JSON.parse(ds[2]); } catch { out += ds[2]; }
        }
        continue;
      }
      try {
        const ev = JSON.parse(payload);
        out += ev.choices?.[0]?.delta?.content || ev.choices?.[0]?.message?.content
          || ev.textDelta || ev.delta || ev.text || ev.content || '';
      } catch { /* skip */ }
    }
    return out;
  }
  try {
    const j = JSON.parse(raw);
    return j.choices?.[0]?.message?.content || j.text || j.content || j.response || '';
  } catch {
    return '';
  }
}

async function test(model, prompt, maxTokens) {
  const started = Date.now();
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, 'X-API-Key': KEY },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, stream: true }),
    });
    const raw = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      let msg = raw.slice(0, 160);
      try { msg = JSON.parse(raw).error?.message || msg; } catch { /* keep */ }
      return { model, ok: false, ms, status: res.status, note: msg };
    }
    const content = extract(raw).trim();
    return { model, ok: !!content, ms, status: res.status, words: content.split(/\s+/).filter(Boolean).length, content };
  } catch (e) {
    return { model, ok: false, ms: Date.now() - started, status: 0, note: e.message };
  }
}

if (mode === 'probe') {
  console.log(`Probing ${PROBE_MODELS.length} models via ${URL_}\n`);
  for (const m of PROBE_MODELS) {
    const r = await test(m, PROBE_PROMPT, 64);
    console.log(
      `${r.ok ? 'OK  ' : 'FAIL'}  ${m.padEnd(34)}  ${String(r.ms + 'ms').padEnd(8)}  ` +
      `http ${r.status}  ${r.ok ? `"${(r.content || '').slice(0, 40)}"` : r.note}`
    );
  }
} else {
  const models = process.argv.slice(3);
  console.log(`Quality test on ${models.length} models\n`);
  for (const m of models) {
    const r = await test(m, QUALITY_PROMPT, 1400);
    console.log(`\n===== ${m}  |  ${r.ok ? 'OK' : 'FAIL'}  |  ${r.ms}ms  |  ${r.words || 0} words =====`);
    console.log(r.ok ? r.content : `(${r.status}) ${r.note}`);
  }
}
