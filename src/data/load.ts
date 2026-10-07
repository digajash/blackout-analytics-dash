import Papa from 'papaparse';
import { DATA_MODE, TABS, gvizUrl, localUrl, type TabName } from '../config';
import type {
  AccountRow,
  DashData,
  HookRow,
  SongRow,
  TickRow,
} from './types';
import { num } from './derive';

const CACHE_KEY = 'blackout-dash-cache-v1';

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function mapSong(r: Record<string, unknown>): SongRow {
  return {
    pull_id: str(r.pull_id),
    date: str(r.date),
    time_CT: str(r.time_CT),
    song: str(r.song),
    clip_id: str(r.clip_id),
    song_created_date: str(r.song_created_date),
    plays: num(r.plays),
    likes: num(r.likes),
    comments: num(r.comments),
    Δ_plays_vs_prior_pull: num(r['Δ_plays_vs_prior_pull'] ?? r['Δ_plays_vs_prior_pull']),
    Δ_likes: num(r['Δ_likes']),
    Δ_comments: num(r['Δ_comments']),
    source: str(r.source),
  };
}

function mapHook(r: Record<string, unknown>): HookRow {
  const flagKey =
    Object.keys(r).find((k) => k.toLowerCase().includes('hot_safe')) ??
    'hot_safe_flag (latest)';
  const hookNKey =
    Object.keys(r).find((k) => k.includes('hook_#') || k.includes('hook_n')) ??
    'hook_#_for_song';
  return {
    hook_id: str(r.hook_id),
    song: str(r.song),
    clip_id: str(r.clip_id),
    hook_n_for_song: num(r[hookNKey]),
    posted_date: str(r.posted_date),
    posted_time_CT: str(r.posted_time_CT),
    post_confirmed_by: str(r.post_confirmed_by),
    T0_song_baseline_pull_id: str(r.T0_song_baseline_pull_id),
    window_end_CT: str(r.window_end_CT),
    cadence: str(r.cadence),
    status: str(r.status),
    hot_safe_flag_latest: str(r[flagKey]),
    wrap_note: str(r.wrap_note),
    notes: str(r.notes),
  };
}

function mapTick(r: Record<string, unknown>): TickRow {
  return {
    hook_id: str(r.hook_id),
    song: str(r.song),
    tick_label: str(r.tick_label),
    hours_since_post: num(r.hours_since_post),
    pull_id: str(r.pull_id),
    date: str(r.date),
    time_CT: str(r.time_CT),
    song_plays: num(r.song_plays),
    song_likes: num(r.song_likes),
    song_comments: num(r.song_comments),
    Δ_plays_vs_prior_tick: num(r['Δ_plays_vs_prior_tick']),
    Δ_likes: num(r['Δ_likes']),
    Δ_comments: num(r['Δ_comments']),
    hours_since_prior_tick: num(r.hours_since_prior_tick),
    plays_per_hr: num(r.plays_per_hr),
    hot_safe_flag: str(r.hot_safe_flag),
    source: str(r.source),
  };
}

function mapAccount(r: Record<string, unknown>): AccountRow {
  const commentsKey =
    Object.keys(r).find((k) => k.startsWith('total_comments')) ??
    'total_comments (sum of songs)';
  return {
    pull_id: str(r.pull_id),
    date: str(r.date),
    time_CT: str(r.time_CT),
    pull_type: str(r.pull_type),
    total_plays: num(r.total_plays),
    total_likes: num(r.total_likes),
    total_comments: num(r[commentsKey]),
    followers: num(r.followers),
    following: num(r.following),
    songs_public: num(r.songs_public),
    Δ_plays_vs_prior_pull: num(r['Δ_plays_vs_prior_pull']),
    Δ_likes: num(r['Δ_likes']),
    Δ_comments: num(r['Δ_comments']),
    Δ_followers: num(r['Δ_followers']),
    notes: str(r.notes),
    source: str(r.source),
  };
}

function parseCsv<T>(
  text: string,
  mapper: (r: Record<string, unknown>) => T,
): T[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return (parsed.data || [])
    .filter((r) => Object.values(r).some((v) => str(v) !== ''))
    .map(mapper);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  // gviz login wall returns HTML
  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    throw new Error('HTML login wall (Sheet not public)');
  }
  return text;
}

async function loadTab(
  tab: TabName,
  preferred: 'gviz' | 'local' | 'appsscript',
): Promise<{ text: string; mode: 'gviz' | 'local' }> {
  if (preferred === 'local') {
    return { text: await fetchText(localUrl(tab)), mode: 'local' };
  }
  if (preferred === 'gviz') {
    try {
      return { text: await fetchText(gvizUrl(tab)), mode: 'gviz' };
    } catch {
      return { text: await fetchText(localUrl(tab)), mode: 'local' };
    }
  }
  // appsscript reserved — fall back local
  return { text: await fetchText(localUrl(tab)), mode: 'local' };
}

function readCache(): DashData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DashData;
  } catch {
    return null;
  }
}

function writeCache(data: DashData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export async function loadAll(force = false): Promise<DashData> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < 60_000) {
    return { ...cached, mode: 'cache' };
  }

  try {
    const preferred = DATA_MODE;
    const [songsR, hooksR, ticksR, acctR] = await Promise.all([
      loadTab(TABS.Songs, preferred),
      loadTab(TABS.Hook_Registry, preferred),
      loadTab(TABS.Wave_Ticks, preferred),
      loadTab(TABS.Daily_Account, preferred),
    ]);

    const mode =
      songsR.mode === 'local' ||
      hooksR.mode === 'local' ||
      ticksR.mode === 'local' ||
      acctR.mode === 'local'
        ? 'local'
        : 'gviz';

    const data: DashData = {
      songs: parseCsv(songsR.text, mapSong).filter((r) => r.pull_id && r.song),
      hooks: parseCsv(hooksR.text, mapHook).filter((r) => r.hook_id),
      ticks: parseCsv(ticksR.text, mapTick).filter((r) => r.hook_id),
      account: parseCsv(acctR.text, mapAccount).filter((r) => r.pull_id),
      fetchedAt: Date.now(),
      mode,
    };
    writeCache(data);
    return data;
  } catch (e) {
    if (cached) {
      return {
        ...cached,
        mode: 'cache',
        error: `SoT unreachable — showing cached data. ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    throw e;
  }
}
