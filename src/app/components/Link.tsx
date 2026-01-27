import { useRouter } from "../router/useRouter";

interface LinkProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}

export function Link({ href, children, active = true }: LinkProps) {
  const { path } = useRouter();
  const isCurrentPath = path === href || (href === "/" && path === "/");

  const className = active && isCurrentPath ? "active" : undefined;

  return (
    <a href={`#${href}`} className={className}>
      <span>{children}</span>
    </a>
  );
}
