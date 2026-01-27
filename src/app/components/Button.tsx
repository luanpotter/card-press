interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "accent" | "danger";
}

export function Button({ onClick, children, variant = "default" }: ButtonProps) {
  return (
    <button type="button" onClick={onClick} className={variant}>
      {children}
    </button>
  );
}
