"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { useWallet } from "@/components/wallet-provider";
import { shortenAddress } from "@/lib/wallet/state";
import { formatMoney } from "@/lib/money";
import { sendUsdcTransfer } from "@/lib/wallet/payment";
import { getActiveArcNetwork } from "@/lib/arc/network";
import { getInjectedProvider } from "@/lib/wallet/client";
import { verifyTrustedTransaction } from "@/lib/payments/client";
import type { ServiceRequest } from "@/types/service-request";
import type { Currency } from "@/types/money";
import type { EvmAddress } from "@/types/money";

const PRIMARY =
  "border-2 border-foreground bg-foreground px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "border border-foreground/40 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const STATUS_BADGE =
  "inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[9px] font-bold tracking-[0.2em] uppercase";

const MODAL_OVERLAY =
  "fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 isolation-isolate";
const MODAL_BOX =
  "w-full max-w-[640px] max-h-[calc(100vh-32px)] bg-background border-2 border-foreground p-6 isolation-isolate z-[100] relative animate-scale-fade overflow-y-auto";
const MODAL_TITLE =
  "text-sm font-bold tracking-[0.2em] uppercase text-foreground mb-3";
const MODAL_TEXT =
  "text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-4";
const MODAL_REQUEST =
  "border-2 border-foreground p-4 mb-6 bg-background";
const MODAL_ACTIONS =
  "flex items-center gap-2 justify-end mt-6 pt-4 border-t-2 border-foreground";
const MODAL_BUTTON_PRIMARY =
  "border-2 border-foreground bg-foreground px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const MODAL_BUTTON_SECONDARY =
  "border border-foreground/40 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";

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

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  request: PendingAgentRequest | null;
}

function RejectModal({ isOpen, onClose, onConfirm, isLoading, request }: RejectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const focusableElementsSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const trapFocus = useCallback((event: KeyboardEvent) => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(focusableElementsSelector);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab - move backwards
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab - move forwards
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  // Focus management when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before modal opened
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Make background content inert to prevent focus
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.setAttribute('inert', 'true');
    }

    // Focus the first focusable element in the modal (Cancel button)
    setTimeout(() => {
      const cancelButton = modalRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
      cancelButton?.focus();
    }, 0);

    // Handle escape key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Tab') {
        trapFocus(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Remove inert when modal closes
      if (mainContent) {
        mainContent.removeAttribute('inert');
      }
      // Restore focus to the element that opened the modal
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, trapFocus]);

  if (!isOpen || !request) return null;

  return (
    <div className={MODAL_OVERLAY} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" aria-describedby="reject-modal-desc">
      <div ref={modalRef} className={MODAL_BOX} onClick={(e) => e.stopPropagation()}>
        <h2 id="reject-modal-title" className={MODAL_TITLE}>CONFIRM REJECTION</h2>
        <p id="reject-modal-desc" className={MODAL_TEXT}>
          REJECT THIS PAYMENT REQUEST?
        </p>
        <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-4 leading-relaxed">
          This will permanently reject this payment request. No USDC will be transferred and the requested service will not be fulfilled.
        </p>
        <div className={MODAL_REQUEST}>
          <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-2">REQUEST</p>
          <div className="space-y-1">
            <p className="font-mono text-sm text-accent overflow-wrap-anywhere">{request.serviceName}</p>
            <p className="font-mono text-sm text-accent">{formatMoney(request.amount, request.currency)}</p>
          </div>
        </div>
        <div className={MODAL_ACTIONS}>
          <button
            className={MODAL_BUTTON_SECONDARY}
            disabled={isLoading}
            onClick={onClose}
            type="button"
          >
            CANCEL
          </button>
          <button
            className={MODAL_BUTTON_PRIMARY}
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            REJECT PAYMENT
          </button>
        </div>
      </div>
    </div>
  );
}

export function PendingAgentRequests() {
  const auth = useAuth();
  const wallet = useWallet();
  const [pendingRequests, setPendingRequests] = useState<PendingAgentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PendingAgentRequest | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
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
        // Fetch the payment intent details
        const intentResponse = await fetch(`/api/agent/v1/requests/${request.id}/intent`, {
          method: "GET",
          headers: { "content-type": "application/json" },
          credentials: "include",
        });
        const intentData = await intentResponse.json();
        if (!intentData.ok) throw new Error(intentData.error?.message ?? "Failed to fetch payment intent");

        const intent = intentData.intent;

        // Verify wallet is connected and on correct network
        const { connection, network, session } = wallet;
        const provider = getInjectedProvider();
        if (connection !== "connected" || !provider) {
          throw new Error("Connect a wallet before approving a payment.");
        }
        if (intent.chainId !== network.chainId) {
          throw new Error(`Switch your wallet to ${network.label} (chain ${network.chainId}) before approving.`);
        }

        // Prepare the payment request for the wallet
        const paymentRequest = {
          id: intent.id,
          agentId: request.id, // Using request ID as agent reference
          serviceId: request.id, // Using request ID as service reference
          recipient: intent.recipient,
          amount: { amount: intent.amount.amount, currency: intent.currency },
          currency: intent.currency,
        };

        // Submit through the wallet
        const sent = await sendUsdcTransfer({
          provider: provider!,
          network: getActiveArcNetwork(),
          request: paymentRequest,
          from: session.wallet.address as EvmAddress,
        });

        if (!sent.ok) throw new Error(sent.error.message);

        // Verify the transaction on Arc and record in trusted ledger
        const verifyResult = await verifyTrustedTransaction({
          intentId: intent.id,
          txHash: sent.transactionHash,
        });
        if (!verifyResult.ok) throw new Error(verifyResult.code === "ALREADY_RECORDED" 
          ? "Transaction already recorded" 
          : verifyResult.message);

        // Verify the transaction with the trusted ledger
        const fulfillResponse = await fetch(`/api/services/requests/${request.id}/fulfill`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
        });
        const fulfillData = await fulfillResponse.json();
        if (!fulfillData.ok) throw new Error(fulfillData.error?.message ?? "Failed to verify payment");

        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve payment");
      return;
    }
    fetchPending();
  }, [demoMode, fetchPending, wallet]);

  const handleReject = useCallback((request: PendingAgentRequest) => {
    setRejectTarget(request);
    setRejectModalOpen(true);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectTarget) return;
    setRejectLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/services/requests/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: "Payment request rejected by owner." }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Failed to reject payment request");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject payment request");
    } finally {
      setRejectLoading(false);
      setRejectModalOpen(false);
      setRejectTarget(null);
    }
    fetchPending();
  }, [fetchPending]);

  const handleRejectCancel = useCallback(() => {
    setRejectModalOpen(false);
    setRejectTarget(null);
  }, []);

  const handleDemoModeToggle = () => {
    setDemoMode((prev) => !prev);
  };

  return (
    <>
      <section id="main-content" className="border-2 border-foreground bg-background/80 p-6">
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
                        <>
                          <button
                            className={PRIMARY}
                            disabled={loading}
                            onClick={() => handleApprove(req)}
                            type="button"
                          >
                            Approve Payment
                          </button>
                          <button
                            className={SECONDARY}
                            disabled={loading}
                            onClick={() => handleReject(req)}
                            type="button"
                          >
                            Reject Payment
                          </button>
                        </>
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
    <RejectModal
      isOpen={rejectModalOpen}
      onClose={handleRejectCancel}
      onConfirm={handleRejectConfirm}
      isLoading={rejectLoading}
      request={rejectTarget}
    />
    </>
  );
}