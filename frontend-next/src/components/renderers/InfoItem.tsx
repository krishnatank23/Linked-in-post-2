export function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value ?? "N/A";
  return (
    <div className="output-item">
      <div className="output-item-label">{label}</div>
      <div className="output-item-value">{String(displayValue)}</div>
    </div>
  );
}

export function TagSection({ label, items, tagClass = "" }: { label?: string; items?: string[] | null; tagClass?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      {label && (
        <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", margin: "0.4rem 0 0.3rem", fontWeight: 500 }}>
          {label}
        </p>
      )}
      <div className="tag-list">
        {items.filter(Boolean).map((item, i) => (
          <span key={i} className={`tag ${tagClass}`}>{String(item)}</span>
        ))}
      </div>
    </>
  );
}
