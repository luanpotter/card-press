interface ProgressModalProps {
  title: string;
  current: number;
  total: number;
  label?: string;
}

export function ProgressModal({ title, current, total, label }: ProgressModalProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: "300px" }}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p>
              {current} / {total}
            </p>
            {label && (
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {label}
              </p>
            )}
            <div
              style={{
                marginTop: "1rem",
                background: "var(--border)",
                height: "4px",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "var(--accent)",
                  height: "100%",
                  width: `${String(percent)}%`,
                  transition: "width 0.1s",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
