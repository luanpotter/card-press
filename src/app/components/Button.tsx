interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "accent" | "danger";
  disabled?: boolean;
}

export function Button({ onClick, children, variant = "default", disabled }: ButtonProps) {
  return (
    <button type="button" onClick={onClick} className={variant} disabled={disabled}>
      {children}
    </button>
  );
}
