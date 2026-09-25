"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { shortenAddress } from "@/lib/wallet/state";
import { formatMoney } from "@/lib/money";
import type { ServiceRequest } from "@/types/service-request";
import type { Currency } from "@/types/money";

const PRIMARY =
  "border-2 border-foreground bg-foreground px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "border border-foreground/40 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const STATUS_BADGE =
  "inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[9px] font-bold tracking-[0.2em] uppercase";

interface PendingAgentRequest {
  id: string;
  agentName: string;
  serviceName: string;
  serviceCategory: string;
  amount: number;
  currency: Currency;
  status: ServiceRequest["status"];
  intentId: string | null;
  createdAt: string;
  ownerWalletAddress: string;
}

export function PendingAgentRequests() {
  const auth = useAuth();
  const [pendingRequests, setPendingRequests] = useState<PendingAgentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const mountedRef = useRef(true);

  const fetchPending = useCallback(async () => {
    if (!auth.session) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/v1/pending", {
        method: "GET",
        headers: { "content-type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (data.ok && mountedRef.current) {
        setPendingRequests(data.requests);
      }
    } catch {
      if (mountedRef.current) {
        setError("Failed to load pending requests");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [auth.session]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPending();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchPending]);

  const handleApprove = useCallback(async (request: PendingAgentRequest) => {
    if (!request.intentId) return;
    setError(null);
    try {
      // In demo mode, use the demo completion endpoint
      if (demoMode) {
        const response = await fetch("/api/agent/v1/demo/complete-payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ requestId: request.id }),
        });
        const data = await response.json();
        if (!data.ok) throw new Error(data.error?.message ?? "Failed to complete demo payment");
      } else {
        // In production, redirect to payment approval flow
        // The actual payment is done via the wallet in the service request panel
        window.location.href = `/app?approve=${request.id}`;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve payment");
      return;
    }
    fetchPending();
  }, [demoMode, fetchPending]);

  const handleDemoModeToggle = () => {
    setDemoMode((prev) => !prev);
  };

  return (
    <section className="border-2 border-foreground bg-background/80 p-6">
      <div className="flex flex-col items-center gap-4 text-center mb-6">
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Pending Agent Requests
        </span>
        <p className="text-sm text-foreground max-w-md">
          Review and approve payment requests from your registered external agents.
          Each request requires explicit human wallet approval.
        </p>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={handleDemoModeToggle}
            className="border-2 border-foreground bg-background px-2 py-1 text-[10px] font-mono uppercase"
          />
          <span className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
            Demo Mode (simulate payment without real transaction)
          </span>
        </label>
      </div>

      {error && (
        <div className="mb-4 border-2 border-accent bg-accent/5 p-4">
          <p className="text-[10px] tracking-[0.15em] text-accent uppercase" role="alert">
            {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Loading pending requests…
          </span>
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            No pending agent requests.
          </p>
        </div>
      ) : (
        <div className="border-2 border-foreground">
          <div className="border-b-2 border-foreground px-4 py-2">
            <p className="text-sm font-bold uppercase">Pending Approvals</p>
          </div>
          <ul className="divide-y divide-border">
            {pendingRequests.map((req) => (
              <li key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold uppercase">{req.agentName}</p>
                    <span className={STATUS_BADGE}>
                      {req.serviceCategory.toUpperCase()}
                    </span>
                    <span
                      className={`${STATUS_BADGE} ${
                        req.status === "payment_required"
                          ? "border-accent bg-accent/5 text-accent"
                          : req.status === "payment_pending"
                          ? "border-accent bg-accent/5 text-accent"
                          : req.status === "payment_confirmed"
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {req.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    {req.serviceName}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    ID: {req.id} · Intent: {req.intentId ?? "—"} · Created: {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:ml-4">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-sm text-accent">
                      {formatMoney(req.amount, req.currency)}
                    </span>
                    <span className="text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
                      Owner: {shortenAddress(req.ownerWalletAddress)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {req.status === "payment_required" || req.status === "payment_pending" ? (
                      <button
                        className={PRIMARY}
                        disabled={loading}
                        onClick={() => handleApprove(req)}
                        type="button"
                      >
                        Approve Payment
                      </button>
                    ) : req.status === "payment_confirmed" ? (
                      <button
                        className={PRIMARY}
                        disabled={loading}
                        onClick={() => handleApprove(req)}
                        type="button"
                      >
                        Fulfill Service
                      </button>
                    ) : (
                      <span className={SECONDARY} style={{ cursor: "default" }}>
                        {req.status === "fulfilled" ? "Fulfilled" : "Done"}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}