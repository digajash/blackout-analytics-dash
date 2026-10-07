import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
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
  dailyLastPull,
  fmtDelta,
  fmtNum,
  formatPullDT,
  pullDateTime,
  sortAccountNewest,
} from '../data/derive';
import KpiCard from '../components/KpiCard';

interface Props {
  data: DashData;
}

type Range = '7D' | '14D' | '30D' | 'ALL';

export default function Account({ data }: Props) {
  const [range, setRange] = useState<Range>('ALL');
  const [granularity, setGranularity] = useState<'daily' | 'every'>('daily');

  const sorted = sortAccountNewest(data.account);
  const daily = dailyLastPull(data.account);

  const cutoff = useMemo(() => {
    if (range === 'ALL') return null;
    const days = range === '7D' ? 7 : range === '14D' ? 14 : 30;
    return Date.now() - days * 86_400_000;
  }, [range]);

  const series = useMemo(() => {
    const rows = granularity === 'daily' ? daily : [...data.account].sort((a, b) => {
      const da = pullDateTime(a.date, a.time_CT)?.getTime() ?? 0;
      const db = pullDateTime(b.date, b.time_CT)?.getTime() ?? 0;
      return da - db;
    });
    return rows.filter((r) => {
      const dt = pullDateTime(r.date, r.time_CT);
      if (!dt) return true;
      if (cutoff && dt.getTime() < cutoff) return false;
      return true;
    });
  }, [data.account, daily, granularity, cutoff]);

  // Daily Δ/day = today's total − prior day's total (calc)
  const playsChart = useMemo(() => {
    const rows = granularity === 'daily' ? series : series;
    return rows.map((r, i) => {
      let deltaDay: number | null = null;
      let calc = false;
      if (granularity === 'daily') {
        const prev = rows[i - 1];
        if (prev?.total_plays != null && r.total_plays != null) {
          deltaDay = r.total_plays - prev.total_plays;
          calc = true;
        }
      } else {
        deltaDay = r.Δ_plays_vs_prior_pull;
      }
      const dt = pullDateTime(r.date, r.time_CT);
      return {
        t: dt?.getTime() ?? i,
        label: granularity === 'daily' ? r.date : formatPullDT(r.date, r.time_CT),
        total: r.total_plays,
        delta: deltaDay,
        calc,
        followers: r.followers,
        dFollowers: r.Δ_followers,
        pull_id: r.pull_id,
      };
    });
  }, [series, granularity]);

  const latestDaily = daily.length ? daily[daily.length - 1] : null;
  const priorDaily = daily.length > 1 ? daily[daily.length - 2] : null;
  const todayVsYday = (field: 'total_plays' | 'followers' | 'total_likes') => {
    if (!latestDaily || !priorDaily) return null;
    const a = latestDaily[field];
    const b = priorDaily[field];
    if (a == null || b == null) return null;
    return a - b;
  };

  const hookTicks = data.hooks
    .map((h) => {
      const dt = pullDateTime(h.posted_date, h.posted_time_CT.replace(/^~/, ''));
      return dt ? { t: dt.getTime(), id: h.hook_id } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const log = sorted;

  return (
    <div>
      <h1 className="screen-title">ACCOUNT</h1>

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
          <span>Granularity:</span>
          <button
            className={`chip ${granularity === 'daily' ? 'on' : ''}`}
            onClick={() => setGranularity('daily')}
          >
            {granularity === 'daily' ? '● ' : ''}daily (last pull/day)
          </button>
          <button
            className={`chip ${granularity === 'every' ? 'on' : ''}`}
            onClick={() => setGranularity('every')}
          >
            {granularity === 'every' ? '● ' : ''}every pull
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard
          label="PLAYS"
          value={fmtNum(latestDaily?.total_plays ?? sorted[0]?.total_plays ?? null)}
          delta={
            todayVsYday('total_plays') != null
              ? `${fmtDelta(todayVsYday('total_plays'))} today vs yday`
              : fmtDelta(sorted[0]?.Δ_plays_vs_prior_pull)
          }
          deltaDir={(todayVsYday('total_plays') ?? 0) > 0 ? 'up' : 'flat'}
        />
        <KpiCard
          label="FOLLOWERS"
          value={fmtNum(latestDaily?.followers ?? sorted[0]?.followers ?? null)}
          delta={
            todayVsYday('followers') != null
              ? `${fmtDelta(todayVsYday('followers'))} today vs yday`
              : fmtDelta(sorted[0]?.Δ_followers)
          }
          deltaDir={(todayVsYday('followers') ?? 0) > 0 ? 'up' : 'flat'}
        />
        <KpiCard
          label="LIKES"
          value={fmtNum(latestDaily?.total_likes ?? sorted[0]?.total_likes ?? null)}
          delta={
            todayVsYday('total_likes') != null
              ? `${fmtDelta(todayVsYday('total_likes'))} today vs yday`
              : fmtDelta(sorted[0]?.Δ_likes)
          }
        />
        <KpiCard
          label="FOLLOWING"
          value={fmtNum(latestDaily?.following ?? sorted[0]?.following ?? null)}
        />
      </div>

      <div className="section-label">DAILY PLAYS (bars = Δ · line = total)</div>
      <div className="panel">
        <div className="chart-wrap tall">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={playsChart} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
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
                yAxisId="delta"
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                yAxisId="total"
                orientation="right"
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
                  const p = payload?.[0]?.payload as { label?: string; calc?: boolean };
                  return `${p?.label ?? ''}${p?.calc ? ' · Δ calc' : ''}`;
                }}
              />
              {hookTicks.map((h) => (
                <ReferenceLine
                  key={h.id}
                  yAxisId="total"
                  x={h.t}
                  stroke="#E10600"
                  strokeWidth={1}
                />
              ))}
              <Bar yAxisId="delta" dataKey="delta" fill="#E10600" fillOpacity={0.55} name="Δ plays" />
              <Line
                yAxisId="total"
                type="linear"
                dataKey="total"
                stroke="#EDEAE4"
                strokeWidth={2}
                dot={{ r: 3, fill: '#EDEAE4', strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
                name="total plays"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="meta-bar">
          In daily mode, Δ/day = day total − prior day total <span className="tag-calc">calc</span>
          {' · '}Comments = sum of song comments
        </div>
      </div>

      <div className="section-label">FOLLOWERS (step)</div>
      <div className="panel">
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={playsChart} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
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
                domain={['auto', 'auto']}
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
              />
              <Line
                type="stepAfter"
                dataKey="followers"
                stroke="#E10600"
                strokeWidth={2}
                dot={{ r: 3, fill: '#E10600', strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
                name="followers"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section-label">PULL LOG (newest first)</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>pull_id</th>
              <th>type</th>
              <th>plays</th>
              <th>Δ</th>
              <th>likes</th>
              <th>cmts</th>
              <th>foll</th>
              <th>Δf</th>
              <th>songs</th>
              <th>notes</th>
            </tr>
          </thead>
          <tbody>
            {log.map((r) => (
              <tr key={r.pull_id}>
                <td>
                  {r.pull_id}
                  <div className="muted">{formatPullDT(r.date, r.time_CT)}</div>
                </td>
                <td>{r.pull_type}</td>
                <td>{fmtNum(r.total_plays)}</td>
                <td>{fmtDelta(r.Δ_plays_vs_prior_pull)}</td>
                <td>{fmtNum(r.total_likes)}</td>
                <td>{fmtNum(r.total_comments)}</td>
                <td>{fmtNum(r.followers)}</td>
                <td>{fmtDelta(r.Δ_followers)}</td>
                <td>{fmtNum(r.songs_public)}</td>
                <td className="muted">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
