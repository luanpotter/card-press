interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | undefined;
  type?: "text" | "number";
}

export function Input({ label, value, onChange, placeholder, error, type = "text" }: InputProps) {
  return (
    <label>
      <span>
        {label}
        {error && <span className="error-text">[{error}]</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={error ? "error" : undefined}
      />
    </label>
  );
}
