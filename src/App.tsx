import { useCallback, useEffect, useMemo, useState } from 'react';
import './theme.css';
import { CACHE_TTL_MS, STALE_AMBER_H, STALE_GREEN_H, BUILD_VERSION } from './config';
import { loadAll } from './data/load';
import type { DashData } from './data/types';
import {
  dataAgeHours,
  formatPullDT,
  latestPullId,
  sortAccountNewest,
} from './data/derive';
import WarRoom from './screens/WarRoom';
import Hooks from './screens/Hooks';
import Songs from './screens/Songs';
import Account from './screens/Account';

type Route = 'war' | 'hooks' | 'songs' | 'account';

function routeFromHash(): Route {
  const h = (window.location.hash.replace(/^#\/?/, '') || 'war').toLowerCase();
  if (h === 'hooks' || h === 'songs' || h === 'account' || h === 'war') return h;
  return 'war';
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async (force = true) => {
    setLoading(true);
    setErr(null);
    try {
      const d = await loadAll(force);
      setData(d);
      if (d.error) setErr(d.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const id = window.setInterval(() => refresh(true), CACHE_TTL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.location.hash = '#/war';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const lastPull = useMemo(() => {
    if (!data) return null;
    const pid = latestPullId(data.songs, data.account, data.ticks);
    const row =
      sortAccountNewest(data.account).find((r) => r.pull_id === pid) ||
      data.songs.find((r) => r.pull_id === pid);
    return row
      ? { pid, label: formatPullDT(row.date, row.time_CT), date: row.date, time: row.time_CT }
      : { pid, label: pid, date: '', time: '' };
  }, [data]);

  const ageH = useMemo(() => {
    if (!data || !lastPull?.pid) return null;
    return dataAgeHours(lastPull.pid, data.account, data.songs);
  }, [data, lastPull]);

  const staleClass =
    ageH == null ? 'amber' : ageH < STALE_GREEN_H ? 'green' : ageH < STALE_AMBER_H ? 'amber' : 'red';

  const ageLabel =
    ageH == null
      ? '—'
      : ageH < 1
        ? `${Math.round(ageH * 60)}m`
        : `${Math.floor(ageH)}h ${Math.round((ageH % 1) * 60)}m`;

  const nav = (
    <>
      {(
        [
          ['war', 'WAR ROOM'],
          ['hooks', 'HOOKS'],
          ['songs', 'SONGS'],
          ['account', 'ACCOUNT'],
        ] as const
      ).map(([r, label]) => (
        <a key={r} href={`#/${r}`} className={route === r ? 'active' : ''}>
          {label}
        </a>
      ))}
    </>
  );

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="wordmark">
          ■ BLACKOUT <span>// ANALYTICS</span>
        </div>
        <nav className="nav">{nav}</nav>
        <div className="meta-bar">
          {lastPull && (
            <span>
              Last pull: {lastPull.pid} · {lastPull.label}
            </span>
          )}
          <span>
            <span className={`live-dot ${staleClass}`} />
            {staleClass === 'green' ? 'LIVE' : staleClass === 'amber' ? 'AGING' : 'STALE'}
          </span>
          <span>Data age: {ageLabel}</span>
          {data && <span>mode: {data.mode}</span>}
          <button className="btn-refresh" onClick={() => refresh(true)} type="button">
            ↻ Refresh
          </button>
        </div>
      </header>

      <main className="shell-main">
        {err && <div className="error-bar">{err}</div>}
        {loading && !data && (
          <>
            <div className="skeleton" />
            <div className="skeleton" style={{ height: 200 }} />
          </>
        )}
        {!loading && !data && !err && <div className="no-signal">NO SIGNAL</div>}
        {data && route === 'war' && <WarRoom data={data} />}
        {data && route === 'hooks' && <Hooks data={data} />}
        {data && route === 'songs' && <Songs data={data} />}
        {data && route === 'account' && <Account data={data} />}
      </main>

      <footer className="shell-footer">
        SoT: Blackout_Suno_Metrics_SoT ↗ · read-only · times CT · build {BUILD_VERSION}
        {data && (
          <>
            {' · '}
            fetched {new Date(data.fetchedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
          </>
        )}
      </footer>

      <nav className="bottom-nav">{nav}</nav>
    </div>
  );
}

// silence unused import warning helpers used for typing only
