import type { ReactNode } from "react";

interface BoxProps {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}

export function Box({ label, error, children }: BoxProps) {
  return (
    <fieldset className={error ? "error" : undefined}>
      <legend>
        <span>{label}</span>
        {error && (
          <>
            <span className="legend-border" />
            <span className="error-text">[{error}]</span>
          </>
        )}
      </legend>
      {children}
    </fieldset>
  );
}
