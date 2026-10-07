import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DashData } from '../data/types';
import {
  fmtDelta,
  fmtNum,
  formatPullDT,
  pullDateTime,
  songRollup,
} from '../data/derive';
import { SERIES_COLORS } from '../config';
import Leaderboard from '../components/Leaderboard';

interface Props {
  data: DashData;
}

type Range = '7D' | '14D' | '30D' | 'ALL';
type Metric = 'plays' | 'likes' | 'comments';

export default function Songs({ data }: Props) {
  const [range, setRange] = useState<Range>('ALL');
  const [metric, setMetric] = useState<Metric>('plays');
  const [mode, setMode] = useState<'cumulative' | 'delta'>('cumulative');
  const [overlayHooks, setOverlayHooks] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const rollup = useMemo(() => songRollup(data.songs), [data.songs]);
  const activeSongs = new Set(
    data.hooks
      .filter((h) => (h.status || '').toUpperCase() === 'ACTIVE')
      .map((h) => h.song),
  );

  const leaderRows = rollup.map((r) => ({
    song: r.song,
    latest_plays: r.latest_plays,
    latest_likes: r.latest_likes,
    latest_comments: r.latest_comments,
    Δ_last_pull: r.Δ_last_pull,
    Δ_plays_since_first_log: r.Δ_plays_since_first_log,
    pulls_logged: r.pulls_logged,
    dataCheck: r.dataCheck,
    hasActiveHook: activeSongs.has(r.song),
  }));

  const cutoff = useMemo(() => {
    if (range === 'ALL') return null;
    const days = range === '7D' ? 7 : range === '14D' ? 14 : 30;
    return Date.now() - days * 86_400_000;
  }, [range]);

  const songsToPlot = selected ? [selected] : rollup.map((r) => r.song);

  // Build aligned time series
  const chartData = useMemo(() => {
    const points = new Map<number, Record<string, number | string | null>>();
    for (const song of songsToPlot) {
      const hist = rollup.find((r) => r.song === song)?.history ?? [];
      for (const row of hist) {
        const dt = pullDateTime(row.date, row.time_CT);
        if (!dt) continue;
        if (cutoff && dt.getTime() < cutoff) continue;
        const t = dt.getTime();
        const pt = points.get(t) ?? { t, label: formatPullDT(row.date, row.time_CT) };
        let val: number | null = null;
        if (mode === 'cumulative') {
          val =
            metric === 'plays'
              ? row.plays
              : metric === 'likes'
                ? row.likes
                : row.comments;
        } else {
          val =
            metric === 'plays'
              ? row.Δ_plays_vs_prior_pull
              : metric === 'likes'
                ? row.Δ_likes
                : row.Δ_comments;
        }
        pt[song] = val;
        points.set(t, pt);
      }
    }
    return [...points.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
  }, [rollup, songsToPlot, cutoff, metric, mode]);

  const hookMarkers = overlayHooks
    ? data.hooks
        .map((h) => {
          const dt = pullDateTime(h.posted_date, h.posted_time_CT.replace(/^~/, ''));
          return dt
            ? { t: dt.getTime(), id: h.hook_id, song: h.song, approx: h.posted_time_CT.includes('~') }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
    : [];

  const detail = selected ? rollup.find((r) => r.song === selected) : null;

  return (
    <div>
      <h1 className="screen-title">SONGS</h1>

      <div className="toolbar">
        <div className="chip-row">
          <span>Range:</span>
          {(['7D', '14D', '30D', 'ALL'] as Range[]).map((r) => (
            <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <span>Metric:</span>
          {(['plays', 'likes', 'comments'] as Metric[]).map((m) => (
            <button key={m} className={`chip ${metric === m ? 'on' : ''}`} onClick={() => setMetric(m)}>
              {metric === m ? '● ' : ''}
              {m}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <span>Mode:</span>
          <button className={`chip ${mode === 'cumulative' ? 'on' : ''}`} onClick={() => setMode('cumulative')}>
            {mode === 'cumulative' ? '● ' : ''}cumulative
          </button>
          <button className={`chip ${mode === 'delta' ? 'on' : ''}`} onClick={() => setMode('delta')}>
            {mode === 'delta' ? '● ' : ''}Δ per pull
          </button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={overlayHooks}
            onChange={(e) => setOverlayHooks(e.target.checked)}
          />{' '}
          Overlay hook drops
        </label>
        {selected && (
          <button className="chip" onClick={() => setSelected(null)}>
            Clear solo
          </button>
        )}
      </div>

      <div className="section-label">LEADERBOARD (derived latest per song)</div>
      <Leaderboard
        rows={leaderRows}
        selected={selected}
        onSelect={(s) => setSelected(s === selected ? null : s)}
      />

      <div className="section-label">GROWTH CURVES (real time · no interpolation)</div>
      <div className="panel">
        <div className="chart-wrap tall">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => {
                  const d = new Date(v as number);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#0E0E0F',
                  border: '1px solid #1C1C1E',
                  borderLeft: '3px solid #E10600',
                  borderRadius: 2,
                  fontFamily: 'JetBrains Mono',
                  fontSize: 11,
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { label?: string };
                  return p?.label ?? '';
                }}
              />
              {hookMarkers.map((m) => (
                <ReferenceLine
                  key={m.id}
                  x={m.t}
                  stroke="#E10600"
                  strokeDasharray="3 3"
                  label={{ value: m.id, fill: '#E10600', fontSize: 10 }}
                />
              ))}
              {songsToPlot.map((song, i) => (
                <Line
                  key={song}
                  type="linear"
                  dataKey={song}
                  name={song}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {detail && (
        <>
          <div className="section-label">SONG DETAIL</div>
          <div className="panel">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.06em' }}>
              {detail.song}
            </div>
            <div className="meta-bar" style={{ marginTop: 4 }}>
              created {detail.song_created_date || '—'} · clip {detail.clip_id?.slice(0, 8)}…
              {detail.clip_id && (
                <a
                  href={`https://suno.com/song/${detail.clip_id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 8 }}
                >
                  ↗
                </a>
              )}
            </div>
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>pull_id</th>
                  <th>time CT</th>
                  <th>plays</th>
                  <th>likes</th>
                  <th>comments</th>
                  <th>Δ plays</th>
                  <th>source</th>
                </tr>
              </thead>
              <tbody>
                {[...detail.history].reverse().map((r) => (
                  <tr key={`${r.pull_id}-${r.song}`}>
                    <td>{r.pull_id}</td>
                    <td>{formatPullDT(r.date, r.time_CT)}</td>
                    <td>{fmtNum(r.plays)}</td>
                    <td>{fmtNum(r.likes)}</td>
                    <td>{fmtNum(r.comments)}</td>
                    <td>{fmtDelta(r.Δ_plays_vs_prior_pull)}</td>
                    <td className="muted">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
