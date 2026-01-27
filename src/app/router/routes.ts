import { Home } from "@/app/pages/Home";
import { Sessions } from "@/app/pages/Sessions";
import { Templates } from "@/app/pages/Templates";
import { Config } from "@/app/pages/Config";

export const ROUTES = [
  { path: "/", component: Home },
  { path: "/sessions", component: Sessions },
  { path: "/templates", component: Templates },
  { path: "/config", component: Config },
];
