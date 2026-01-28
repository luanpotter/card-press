import { Home } from "@/app/pages/home/Home";
import { Sessions } from "@/app/pages/sessions/Sessions";
import { Templates } from "@/app/pages/templates/Templates";
import { Config } from "@/app/pages/config/Config";
import { About } from "@/app/pages/about/About";

export const ROUTES = [
  { path: "/", component: Home },
  { path: "/sessions", component: Sessions },
  { path: "/templates", component: Templates },
  { path: "/config", component: Config },
  { path: "/about", component: About },
];
