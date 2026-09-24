import { getService } from "@/lib/services/registry";
import { createInMemoryServiceRequestRepository, createInMemoryServiceResultRepository, type ServiceRequestRepository, type ServiceResultRepository } from "@/lib/services/repository";
import { getServiceAdapter } from "@/lib/services/adapters";
import { getTrustedRepository, type TrustedPaymentRepository } from "@/lib/payments/server/factory";
import { getTrustedSpending } from "@/lib/payments/server/service";
import { createPaymentId } from "@/lib/payments/id";
import type { ServiceRequest, ServiceResult, CreateServiceRequestInput, ServiceRequestStatus } from "@/types/service-request";
import type { TrustedPayment } from "@/types";
import type { SpendingSummary } from "@/lib/agent/policy";

/**
 * Service request lifecycle errors.
 */
export class ServiceRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "ServiceRequestError";
  }
}

export class ServiceRepositoryUnavailableError extends Error {
  constructor(message = "The service request repository is unavailable.") {
    super(message);
    this.name = "ServiceRepositoryUnavailableError";
  }
}

/**
 * Server-side service request state machine.
 *
 * This is the authoritative source for service request state.
 * The client may only observe state; it cannot drive transitions directly.
 */

let serviceRequestRepo: ServiceRequestRepository | null = null;
let serviceResultRepo: ServiceResultRepository | null = null;

function getServiceRequestRepo(): ServiceRequestRepository {
  if (!serviceRequestRepo) {
    serviceRequestRepo = createInMemoryServiceRequestRepository();
  }
  return serviceRequestRepo;
}

function getServiceResultRepo(): ServiceResultRepository {
  if (!serviceResultRepo) {
    serviceResultRepo = createInMemoryServiceResultRepository();
  }
  return serviceResultRepo;
}

/** Reset for testing. */
export function setServiceRepositoriesForTesting(
  requestRepo: ServiceRequestRepository | null,
  resultRepo: ServiceResultRepository | null,
): void {
  serviceRequestRepo = requestRepo;
  serviceResultRepo = resultRepo;
}

/**
 * Create a new service request and obtain a payment intent.
 *
 * The request is created in "payment_required" state. The client must
 * complete the payment intent before fulfillment can proceed.
 */
export async function createServiceRequest(input: CreateServiceRequestInput): Promise<{
  request: ServiceRequest;
  spending: SpendingSummary;
}> {
  const repo = getServiceRequestRepo();
  const service = getService(input.serviceId);

  if (!service) {
    throw new ServiceRequestError("Service not found.", "UNKNOWN_SERVICE", 404);
  }
  if (!service.active) {
    throw new ServiceRequestError("Service is not active.", "SERVICE_INACTIVE", 422);
  }

  // Get trusted spending to check policy limits before creating intent
  const spending = await getTrustedSpending();

  const now = new Date().toISOString();
  const request: ServiceRequest = {
    id: createPaymentId(),
    agentId: input.agentId,
    serviceId: service.id,
    serviceName: service.name,
    input: input.input,
    paymentIntentId: null,
    trustedPaymentId: null,
    txHash: null,
    status: "payment_required",
    error: null,
    createdAt: now,
    updatedAt: now,
    fulfilledAt: null,
    ownerWalletAddress: input.ownerWalletAddress,
  };

  await repo.create(request);

  return { request, spending };
}

/**
 * Link a payment intent to a service request.
 *
 * Called after the server creates a payment intent for this request.
 */
export async function linkPaymentIntent(
  requestId: string,
  paymentIntentId: string,
): Promise<ServiceRequest> {
  const repo = getServiceRequestRepo();
  const request = await repo.getById(requestId);

  if (!request) {
    throw new ServiceRequestError("Service request not found.", "REQUEST_NOT_FOUND", 404);
  }

  if (request.status !== "payment_required") {
    throw new ServiceRequestError(
      `Cannot link payment intent in state "${request.status}".`,
      "INVALID_STATE",
      409,
    );
  }

  const updated: ServiceRequest = {
    ...request,
    paymentIntentId,
    status: "payment_pending",
    updatedAt: new Date().toISOString(),
  };

  await repo.update(updated);
  return updated;
}

/**
 * Record the wallet transaction hash for a service request.
 */
export async function recordTransactionHash(
  requestId: string,
  txHash: `0x${string}`,
): Promise<ServiceRequest> {
  const repo = getServiceRequestRepo();
  const request = await repo.getById(requestId);

  if (!request) {
    throw new ServiceRequestError("Service request not found.", "REQUEST_NOT_FOUND", 404);
  }

  if (request.status !== "payment_pending") {
    throw new ServiceRequestError(
      `Cannot record transaction hash in state "${request.status}".`,
      "INVALID_STATE",
      409,
    );
  }

  const updated: ServiceRequest = {
    ...request,
    txHash,
    updatedAt: new Date().toISOString(),
  };

  await repo.update(updated);
  return updated;
}

/**
 * Attempt to fulfill a service request after payment verification.
 *
 * This is the only place that transitions to fulfillment_pending/fulfilled/failed.
 * It requires a verified trusted payment.
 */
export async function fulfillServiceRequest(requestId: string): Promise<{
  request: ServiceRequest;
  result: ServiceResult | null;
}> {
  const requestRepo = getServiceRequestRepo();
  const resultRepo = getServiceResultRepository();
  const trustedRepo = await getTrustedRepository();

  const request = await requestRepo.getById(requestId);
  if (!request) {
    throw new ServiceRequestError("Service request not found.", "REQUEST_NOT_FOUND", 404);
  }

  // Must have a payment intent and trusted payment
  if (!request.paymentIntentId) {
    throw new ServiceRequestError("No payment intent linked.", "NO_PAYMENT_INTENT", 409);
  }

  // Check if trusted payment exists and matches
  const trustedPayment = await findTrustedPaymentForRequest(trustedRepo, request);
  if (!trustedPayment) {
    throw new ServiceRequestError(
      "No verified payment found for this request. Payment must be verified first.",
      "PAYMENT_NOT_VERIFIED",
      409,
    );
  }

  // Check if already fulfilled
  if (request.status === "fulfilled" || request.status === "failed") {
    const existingResult = await resultRepo.getByRequestId(requestId);
    return { request, result: existingResult };
  }

  // Transition to fulfillment_pending
  const pendingRequest: ServiceRequest = {
    ...request,
    trustedPaymentId: trustedPayment.id,
    status: "fulfillment_pending",
    updatedAt: new Date().toISOString(),
  };
  await requestRepo.update(pendingRequest);

  try {
    // Execute service adapter
    const adapter = getServiceAdapter(request.serviceId);
    if (!adapter) {
      throw new ServiceRequestError("No adapter for service.", "NO_ADAPTER", 500);
    }

    const output = await adapter.execute(request.input as Record<string, unknown>);
    const now = new Date().toISOString();

    // Create success result
    const result: ServiceResult = {
      id: createPaymentId(),
      requestId: request.id,
      serviceId: request.serviceId,
      status: "fulfilled",
      output: output as Record<string, unknown>,
      error: null,
      trustedPaymentId: trustedPayment.id,
      fulfilledAt: now,
      createdAt: now,
    };

    const fulfilledRequest: ServiceRequest = {
      ...pendingRequest,
      status: "fulfilled",
      trustedPaymentId: trustedPayment.id,
      fulfilledAt: now,
      updatedAt: now,
    };

    await resultRepo.create(result);
    await requestRepo.update(fulfilledRequest);

    return { request: fulfilledRequest, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service fulfillment failed.";
    const now = new Date().toISOString();

    // Create failure result
    const result: ServiceResult = {
      id: createPaymentId(),
      requestId: request.id,
      serviceId: request.serviceId,
      status: "failed",
      output: null,
      error: message,
      trustedPaymentId: trustedPayment.id,
      fulfilledAt: now,
      createdAt: now,
    }

    const failedRequest: ServiceRequest = {
      ...pendingRequest,
      status: "failed",
      error: message,
      fulfilledAt: now,
      updatedAt: now,
    };

    await resultRepo.create(result);
    await requestRepo.update(failedRequest);

    return { request: failedRequest, result };
  }
}

/**
 * Find the trusted payment that corresponds to this service request.
 *
 * Matches by serviceId and payment intent (via txHash if available).
 */
async function findTrustedPaymentForRequest(
  repo: TrustedPaymentRepository,
  request: ServiceRequest,
): Promise<TrustedPayment | null> {
  const payments: TrustedPayment[] = await repo.listPayments();

  // First try exact match by serviceId and txHash (if we have it)
  if (request.txHash) {
    const byHash = payments.find(
      (p: TrustedPayment) => p.serviceId === request.serviceId && p.txHash.toLowerCase() === request.txHash!.toLowerCase(),
    );
    if (byHash) return byHash;
  }

  // Fallback: find by serviceId and payment intent (via agentId + serviceId + recent)
  const byService = payments
    .filter((p: TrustedPayment) => p.serviceId === request.serviceId && p.agentId === request.agentId)
    .sort((a: TrustedPayment, b: TrustedPayment) => b.confirmedAt.localeCompare(a.confirmedAt));

  return byService[0] ?? null;
}

function getServiceResultRepository(): ServiceResultRepository {
  return getServiceResultRepo();
}

/**
 * Get a service request by ID.
 */
export async function getServiceRequest(requestId: string): Promise<ServiceRequest | null> {
  const repo = getServiceRequestRepo();
  return repo.getById(requestId);
}

/**
 * Get service result for a request.
 */
export async function getServiceResult(requestId: string): Promise<ServiceResult | null> {
  const repo = getServiceResultRepository();
  return repo.getByRequestId(requestId);
}

/**
 * List all service requests.
 */
export async function listServiceRequests(): Promise<ServiceRequest[]> {
  const repo = getServiceRequestRepo();
  return repo.listAll();
}

/**
 * List all service results.
 */
export async function listServiceResults(): Promise<ServiceResult[]> {
  const repo = getServiceResultRepository();
  return repo.listAll();
}

/**
 * Valid state transitions for service requests.
 */
export const SERVICE_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, readonly ServiceRequestStatus[]> = {
  requested: ["payment_required"],
  payment_required: ["payment_pending", "failed"],
  payment_pending: ["payment_confirmed", "failed"],
  payment_confirmed: ["fulfillment_pending", "failed"],
  fulfillment_pending: ["fulfilled", "failed"],
  fulfilled: [],
  failed: [],
};

export function canTransitionServiceRequest(from: ServiceRequestStatus, to: ServiceRequestStatus): boolean {
  return SERVICE_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}