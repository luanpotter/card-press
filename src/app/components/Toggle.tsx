interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="toggle">
      <span className={`toggle-track ${checked ? "checked" : ""}`}>
        <span className="toggle-thumb" />
      </span>
      {label && <span>{label}</span>}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} hidden />
    </label>
  );
}
