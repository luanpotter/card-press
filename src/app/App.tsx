import { Router, Routes } from "@/app/router/router";
import { Link } from "@/app/components/Link";
import { ROUTES } from "@/app/router/routes";

export function App() {
  return (
    <Router>
      <main>
        <menu>
          <Link href="/">Card Press</Link>
          <Link href="/sessions">Sessions</Link>
          <Link href="/config">Config</Link>
        </menu>
        <Routes routes={ROUTES} />
      </main>
    </Router>
  );
}

export default App;
