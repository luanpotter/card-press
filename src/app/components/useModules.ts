import { useSyncExternalStore } from "react";
import { getModules, subscribeModules, type ModuleState } from "@/utils/lazyModules";

/**
 * The download status of every lazily loaded module, kept up to date
 */
export function useModules(): ModuleState[] {
  return useSyncExternalStore(subscribeModules, getModules);
}
