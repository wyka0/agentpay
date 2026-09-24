import type { ServiceRequest, ServiceResult } from "@/types/service-request";

/**
 * In-memory service request repository.
 *
 * Used for tests and development. A production implementation would use PostgreSQL.
 */
export function createInMemoryServiceRequestRepository() {
  const requests = new Map<string, ServiceRequest>();
  const requestsByIdempotency = new Map<string, string>(); // agentId:idempotencyKey -> requestId

  return {
    async create(request: ServiceRequest): Promise<void> {
      if (requests.has(request.id)) {
        throw new Error("Duplicate service request id.");
      }
      requests.set(request.id, request);
      if (request.idempotencyKey) {
        const key = `${request.agentId}:${request.idempotencyKey}`;
        requestsByIdempotency.set(key, request.id);
      }
    },

    async getById(id: string): Promise<ServiceRequest | null> {
      return requests.get(id) ?? null;
    },

    async getByAgentAndService(agentId: string, serviceId: string): Promise<ServiceRequest[]> {
      return [...requests.values()].filter(
        (r) => r.agentId === agentId && r.serviceId === serviceId,
      );
    },

    async getByIdempotencyKey(agentId: string, idempotencyKey: string): Promise<ServiceRequest | null> {
      const key = `${agentId}:${idempotencyKey}`;
      const requestId = requestsByIdempotency.get(key);
      if (!requestId) return null;
      return requests.get(requestId) ?? null;
    },

    async update(request: ServiceRequest): Promise<void> {
      if (!requests.has(request.id)) {
        throw new Error("Service request not found.");
      }
      requests.set(request.id, request);
      // Idempotency key shouldn't change, but if it does, update the index
      if (request.idempotencyKey) {
        const key = `${request.agentId}:${request.idempotencyKey}`;
        requestsByIdempotency.set(key, request.id);
      }
    },

    async listAll(): Promise<ServiceRequest[]> {
      return [...requests.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async clearAll(): Promise<void> {
      requests.clear();
      requestsByIdempotency.clear();
    },
  };
}

export type ServiceRequestRepository = ReturnType<typeof createInMemoryServiceRequestRepository>;

/**
 * In-memory service result repository.
 */
export function createInMemoryServiceResultRepository() {
  const results = new Map<string, ServiceResult>();

  return {
    async create(result: ServiceResult): Promise<void> {
      if (results.has(result.id)) {
        throw new Error("Duplicate service result id.");
      }
      results.set(result.id, result);
    },

    async getByRequestId(requestId: string): Promise<ServiceResult | null> {
      return [...results.values()].find((r) => r.requestId === requestId) ?? null;
    },

    async getByTrustedPaymentId(trustedPaymentId: string): Promise<ServiceResult | null> {
      return [...results.values()].find((r) => r.trustedPaymentId === trustedPaymentId) ?? null;
    },

    async listAll(): Promise<ServiceResult[]> {
      return [...results.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async clearAll(): Promise<void> {
      results.clear();
    },
  };
}

export type ServiceResultRepository = ReturnType<typeof createInMemoryServiceResultRepository>;