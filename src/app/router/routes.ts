import { Home } from "@/app/pages/Home";
import { Sessions } from "@/app/pages/Sessions";
import { Config } from "@/app/pages/Config";

export const ROUTES = [
  { path: "/", component: Home },
  { path: "/sessions", component: Sessions },
  { path: "/config", component: Config },
];
