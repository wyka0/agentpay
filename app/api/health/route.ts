import { NextResponse } from "next/server";

import { hasDurableLedger, getTrustedRepository } from "@/lib/payments/server/factory";
import { validateEnvironment } from "@/lib/config/validation";
import { hasDurableAuth, getAuthSessionRepository } from "@/lib/auth";
import { applySecurityHeaders, getServerRuntime } from "@/lib/security";

/**
 * GET /api/health
 *
 * Liveness + readiness endpoint.
 *
 * Returns:
 * - application: "alive"
 * - trustedLedger: "ready" | "not_configured" | "unavailable"
 * - authSessions: "ready" | "not_configured" | "unavailable"
 * - environment: validation status (missing required keys only, never values)
 * - runtime: "production" | "development" | "test"
 *
 * Does NOT expose:
 * - database credentials
 * - environment variable values
 * - internal infrastructure details
 * - secrets
 *
 * The endpoint is unauthenticated and rate limited (it is a low-cost
 * probe).
 */
export async function GET(): Promise<NextResponse> {
  const ledgerStatus = await checkLedger();
  const authStatus = await checkAuth();
  const envValidation = validateEnvironment();

  const response = NextResponse.json({
    ok: true,
    application: "alive",
    trustedLedger: ledgerStatus,
    authSessions: authStatus,
    environment: {
      ok: envValidation.ok,
      missingRequiredCount: envValidation.missingRequired.length,
      // Names only — never values.
      missingRequired: envValidation.missingRequired.map((s) => s.split(" ")[0]),
      warnings: envValidation.warnings,
    },
    runtime: getServerRuntime(),
    timestamp: new Date().toISOString(),
  });
  applySecurityHeaders(response);
  return response;
}

async function checkLedger(): Promise<"ready" | "not_configured" | "unavailable"> {
  if (!hasDurableLedger()) return "not_configured";
  try {
    await getTrustedRepository();
    return "ready";
  } catch {
    return "unavailable";
  }
}

async function checkAuth(): Promise<"ready" | "not_configured" | "unavailable"> {
  if (!hasDurableAuth()) return "not_configured";
  try {
    await getAuthSessionRepository();
    return "ready";
  } catch {
    return "unavailable";
  }
}