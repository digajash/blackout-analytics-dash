interface Props {
  values: (number | null)[];
}

export default function Spark({ values }: Props) {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return (
    <div className="spark" title={`last ${values.length} pulls`}>
      {values.map((v, i) => {
        const h = v == null ? 2 : Math.max(4, ((v - min) / range) * 24 + 4);
        return (
          <span
            key={i}
            className={v != null && v === max ? 'peak' : ''}
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}
