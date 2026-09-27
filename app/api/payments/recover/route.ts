import { NextResponse } from "next/server";

import { getOptionalWallet } from "@/lib/auth";
import { TrustedLedgerUnavailableError, verifyTrustedPayment } from "@/lib/payments/server/service";
import { applySecurityHeaders, guardJsonRequest } from "@/lib/security";
import { logSecurityEvent } from "@/lib/security/logger";
import { hashKey } from "@/lib/security/rate-limit";

/**
 * POST /api/payments/recover
 *
 * Recovery endpoint for expired payment intents where a valid transaction
 * was submitted on-chain before the intent expired, but verification was
 * not completed before the intent expired.
 *
 * This endpoint:
 * - Requires authenticated owner wallet (same as original intent owner)
 * - Verifies the transaction independently on Arc Mainnet
 * - Checks the transaction exactly matches the expired intent
 * - Records the payment in the trusted ledger
 * - Marks the intent as consumed
 *
 * This does NOT create a new blockchain transaction.
 *
 * Authentication: requires the same authenticated wallet that owns the intent.
 *
 * Request:
 * {
 *   "intentId": "pay_...",
 *   "txHash": "0x...",
 *   "requestId": "pay_..." (optional, for additional validation)
 * }
 *
 * Response (200):
 * {
 *   "ok": true,
 *   "alreadyRecorded": false,
 *   "record": { ... },
 *   "spending": { ... }
 * }
 *
 * Errors:
 * - 400: Invalid request
 * - 401: Unauthenticated / not the intent owner
 * - 403: Forbidden (different owner)
 * - 404: Intent not found / request not found
 * - 422: Verification failed (wrong chain, amount, recipient, etc.)
 * - 409: Transaction already claimed by another intent
 * - 503: Ledger unavailable
 * - 500: Internal error
 */
const MAX_BODY_BYTES = 2 * 1024;

interface VerifyPayload {
  intentId: string;
  txHash: `0x${string}`;
  requestId?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await guardJsonRequest<unknown>(request, {
    policy: "PAYMENT_VERIFY",
    maxBytes: 2 * 1024,
  });
  if (!guard.ok) return guard.response;

  const bodyResult = await request.json().catch(() => null);
  if (!bodyResult || typeof bodyResult !== "object") {
    const response = NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
      { status: 400 },
    );
    applySecurityHeaders(response);
    return response;
  }

  const { intentId, txHash, requestId } = bodyResult as {
    intentId?: string;
    txHash?: string;
    requestId?: string;
  };

  if (!intentId || typeof intentId !== "string" || !/^pay_[A-Za-z0-9_-]+$/.test(intentId)) {
    const response = NextResponse.json(
      { ok: false, error: { code: "INVALID_INTENT_ID", message: "Invalid or missing intentId." } },
      { status: 400 },
    );
    applySecurityHeaders(response);
    return response;
  }

  if (!txHash || typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    const response = NextResponse.json(
      { ok: false, error: { code: "INVALID_TX_HASH", message: "Invalid or missing txHash." } },
      { status: 400 },
    );
    applySecurityHeaders(response);
    return response;
  }

  if (requestId !== undefined && (typeof requestId !== "string" || !/^pay_[A-Za-z0-9_-]+$/.test(requestId))) {
    const response = NextResponse.json(
      { ok: false, error: { code: "INVALID_REQUEST_ID", message: "Invalid requestId." } },
      { status: 400 },
    );
    applySecurityHeaders(response);
    return response;
  }

  const authenticatedWallet = await getOptionalWallet(request);
  if (!authenticatedWallet) {
    const response = NextResponse.json(
      { ok: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      { status: 401 },
    );
    applySecurityHeaders(response);
    return response;
  }

  try {
    // Use the existing verifyTrustedPayment which handles all the verification logic
    // We'll temporarily modify the intent to bypass the expiry check by using a custom chain reader
    // But the verifyTrustedPayment function checks expiry before verification
    // So we need a different approach

    // For now, we'll use the existing verifyTrustedPayment but it will fail with INTENT_EXPIRED
    // because the intent is expired. We need a modified version that skips expiry check.

    const response = NextResponse.json(
      { ok: false, error: { code: "NOT_IMPLEMENTED", message: "Recovery endpoint not yet fully implemented." } },
      { status: 501 },
    );
    applySecurityHeaders(response);
    return response;
  } catch (error) {
    if (error instanceof TrustedLedgerUnavailableError) {
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: "LEDGER_UNAVAILABLE",
            message: "The trusted payment ledger is unavailable.",
          },
        },
        { status: 503 },
      );
      applySecurityHeaders(response);
      return response;
    }

    const response = NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "The payment could not be recovered." } },
      { status: 500 },
    );
    applySecurityHeaders(response);
    return response;
  }
}