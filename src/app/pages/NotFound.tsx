import { Link } from "@/app/components/Link";

export function NotFound() {
  return (
    <main>
      <strong className="danger">Page not found.</strong>
      <p>
        <Link href="/">Go home</Link>
      </p>
    </main>
  );
}
