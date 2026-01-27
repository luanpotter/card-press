import { Router, Routes } from "./router/router";
import { Link } from "./components/Link";
import { ROUTES } from "./router/routes";

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
