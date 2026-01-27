interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | undefined;
}

export function Input({ label, value, onChange, placeholder, error }: InputProps) {
  return (
    <label>
      <span>
        {label}
        {error && <span className="error-text">[{error}]</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={error ? "error" : undefined}
      />
    </label>
  );
}
