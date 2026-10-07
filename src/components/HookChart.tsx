import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { SERIES_COLORS } from '../config';
import { calcPlaysPerHr, hoursSincePostNow, ticksForHook } from '../data/derive';
import type { HookRow, TickRow } from '../data/types';

interface Props {
  hooks: HookRow[];
  ticks: TickRow[];
  selectedIds: string[];
  metric: 'plays_per_hr' | 'cum_delta' | 'likes';
}

type Pt = { hours: number; label: string; [k: string]: number | string | null };

export default function HookChart({ hooks, ticks, selectedIds, metric }: Props) {
  const selected = hooks.filter((h) => selectedIds.includes(h.hook_id));
  const hourSet = new Set<number>();
  for (const id of selectedIds) {
    for (const t of ticksForHook(ticks, id)) {
      if (t.hours_since_post != null) hourSet.add(t.hours_since_post);
    }
  }
  const hours = [...hourSet].sort((a, b) => a - b);
  const data: Pt[] = hours.map((h) => {
    const row: Pt = { hours: h, label: `T+${h}h` };
    for (const hook of selected) {
      const t = ticksForHook(ticks, hook.hook_id).find(
        (x) => x.hours_since_post === h,
      );
      if (!t) {
        row[hook.hook_id] = null;
        continue;
      }
      if (metric === 'plays_per_hr') {
        if ((t.hours_since_post ?? 0) < 0) {
          row[hook.hook_id] = null;
        } else {
          row[hook.hook_id] = calcPlaysPerHr(t).value;
        }
      } else if (metric === 'likes') {
        row[hook.hook_id] = t.song_likes;
      } else {
        // cumulative Δ plays since T0 — use song_plays - baseline plays
        const series = ticksForHook(ticks, hook.hook_id);
        const base = series.find((x) => (x.hours_since_post ?? 0) < 0);
        const basePlays = base?.song_plays;
        if (t.song_plays != null && basePlays != null) {
          row[hook.hook_id] = t.song_plays - basePlays;
        } else {
          row[hook.hook_id] = null;
        }
      }
      row[`${hook.hook_id}__tick`] = t.tick_label;
      row[`${hook.hook_id}__plays`] = t.song_plays;
      row[`${hook.hook_id}__dplays`] = t.Δ_plays_vs_prior_tick;
      row[`${hook.hook_id}__flag`] = t.hot_safe_flag;
      row[`${hook.hook_id}__pull`] = t.pull_id;
    }
    return row;
  });

  // HOT zone stretches from flags on ticks
  const hotZones: { x1: number; x2: number }[] = [];
  for (const hook of selected) {
    const series = ticksForHook(ticks, hook.hook_id).filter(
      (t) => (t.hours_since_post ?? -1) >= 0,
    );
    let start: number | null = null;
    for (let i = 0; i < series.length; i++) {
      const hot = (series[i].hot_safe_flag || '').toUpperCase().includes('HOT');
      if (hot && start == null) start = series[i].hours_since_post!;
      if (!hot && start != null) {
        hotZones.push({ x1: start, x2: series[i].hours_since_post! });
        start = null;
      }
    }
    if (start != null && series.length) {
      hotZones.push({
        x1: start,
        x2: series[series.length - 1].hours_since_post!,
      });
    }
  }

  const nowLines = selected
    .filter((h) => (h.status || '').toUpperCase() === 'ACTIVE')
    .map((h) => hoursSincePostNow(h))
    .filter((h): h is number => h != null);

  const yLabel =
    metric === 'plays_per_hr'
      ? 'plays/hr'
      : metric === 'likes'
        ? 'likes'
        : 'Δ plays since T0';

  return (
    <div className="panel">
      <div className="section-label" style={{ marginTop: 0 }}>
        {metric === 'plays_per_hr' ? 'PLAYS/HR vs T+' : metric === 'likes' ? 'LIKES vs T+' : 'CUMULATIVE Δ PLAYS vs T+'}{' '}
        (Wave_Ticks)
      </div>
      <div className="chart-wrap tall">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="hours"
              type="number"
              domain={[-8, 48]}
              stroke="var(--muted)"
              tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              label={{ value: 'T+ hours', position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 11 }}
            />
            <YAxis
              stroke="var(--muted)"
              tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11 }}
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
              formatter={(value, name) => {
                const v = value as number | null;
                if (v == null) return ['—', String(name)];
                return [v, String(name)];
              }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as Pt | undefined;
                if (!p) return `T+${label}h`;
                const bits: string[] = [];
                for (const hook of selected) {
                  const plays = p[`${hook.hook_id}__plays`];
                  const d = p[`${hook.hook_id}__dplays`];
                  const flag = p[`${hook.hook_id}__flag`];
                  const tick = p[`${hook.hook_id}__tick`];
                  const pull = p[`${hook.hook_id}__pull`];
                  const rate = p[hook.hook_id];
                  if (plays == null && rate == null) continue;
                  bits.push(
                    `${hook.hook_id} · ${tick ?? `T+${label}h`} · ${pull ?? ''} · ${plays ?? '—'} plays · ${d != null ? `+${d}` : '—'} · ${rate ?? '—'}/hr${flag ? ` · ${flag}` : ''}`,
                  );
                }
                return bits.join('\n') || `T+${label}h`;
              }}
            />
            {hotZones.map((z, i) => (
              <ReferenceArea
                key={i}
                x1={z.x1}
                x2={z.x2}
                fill="#E10600"
                fillOpacity={0.08}
                ifOverflow="extendDomain"
              />
            ))}
            {nowLines.map((n, i) => (
              <ReferenceLine
                key={`now-${i}`}
                x={n}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{ value: 'NOW', fill: 'var(--muted)', fontSize: 10 }}
              />
            ))}
            {selected.map((hook, i) => (
              <Line
                key={hook.hook_id}
                type="linear"
                dataKey={hook.hook_id}
                name={hook.hook_id}
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
      <div className="meta-bar" style={{ marginTop: -8 }}>
        connectNulls=false · gaps = mark not pulled · hollow baseline excluded from plays/hr
      </div>
    </div>
  );
}
