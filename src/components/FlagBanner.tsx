import type { StackCall } from '../data/types';
import { hoursSincePostNow, windowProgress, fmtNum } from '../data/derive';

interface Props {
  call: StackCall;
}

export default function FlagBanner({ call }: Props) {
  const cls =
    call.kind === 'HOT' ? 'hot' : call.kind === 'SAFE' ? 'safe' : 'nocall';
  const driver = call.driver;
  const h = driver ? hoursSincePostNow(driver) : null;
  const win = driver ? windowProgress(driver) : null;

  return (
    <div className={`flag-banner ${cls}`}>
      <div className="eyebrow">STACK CALL</div>
      <div className="call">{call.label}</div>
      {driver && (
        <div className="driver">
          Driver: {driver.hook_id} · {driver.song}
          {h != null && <> · T+~{h.toFixed(1)}h</>}
        </div>
      )}
      <div className="meta">
        {call.flagText
          ? `Flag set: ${call.flagTimeHint || call.flagText} (from Sheet · Mage via General)`
          : call.kind === 'SAFE' && !driver
            ? 'No active hooks. Safe lane open.'
            : 'Flag from Hook_Registry only — dash does not compute the call.'}
        {' · '}Josh override: —
      </div>
      {driver && win && (
        <>
          <div className="meta" style={{ marginTop: 8 }}>
            Window closes: {driver.window_end_CT}
            {win.hours != null && (
              <> · {win.approx ? '~' : ''}{fmtNum(Math.round(win.hours * 10) / 10)}h / 48h</>
            )}
          </div>
          <div className="window-bar">
            <span style={{ width: `${win.pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
