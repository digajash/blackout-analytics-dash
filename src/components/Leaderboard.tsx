import { useMemo, useState } from 'react';
import { fmtDelta, fmtNum } from '../data/derive';

export interface LeaderRow {
  song: string;
  latest_plays: number | null;
  latest_likes: number | null;
  latest_comments: number | null;
  Δ_last_pull: number | null;
  Δ_plays_since_first_log: number | null;
  pulls_logged: number;
  dataCheck?: boolean;
  hasActiveHook?: boolean;
}

type SortKey = keyof LeaderRow;

interface Props {
  rows: LeaderRow[];
  selected?: string | null;
  onSelect?: (song: string) => void;
}

export default function Leaderboard({ rows, selected, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('latest_plays');
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = typeof av === 'number' ? av : -Infinity;
      const bn = typeof bv === 'number' ? bv : -Infinity;
      return asc ? an - bn : bn - an;
    });
    return copy;
  }, [rows, sortKey, asc]);

  function clickHeader(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(false);
    }
  }

  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th onClick={() => clickHeader('song')}>SONG</th>
            <th onClick={() => clickHeader('latest_plays')}>PLAYS</th>
            <th onClick={() => clickHeader('latest_likes')}>LIKES</th>
            <th onClick={() => clickHeader('latest_comments')}>CMTS</th>
            <th onClick={() => clickHeader('Δ_last_pull')}>Δ LAST PULL</th>
            <th onClick={() => clickHeader('Δ_plays_since_first_log')}>Δ SINCE 1st LOG</th>
            <th onClick={() => clickHeader('pulls_logged')}>PULLS</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.song}
              className={selected === r.song ? 'selected' : ''}
              onClick={() => onSelect?.(r.song)}
              style={{ cursor: onSelect ? 'pointer' : undefined }}
            >
              <td className="muted">{i + 1}</td>
              <td>
                {r.hasActiveHook && <span style={{ color: 'var(--blackout-red)' }}>● </span>}
                {r.song}
                {r.dataCheck && <span className="tag-warn"> ⚠ data check</span>}
              </td>
              <td>{fmtNum(r.latest_plays)}</td>
              <td>{fmtNum(r.latest_likes)}</td>
              <td>{fmtNum(r.latest_comments)}</td>
              <td>{fmtDelta(r.Δ_last_pull)}</td>
              <td>{r.Δ_plays_since_first_log != null ? `+${fmtNum(r.Δ_plays_since_first_log)}` : '—'}</td>
              <td>{r.pulls_logged}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
