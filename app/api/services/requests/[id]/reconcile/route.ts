import { NextResponse } from "next/server";

import { applySecurityHeaders, guardJsonRequest } from "@/lib/security";
import { getOptionalWallet } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security/logger";
import { hashKey } from "@/lib/security/rate-limit";

import { getTrustedRepository } from "@/lib/payments/server/factory";
import { createPostgresServiceRequestRepository } from "@/lib/services/postgres";
import { ServiceRequestError } from "@/lib/services/service";
import { TrustedLedgerUnavailableError } from "@/lib/payments/server/service";

import type { EvmAddress, TrustedPayment, PaymentIntent } from "@/types";
import type { SpendingSummary } from "@/lib/agent/policy";
import type { ServiceRequest, ServiceRequestStatus } from "@/types/service-request";

/**
 * POST /api/services/requests/:id/reconcile

/**
 * POST /api/services/requests/:id/reconcile
 *
 * Reconciles a service request that has an inconsistent state.
 * Specifically, restores a request that was incorrectly rejected
 * when it has a confirmed trusted payment.
 *
 * This is a reconciliation endpoint for operational recovery.
 *
 * Authentication: requires authenticated owner wallet.
 *
 * Request body:
 * {
 *   "expectedStatus": "payment_confirmed" (required)
 * }
 *
 * Response (200):
 * {
 *   "ok": true,
 *   "request": { ... }
 * }
 *
 * Errors:
 * - 400: Invalid request
 * - 401: Unauthenticated
 * - 403: Forbidden (different owner)
 * - 404: Request not found
 * - 422: Cannot reconcile (no matching trusted payment, wrong state, etc.)
 * - 503: Ledger unavailable
 * - 500: Internal error
 */
const MAX_BODY_BYTES = 1024;

interface ReconcilePayload {
  expectedStatus: "payment_confirmed";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await guardJsonRequest<{ expectedStatus: string }>(request, {
    policy: "SERVICE_FULFILL",
    maxBytes: 1024,
  });
  if (!guard.ok) return guard.response;

  const { expectedStatus } = guard.body;
  if (expectedStatus !== "payment_confirmed") {
    const response = NextResponse.json(
      { ok: false, error: { code: "INVALID_STATUS", message: "Only payment_confirmed is supported for reconciliation." } },
      { status: 400 },
    );
    applySecurityHeaders(response);
    return response;
  }

  const { id } = await params;

  if (!id || typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id) || id.length > 128) {
    const response = NextResponse.json(
      { ok: false, error: { code: "INVALID_ID", message: "Invalid request ID." } },
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
    const repository = createPostgresServiceRequestRepository(process.env.DATABASE_URL!);

    // Get the request
    const request = await repository.getById(id);
    if (!request) {
      const response = NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Service request not found." } },
        { status: 404 },
      );
      applySecurityHeaders(response);
      return response;
    }

    // Ownership check
    if (request.ownerWalletAddress?.toLowerCase() !== authenticatedWallet.toLowerCase()) {
      const response = NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "You are not authorised to reconcile this request." } },
        { status: 403 },
      );
      applySecurityHeaders(response);
      return response;
    }

    // Check current state
    if (request.status !== "rejected") {
      const response = NextResponse.json(
        { ok: false, error: { code: "INVALID_STATE", message: `Cannot reconcile request in state "${request.status}". Only rejected requests can be reconciled.` } },
        { status: 422 },
      );
      applySecurityHeaders(response);
      return response;
    }

    // Verify there's a confirmed trusted payment for this intent
    const trustedRepo = await getTrustedRepository();
    if (!request.paymentIntentId) {
      const response = NextResponse.json(
        { ok: false, error: { code: "NO_INTENT", message: "Request has no payment intent." } },
        { status: 422 },
      );
      applySecurityHeaders(response);
      return response;
    }

    const intent = await trustedRepo.getIntent(request.paymentIntentId);
    if (!intent) {
      const response = NextResponse.json(
        { ok: false, error: { code: "INTENT_NOT_FOUND", message: "Payment intent not found." } },
        { status: 404 },
      );
      applySecurityHeaders(response);
      return response;
    }

    if (intent.status !== "consumed" && intent.status !== "pending") {
      const response = NextResponse.json(
        { ok: false, error: { code: "INTENT_INVALID", message: "Payment intent is not in a consumable state." } },
        { status: 422 },
      );
      applySecurityHeaders(response);
      return response;
    }

    // Check for confirmed trusted payment
    const existingPayment = await trustedRepo.findByIntentId(request.paymentIntentId);
    if (!existingPayment || existingPayment.status !== "confirmed") {
      const response = NextResponse.json(
        { ok: false, error: { code: "NO_CONFIRMED_PAYMENT", message: "No confirmed trusted payment found for this intent." } },
        { status: 422 },
      );
      applySecurityHeaders(response);
      return response;
    }

    // Verify the trusted payment matches the original intent
    const trustedPayment = existingPayment;
    if (
      trustedPayment.recipient.toLowerCase() !== request.ownerWalletAddress?.toLowerCase() ||
      trustedPayment.amount.amount !== 0.1 ||
      trustedPayment.currency !== "USDC"
    ) {
      const response = NextResponse.json(
        { ok: false, error: { code: "PAYMENT_MISMATCH", message: "Trusted payment does not match expected values." } },
        { status: 422 },
      );
      applySecurityHeaders(response);
      return response;
    }

    // Update request to payment_confirmed state
    const now = new Date().toISOString();
    const updatedRequest: ServiceRequest = {
      ...request,
      status: "payment_confirmed" as ServiceRequestStatus,
      error: null,
      updatedAt: new Date().toISOString(),
      txHash: trustedPayment.txHash,
      trustedPaymentId: trustedPayment.id,
    };

    await repository.update(updatedRequest);

    logSecurityEvent({
      kind: "SERVICE_REQUEST_RECONCILED",
      keyHash: "request",
      detail: `requestId=${id} intentId=${request.paymentIntentId} trustedPaymentId=${trustedPayment.id}`,
    });

    const response = NextResponse.json({
      ok: true,
      request: updatedRequest,
    });
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
      { ok: false, error: { code: "INTERNAL_ERROR", message: "The request could not be reconciled." } },
      { status: 500 },
    );
    applySecurityHeaders(response);
    return response;
  }
}