#!/usr/bin/env node
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(input || '{}');
    const file = payload?.tool_input?.file_path || '';
    if (!file.endsWith('vercel.json')) process.exit(0);
    const fs = await import('fs');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const bad = (config.crons || []).filter((c) => {
      const [min, hour] = String(c.schedule || '').trim().split(/\s+/);
      return !min || !hour || min.includes('*') || min.includes(',') || hour.includes('*') || hour.includes(',');
    });
    if (bad.length) {
      console.error(
        'vercel.json cron check: ' + bad.length + ' schedule(s) run more than once per day (' +
        bad.map((c) => c.schedule).join('; ') +
        '). Vercel Hobby fails every deploy on sub-daily crons - use a fixed minute and hour, e.g. "0 9 * * *".'
      );
      process.exit(2);
    }
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
