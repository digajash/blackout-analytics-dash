/** Column headers 1:1 with Sheet tabs (SoT). */

export interface SongRow {
  pull_id: string;
  date: string;
  time_CT: string;
  song: string;
  clip_id: string;
  song_created_date: string;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  Δ_plays_vs_prior_pull: number | null;
  Δ_likes: number | null;
  Δ_comments: number | null;
  source: string;
}

export interface HookRow {
  hook_id: string;
  song: string;
  clip_id: string;
  hook_n_for_song: number | null;
  posted_date: string;
  posted_time_CT: string;
  post_confirmed_by: string;
  T0_song_baseline_pull_id: string;
  window_end_CT: string;
  cadence: string;
  status: string;
  hot_safe_flag_latest: string;
  wrap_note: string;
  notes: string;
}

export interface TickRow {
  hook_id: string;
  song: string;
  tick_label: string;
  hours_since_post: number | null;
  pull_id: string;
  date: string;
  time_CT: string;
  song_plays: number | null;
  song_likes: number | null;
  song_comments: number | null;
  Δ_plays_vs_prior_tick: number | null;
  Δ_likes: number | null;
  Δ_comments: number | null;
  hours_since_prior_tick: number | null;
  plays_per_hr: number | null;
  hot_safe_flag: string;
  source: string;
}

export interface AccountRow {
  pull_id: string;
  date: string;
  time_CT: string;
  pull_type: string;
  total_plays: number | null;
  total_likes: number | null;
  total_comments: number | null;
  followers: number | null;
  following: number | null;
  songs_public: number | null;
  Δ_plays_vs_prior_pull: number | null;
  Δ_likes: number | null;
  Δ_comments: number | null;
  Δ_followers: number | null;
  notes: string;
  source: string;
}

export interface DashData {
  songs: SongRow[];
  hooks: HookRow[];
  ticks: TickRow[];
  account: AccountRow[];
  fetchedAt: number;
  mode: 'gviz' | 'local' | 'appsscript' | 'cache';
  error?: string;
}

export type StackCallKind = 'HOT' | 'SAFE' | 'NO_CALL';

export interface StackCall {
  kind: StackCallKind;
  label: string;
  driver?: HookRow;
  flagText: string;
  flagTimeHint: string;
}
