import { useMemo, useState } from 'react';
import type { DashData } from '../data/types';
import {
  CADENCE_MARKS,
  calcPlaysPerHr,
  fmtNum,
  snapToMark,
  ticksForHook,
} from '../data/derive';
import HookChart from '../components/HookChart';

interface Props {
  data: DashData;
}

export default function Hooks({ data }: Props) {
  const activeIds = data.hooks
    .filter((h) => (h.status || '').toUpperCase() === 'ACTIVE')
    .map((h) => h.hook_id);

  const defaultIds = useMemo(() => {
    const ids = new Set(activeIds);
    // most recent wrapped for same song as active
    for (const a of data.hooks.filter((h) => activeIds.includes(h.hook_id))) {
      const wrapped = data.hooks
        .filter(
          (h) =>
            h.song === a.song &&
            h.hook_id !== a.hook_id &&
            (h.status || '').toUpperCase().includes('WRAP'),
        )
        .sort((x, y) => y.hook_id.localeCompare(x.hook_id));
      if (wrapped[0]) ids.add(wrapped[0].hook_id);
    }
    if (!ids.size && data.hooks[0]) ids.add(data.hooks[0].hook_id);
    return [...ids];
  }, [data.hooks, activeIds]);

  const [selected, setSelected] = useState<string[]>(defaultIds);
  const [metric, setMetric] = useState<'plays_per_hr' | 'cum_delta' | 'likes'>('plays_per_hr');
  const [songFilter, setSongFilter] = useState('All');

  const songs = [...new Set(data.hooks.map((h) => h.song))];
  const visibleHooks = data.hooks.filter(
    (h) => songFilter === 'All' || h.song === songFilter,
  );

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 5),
    );
  }

  // Side-by-side table
  const selectedHooks = data.hooks.filter((h) => selected.includes(h.hook_id));
  const marks = [-1, ...CADENCE_MARKS];

  return (
    <div>
      <h1 className="screen-title">HOOKS</h1>

      <div className="toolbar">
        <div className="chip-row">
          <span>Hooks:</span>
          {visibleHooks.map((h) => (
            <button
              key={h.hook_id}
              className={`chip ${selected.includes(h.hook_id) ? 'on' : ''}`}
              onClick={() => toggle(h.hook_id)}
            >
              {selected.includes(h.hook_id) ? '✓ ' : ''}
              {h.hook_id}
            </button>
          ))}
        </div>
        <label>
          Song:{' '}
          <select
            value={songFilter}
            onChange={(e) => setSongFilter(e.target.value)}
            style={{ background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <option>All</option>
            {songs.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="chip-row">
          <span>Metric:</span>
          {(
            [
              ['plays_per_hr', 'plays/hr'],
              ['cum_delta', 'cumulative Δ plays since T0'],
              ['likes', 'likes'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={`chip ${metric === k ? 'on' : ''}`}
              onClick={() => setMetric(k)}
            >
              {metric === k ? '● ' : ''}
              {label}
            </button>
          ))}
        </div>
      </div>

      <HookChart
        hooks={data.hooks}
        ticks={data.ticks}
        selectedIds={selected}
        metric={metric}
      />

      <div className="section-label">SIDE-BY-SIDE TICK TABLE</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>T+</th>
              {selectedHooks.map((h) => (
                <th key={h.hook_id}>{h.hook_id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marks.map((m) => (
              <tr key={m}>
                <td className="muted">{m < 0 ? 'Base' : `${m}h`}</td>
                {selectedHooks.map((h) => {
                  const series = ticksForHook(data.ticks, h.hook_id);
                  const tick =
                    m < 0
                      ? series.find((t) => (t.hours_since_post ?? 0) < 0)
                      : series.find((t) => snapToMark(t.hours_since_post) === m && (t.hours_since_post ?? 0) >= 0);
                  // Prefer exact-ish match: if multiple snap to same, pick closest
                  const candidates =
                    m < 0
                      ? series.filter((t) => (t.hours_since_post ?? 0) < 0)
                      : series.filter(
                          (t) =>
                            (t.hours_since_post ?? 0) >= 0 &&
                            snapToMark(t.hours_since_post) === m,
                        );
                  const best =
                    candidates.sort(
                      (a, b) =>
                        Math.abs((a.hours_since_post ?? 0) - (m < 0 ? -6 : m)) -
                        Math.abs((b.hours_since_post ?? 0) - (m < 0 ? -6 : m)),
                    )[0] ?? tick;

                  if (!best) {
                    return (
                      <td key={h.hook_id} className="muted">
                        — (not pulled)
                      </td>
                    );
                  }
                  const rate = calcPlaysPerHr(best);
                  const hot = (best.hot_safe_flag || '').toUpperCase().includes('HOT');
                  return (
                    <td key={h.hook_id}>
                      <div>{best.tick_label}</div>
                      <div>
                        {fmtNum(best.song_plays)} plays
                        {best.Δ_plays_vs_prior_tick != null && (
                          <> · +{best.Δ_plays_vs_prior_tick}</>
                        )}
                        {rate.value != null && (
                          <>
                            {' · '}
                            {rate.value}/hr
                            {rate.calc && <span className="tag-calc">calc</span>}
                          </>
                        )}
                        {hot && <span className="tag-hot"> · HOT</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="meta-bar" style={{ marginTop: 8 }}>
          Off-grid ticks snap to nearest mark for the table only. Chart plots true hours_since_post.
        </div>
      </div>

      <div className="section-label">HOOK REGISTRY CARDS</div>
      <div className="hook-cards">
        {data.hooks.map((h) => {
          const active = (h.status || '').toUpperCase() === 'ACTIVE';
          return (
            <div key={h.hook_id} className="hook-card">
              <div>
                <span className="hid">{h.hook_id}</span>
                <span className="status" style={{ color: active ? 'var(--hot)' : 'var(--muted)' }}>
                  {active ? '● ACTIVE' : `○ ${h.status || '—'}`}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                {h.song} · hook #{h.hook_n_for_song ?? '—'}
              </div>
              <div>Posted {h.posted_date} {h.posted_time_CT} CT</div>
              <div>Confirmed: {h.post_confirmed_by || '—'}</div>
              <div>Window → {h.window_end_CT || '—'}</div>
              <div>
                Flag:{' '}
                <span className={(h.hot_safe_flag_latest || '').includes('HOT') ? 'tag-hot' : ''}>
                  {h.hot_safe_flag_latest || '—'}
                </span>
              </div>
              {h.wrap_note && <div>Wrap: {h.wrap_note}</div>}
              {h.notes && <div>Notes: {h.notes}</div>}
              {h.cadence && <div className="muted">Cadence: {h.cadence}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
