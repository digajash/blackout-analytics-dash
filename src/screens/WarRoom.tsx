import type { DashData } from '../data/types';
import {
  calcPlaysPerHr,
  fmtDelta,
  fmtNum,
  formatPullDT,
  hoursSincePostNow,
  latestPullId,
  nextMark,
  sortAccountNewest,
  stackCall,
  ticksForHook,
  windowProgress,
} from '../data/derive';
import FlagBanner from '../components/FlagBanner';
import KpiCard from '../components/KpiCard';
import Spark from '../components/Spark';

interface Props {
  data: DashData;
}

export default function WarRoom({ data }: Props) {
  const call = stackCall(data.hooks);
  const accountSorted = sortAccountNewest(data.account);
  const latest = accountSorted[0];
  const sparkN = 7;
  const sparkSlice = accountSorted.slice(0, sparkN).reverse();

  const active = data.hooks.filter((h) => (h.status || '').toUpperCase() === 'ACTIVE');
  const holds = data.hooks.filter((h) => {
    const s = (h.status || '').toUpperCase();
    return s && s !== 'ACTIVE' && (s.includes('HOLD') || s.includes('PARK') || s.includes('WRAP'));
  });

  const latestPid = latestPullId(data.songs, data.account);
  const movers = data.songs
    .filter((s) => s.pull_id === latestPid)
    .sort((a, b) => (b.Δ_plays_vs_prior_pull ?? -Infinity) - (a.Δ_plays_vs_prior_pull ?? -Infinity))
    .slice(0, 5);

  const nowStr = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' CT';

  return (
    <div>
      <h1 className="screen-title">
        WAR ROOM
        <span className="clock">{nowStr}</span>
      </h1>

      <FlagBanner call={call} />

      <div className="section-label">ACCOUNT PULSE (Daily_Account · latest pull vs prior)</div>
      {latest ? (
        <div className="kpi-grid">
          <KpiCard
            label="TOTAL PLAYS"
            value={fmtNum(latest.total_plays)}
            delta={fmtDelta(latest.Δ_plays_vs_prior_pull)}
            deltaDir={(latest.Δ_plays_vs_prior_pull ?? 0) > 0 ? 'up' : (latest.Δ_plays_vs_prior_pull ?? 0) < 0 ? 'down' : 'flat'}
            spark={sparkSlice.map((r) => r.total_plays)}
          />
          <KpiCard
            label="FOLLOWERS"
            value={fmtNum(latest.followers)}
            delta={fmtDelta(latest.Δ_followers)}
            deltaDir={(latest.Δ_followers ?? 0) > 0 ? 'up' : 'flat'}
            spark={sparkSlice.map((r) => r.followers)}
          />
          <KpiCard
            label="LIKES"
            value={fmtNum(latest.total_likes)}
            delta={fmtDelta(latest.Δ_likes)}
            deltaDir={(latest.Δ_likes ?? 0) > 0 ? 'up' : 'flat'}
            spark={sparkSlice.map((r) => r.total_likes)}
          />
          <KpiCard
            label="COMMENTS"
            value={fmtNum(latest.total_comments)}
            delta={fmtDelta(latest.Δ_comments)}
            note="sum of song comments"
            spark={sparkSlice.map((r) => r.total_comments)}
          />
          <KpiCard
            label="PUBLIC SONGS"
            value={fmtNum(latest.songs_public)}
          />
        </div>
      ) : (
        <div className="no-signal">NO SIGNAL</div>
      )}
      <div className="meta-bar" style={{ marginTop: 8 }}>
        Δ = vs prior pull (stored Δ col) · sparkline = last 7 pulls · Today = last pull of day
      </div>

      <div className="section-label">ACTIVE HOOKS (Hook_Registry status = ACTIVE)</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {active.length === 0 ? (
          <div className="muted">No active hooks. Safe lane open.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>HOOK</th>
                <th>SONG</th>
                <th>POSTED (CT)</th>
                <th>T+NOW</th>
                <th>LAST TICK</th>
                <th>PLAYS/HR</th>
                <th>FLAG</th>
                <th>NEXT</th>
              </tr>
            </thead>
            <tbody>
              {active.map((h) => {
                const series = ticksForHook(data.ticks, h.hook_id);
                const last = [...series].reverse().find((t) => (t.hours_since_post ?? -1) >= 0) ?? series[series.length - 1];
                const tNow = hoursSincePostNow(h);
                const rate = last ? calcPlaysPerHr(last) : { value: null, calc: false };
                const nxt = nextMark(tNow);
                const rateSpark = series
                  .filter((t) => (t.hours_since_post ?? -1) >= 0)
                  .map((t) => calcPlaysPerHr(t).value);
                const flag = h.hot_safe_flag_latest || last?.hot_safe_flag || '';
                const isHot = flag.toUpperCase().includes('HOT');
                return (
                  <tr key={h.hook_id}>
                    <td>{h.hook_id}</td>
                    <td>{h.song}</td>
                    <td>
                      {h.posted_date} {h.posted_time_CT}
                    </td>
                    <td>{tNow != null ? `${tNow.toFixed(1)}h` : '—'}</td>
                    <td>
                      {last?.tick_label ?? '—'}
                      <div style={{ marginTop: 4 }}>
                        <Spark values={rateSpark} />
                      </div>
                    </td>
                    <td>
                      {rate.value != null ? (
                        <>
                          ▲ {rate.value}
                          {rate.calc && <span className="tag-calc">calc</span>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={isHot ? 'tag-hot' : flag ? 'tag-safe' : 'muted'}>
                      {flag ? (isHot ? '● HOT' : '● SAFE') : '—'}
                    </td>
                    <td>{nxt?.label ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-label">HOLDS / PARKED</div>
      <div className="panel holds">
        {holds.length === 0 ? (
          <span className="muted">
            No HOLD/PARKED rows in Hook_Registry yet. (Warrior #2 / FD #2 / CTA noted in SoT _Readme only — not invented here.)
          </span>
        ) : (
          holds.map((h) => (
            <span key={h.hook_id}>
              {h.hook_id}: {h.status} {h.wrap_note || h.notes}
            </span>
          ))
        )}
      </div>

      <div className="section-label">TOP MOVERS SINCE LAST PULL (Songs · {latestPid || '—'})</div>
      <div className="panel movers">
        {movers.length === 0 ? (
          <span className="muted">NO SIGNAL</span>
        ) : (
          movers.map((m, i) => (
            <div key={m.song}>
              <span className="rank">{i + 1}.</span>
              {m.song}{' '}
              <span style={{ color: (m.Δ_plays_vs_prior_pull ?? 0) > 0 ? 'var(--safe)' : 'var(--muted)' }}>
                {fmtDelta(m.Δ_plays_vs_prior_pull)} plays
              </span>
            </div>
          ))
        )}
      </div>

      {latest && (
        <div className="meta-bar" style={{ marginTop: 16 }}>
          Latest account pull: {latest.pull_id} · {formatPullDT(latest.date, latest.time_CT)}
          {call.driver && (
            <> · Window {Math.round(windowProgress(call.driver).pct)}% of 48h</>
          )}
        </div>
      )}
    </div>
  );
}
