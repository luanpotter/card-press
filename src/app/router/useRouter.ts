import { useContext } from "react";
import { type RouterContextValue, RouterContext } from "./routerContext";

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a Router");
  }
  return context;
}
