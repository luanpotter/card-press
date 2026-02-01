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
        {error && <span className="error">[{error}]</span>}
      </legend>
      {children}
    </fieldset>
  );
}
