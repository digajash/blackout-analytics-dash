import Spark from './Spark';

interface Props {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'flat';
  spark?: (number | null)[];
  note?: string;
}

export default function KpiCard({ label, value, delta, deltaDir, spark, note }: Props) {
  return (
    <div className="kpi-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta != null && (
        <div className={`delta ${deltaDir === 'up' ? 'up' : deltaDir === 'down' ? 'down' : ''}`}>
          {delta}
        </div>
      )}
      {spark && <Spark values={spark} />}
      {note && <div className="delta" style={{ marginTop: 4 }}>{note}</div>}
    </div>
  );
}
