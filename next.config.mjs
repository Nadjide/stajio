import constants from "next/constants.js";
import { validateProductionAuthConfig } from "./src/server/auth-config.mjs";

export default function nextConfig(phase) {
  if (phase === constants.PHASE_PRODUCTION_SERVER) validateProductionAuthConfig();
  return {};
}
