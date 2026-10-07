import type {
  AccountRow,
  HookRow,
  SongRow,
  StackCall,
  TickRow,
} from './types';

/** Parse Sheet number cells; blank / missing → null. Never invent. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parse time like "3:30 AM", "~7:00 PM" into minutes since midnight. */
export function parseTimeCT(t: string): number | null {
  if (!t) return null;
  const clean = t.replace(/^~/, '').trim();
  const m = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Combine date + time_CT into a Date in local interpretation (CT labeled). */
export function pullDateTime(date: string, timeCT: string): Date | null {
  if (!date) return null;
  const mins = parseTimeCT(timeCT);
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (mins != null) {
    dt.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  }
  return dt;
}

export function formatPullDT(date: string, timeCT: string): string {
  const dt = pullDateTime(date, timeCT);
  if (!dt) return `${date} ${timeCT} CT`.trim();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = dt.getHours();
  const m = dt.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${days[dt.getDay()]} ${months[dt.getMonth()]} ${dt.getDate()} · ${h12}:${String(m).padStart(2, '0')} ${ap} CT`;
}

export function latestPullId(...lanes: { pull_id: string }[][]): string {
  const ids = lanes.flat().map((r) => r.pull_id).filter(Boolean);
  if (!ids.length) return '';
  return ids.sort().reverse()[0];
}

export function latestPerSong(songs: SongRow[]): SongRow[] {
  const bySong = new Map<string, SongRow[]>();
  for (const r of songs) {
    if (!r.song) continue;
    const list = bySong.get(r.song) ?? [];
    list.push(r);
    bySong.set(r.song, list);
  }
  const out: SongRow[] = [];
  for (const [, list] of bySong) {
    list.sort((a, b) => {
      const da = pullDateTime(a.date, a.time_CT)?.getTime() ?? 0;
      const db = pullDateTime(b.date, b.time_CT)?.getTime() ?? 0;
      return db - da || b.pull_id.localeCompare(a.pull_id);
    });
    const latest = list[0];
    // Counts only climb — flag if later < earlier max
    const maxPlays = Math.max(...list.map((x) => x.plays ?? -Infinity));
    if (latest.plays != null && maxPlays > latest.plays) {
      (latest as SongRow & { dataCheck?: boolean }).dataCheck = true;
    }
    out.push(latest);
  }
  out.sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0));
  return out;
}

export function songRollup(songs: SongRow[]) {
  const bySong = new Map<string, SongRow[]>();
  for (const r of songs) {
    if (!r.song) continue;
    const list = bySong.get(r.song) ?? [];
    list.push(r);
    bySong.set(r.song, list);
  }
  return [...bySong.entries()].map(([song, list]) => {
    list.sort((a, b) => {
      const da = pullDateTime(a.date, a.time_CT)?.getTime() ?? 0;
      const db = pullDateTime(b.date, b.time_CT)?.getTime() ?? 0;
      return da - db || a.pull_id.localeCompare(b.pull_id);
    });
    const first = list[0];
    const latest = list[list.length - 1];
    const firstPlays = first.plays;
    const latestPlays = latest.plays;
    const deltaSinceFirst =
      firstPlays != null && latestPlays != null ? latestPlays - firstPlays : null;
    return {
      song,
      clip_id: latest.clip_id,
      song_created_date: latest.song_created_date,
      latest_plays: latestPlays,
      latest_likes: latest.likes,
      latest_comments: latest.comments,
      first_logged_plays: firstPlays,
      Δ_plays_since_first_log: deltaSinceFirst,
      pulls_logged: list.length,
      Δ_last_pull: latest.Δ_plays_vs_prior_pull,
      latest,
      history: list,
      dataCheck:
        latestPlays != null &&
        Math.max(...list.map((x) => x.plays ?? -Infinity)) > latestPlays,
    };
  }).sort((a, b) => (b.latest_plays ?? 0) - (a.latest_plays ?? 0));
}

/** Daily total = last pull of that date. */
export function dailyLastPull(account: AccountRow[]): AccountRow[] {
  const byDate = new Map<string, AccountRow[]>();
  for (const r of account) {
    if (!r.date) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  const out: AccountRow[] = [];
  for (const [, list] of byDate) {
    list.sort((a, b) => {
      const ta = parseTimeCT(a.time_CT) ?? -1;
      const tb = parseTimeCT(b.time_CT) ?? -1;
      return tb - ta || b.pull_id.localeCompare(a.pull_id);
    });
    out.push(list[0]);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function stackCall(hooks: HookRow[]): StackCall {
  const active = hooks.filter((h) => (h.status || '').toUpperCase() === 'ACTIVE');
  if (!active.length) {
    return { kind: 'SAFE', label: 'SAFE TO STACK', flagText: '', flagTimeHint: '' };
  }
  const hot = active.filter((h) =>
    (h.hot_safe_flag_latest || '').toUpperCase().includes('HOT'),
  );
  if (hot.length) {
    // most recent flagged — prefer ones with a time hint in the flag text
    const driver = hot[0];
    const flag = driver.hot_safe_flag_latest || '';
    const timeMatch = flag.match(/\(([^)]+)\)/);
    return {
      kind: 'HOT',
      label: 'STILL HOT — WAIT',
      driver,
      flagText: flag,
      flagTimeHint: timeMatch?.[1] ?? '',
    };
  }
  const allSafe = active.every((h) =>
    (h.hot_safe_flag_latest || '').toUpperCase().includes('SAFE'),
  );
  const anyBlank = active.some((h) => !(h.hot_safe_flag_latest || '').trim());
  if (anyBlank && !allSafe) {
    return { kind: 'NO_CALL', label: 'NO CALL', flagText: '', flagTimeHint: '' };
  }
  if (allSafe || active.every((h) => (h.hot_safe_flag_latest || '').toUpperCase().includes('SAFE'))) {
    return { kind: 'SAFE', label: 'SAFE TO STACK', flagText: active[0]?.hot_safe_flag_latest ?? '', flagTimeHint: '' };
  }
  if (anyBlank) {
    return { kind: 'NO_CALL', label: 'NO CALL', flagText: '', flagTimeHint: '' };
  }
  return { kind: 'SAFE', label: 'SAFE TO STACK', driver: active[0], flagText: active[0]?.hot_safe_flag_latest ?? '', flagTimeHint: '' };
}

/** Cadence grid: T+1..4 hourly, then every 4h through 48. */
export const CADENCE_MARKS = [
  0, 1, 2, 3, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
];

export function nextMark(hoursSincePost: number | null): { hours: number; label: string } | null {
  if (hoursSincePost == null || hoursSincePost < 0) {
    return { hours: 1, label: 'T+1h' };
  }
  for (const m of CADENCE_MARKS) {
    if (m > hoursSincePost + 0.05) {
      return { hours: m, label: `T+${m}h` };
    }
  }
  return null;
}

export function hoursSincePostNow(hook: HookRow, now = new Date()): number | null {
  if (!hook.posted_date) return null;
  const posted = pullDateTime(hook.posted_date, hook.posted_time_CT.replace(/^~/, ''));
  if (!posted) return null;
  return (now.getTime() - posted.getTime()) / 3_600_000;
}

export function calcPlaysPerHr(tick: TickRow): {
  value: number | null;
  calc: boolean;
} {
  if (tick.plays_per_hr != null) return { value: tick.plays_per_hr, calc: false };
  const d = tick.Δ_plays_vs_prior_tick;
  const h = tick.hours_since_prior_tick;
  if (d == null || h == null || h <= 0) return { value: null, calc: false };
  // baselines / negative T+ excluded from plays/hr
  if ((tick.hours_since_post ?? 0) < 0) return { value: null, calc: false };
  return { value: Math.round(d / h), calc: true };
}

export function windowProgress(hook: HookRow, now = new Date()): {
  hours: number | null;
  pct: number;
  approx: boolean;
} {
  const h = hoursSincePostNow(hook, now);
  const approx = (hook.posted_time_CT || '').includes('~');
  if (h == null) return { hours: null, pct: 0, approx };
  return { hours: h, pct: Math.min(100, Math.max(0, (h / 48) * 100)), approx };
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

export function fmtDelta(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '0';
  return n > 0 ? `▲ +${n.toLocaleString('en-US')}` : `▼ ${n.toLocaleString('en-US')}`;
}

export function sortAccountNewest(account: AccountRow[]): AccountRow[] {
  return [...account].sort((a, b) => {
    const da = pullDateTime(a.date, a.time_CT)?.getTime() ?? 0;
    const db = pullDateTime(b.date, b.time_CT)?.getTime() ?? 0;
    return db - da || b.pull_id.localeCompare(a.pull_id);
  });
}

export function ticksForHook(ticks: TickRow[], hookId: string): TickRow[] {
  return ticks
    .filter((t) => t.hook_id === hookId)
    .sort((a, b) => (a.hours_since_post ?? 0) - (b.hours_since_post ?? 0));
}

/** Snap off-grid tick to nearest cadence mark for table alignment only. */
export function snapToMark(hours: number | null): number | null {
  if (hours == null) return null;
  if (hours < 0) return -1; // baseline bucket
  let best = CADENCE_MARKS[0];
  let bestDist = Infinity;
  for (const m of CADENCE_MARKS) {
    const d = Math.abs(m - hours);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

export function dataAgeHours(pullId: string, account: AccountRow[], songs: SongRow[]): number | null {
  const all = [...account, ...songs];
  const row = all.find((r) => r.pull_id === pullId);
  if (!row) return null;
  const dt = pullDateTime(row.date, row.time_CT);
  if (!dt) return null;
  return (Date.now() - dt.getTime()) / 3_600_000;
}
