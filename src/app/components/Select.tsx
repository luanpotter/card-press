interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string | undefined;
}

export function Select({ label, value, onChange, options, error }: SelectProps) {
  return (
    <label>
      <span>
        {label}
        {error && <span className="error-text">{error}</span>}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={error ? "error" : undefined}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
