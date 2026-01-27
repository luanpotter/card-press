import { Home } from "../pages/Home";
import { Sessions } from "../pages/Sessions";
import { Config } from "../pages/Config";

export const ROUTES = [
  { path: "/", component: Home },
  { path: "/sessions", component: Sessions },
  { path: "/config", component: Config },
];
