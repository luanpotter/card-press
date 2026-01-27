import { useState, useEffect } from "react";
import { RouterContext } from "@/app/router/routerContext";
import { useRouter } from "@/app/router/useRouter";

function getHashPath(): string {
  const hash = window.location.hash.slice(1);
  return hash || "/";
}

interface RouterProps {
  children: React.ReactNode;
}

export function Router({ children }: RouterProps) {
  const [path, setPath] = useState(getHashPath);

  useEffect(() => {
    const handleHashChange = () => {
      setPath(getHashPath());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const navigate = (newPath: string) => {
    window.location.hash = newPath;
  };

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

interface RouteConfig {
  path: string;
  component: React.ComponentType;
}

interface RoutesProps {
  routes: RouteConfig[];
}

export function Routes({ routes }: RoutesProps) {
  const { path } = useRouter();

  const match = routes.find((route) => route.path === path);

  if (match) {
    const Component = match.component;
    return <Component />;
  }

  const defaultRoute = routes[0];
  if (defaultRoute) {
    const Component = defaultRoute.component;
    return <Component />;
  }

  return null;
}
