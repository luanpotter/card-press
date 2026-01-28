interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "accent" | "danger";
  disabled?: boolean;
  title?: string;
}

export function Button({ onClick, children, variant = "default", disabled, title }: ButtonProps) {
  return (
    <button type="button" onClick={onClick} className={variant} disabled={disabled} title={title}>
      {children}
    </button>
  );
}
