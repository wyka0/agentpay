"use client";

import { useState, useCallback, useMemo } from "react";
import type { ChangeEvent } from "react";

import { Card, CardBody, CardHeader } from "@/components/card";
import { DemoBadge } from "@/components/demo-badge";
import { useAgentExecution } from "@/components/agent-execution-provider";
import { formatMoney } from "@/lib/money";
import { listActiveServices, getService } from "@/lib/services/registry";
import type { Service } from "@/types";
import type { ServiceRequest, ServiceResult } from "@/types/service-request";
import type { AgentExecutionState } from "@/lib/agent/execution";

const PRIMARY_BTN =
  "border-2 border-foreground bg-foreground px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
  "border border-foreground/40 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground";

interface ServiceInputField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

const SERVICE_INPUTS: Record<string, ServiceInputField[]> = {
  "market-data": [
    { name: "symbol", label: "Symbol", type: "text", required: true },
    { name: "timeframe", label: "Timeframe", type: "select", required: false, options: ["1m", "5m", "15m", "1h", "4h", "1d"] },
  ],
  "research-report": [
    { name: "topic", label: "Topic", type: "text", required: true },
    { name: "depth", label: "Depth", type: "select", required: false, options: ["summary", "detailed"] },
  ],
  "ai-summary": [
    { name: "text", label: "Text", type: "textarea", required: true },
    { name: "maxLength", label: "Max Length", type: "text", required: false },
  ],
};

export function ServiceRequestPanel() {
  const { state, execute, canExecute, cancel, reset } = useAgentExecution();
  const services = listActiveServices();

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCreated, setRequestCreated] = useState(false);
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [serviceResult, setServiceResult] = useState<ServiceResult | null>(null);
  const [resultStatus, setResultStatus] = useState<"idle" | "fetching" | "ready" | "not_ready" | "error">("idle");

  const selectedService = selectedServiceId ? getService(selectedServiceId) ?? null : null;
  const inputFields = useMemo(
    () => (selectedServiceId ? SERVICE_INPUTS[selectedServiceId] ?? [] : []),
    [selectedServiceId],
  );

  const handleInputChange = useCallback((name: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleServiceSelect = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    setInputValues({});
    setError(null);
    setRequestCreated(false);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedServiceId(null);
    setError(null);
  }, []);

  const handleRequest = useCallback(async () => {
    if (!selectedService) return;

    const missingRequired = inputFields
      .filter((f) => f.required)
      .filter((f) => !inputValues[f.name]?.trim());

    if (missingRequired.length > 0) {
      setError(`Missing required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/services/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: "agent_research_01",
          serviceId: selectedServiceId,
          input: inputValues,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error?.message ?? "Failed to create service request");
        return;
      }

      setServiceRequest(data.request as ServiceRequest);
      setRequestCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedService, inputFields, inputValues, selectedServiceId]);

  const handleExecute = useCallback(async () => {
    if (!serviceRequest) return;
    await execute(serviceRequest.serviceId);
  }, [execute, serviceRequest]);

  const handleFulfill = useCallback(async () => {
    if (!serviceRequest) return;

    setResultStatus("fetching");
    setError(null);

    try {
      const response = await fetch(`/api/services/requests/${serviceRequest.id}/fulfill`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error?.message ?? "Failed to fulfill request");
        setResultStatus("error");
        return;
      }

      // Fetch the result from the new result endpoint
      const resultResponse = await fetch(`/api/services/requests/${serviceRequest.id}/result`);
      const resultData = await resultResponse.json();

      if (resultData.ok) {
        if (resultData.status === "READY" && resultData.result) {
          setServiceResult(resultData.result as ServiceResult);
          setResultStatus("ready");
        } else {
          setResultStatus("not_ready");
        }
      } else {
        setResultStatus("error");
      }

      // Also refresh the request state
      const refreshed = await fetch(`/api/services/requests/${serviceRequest.id}`);
      const refreshedData = await refreshed.json();
      if (refreshedData.ok) {
        setServiceRequest(refreshedData.request as ServiceRequest);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fulfill request");
      setResultStatus("error");
    }
  }, [serviceRequest]);

  // Phase 1: Service selection
  if (!requestCreated) {
    return (
      <Card>
        <CardHeader action={<DemoBadge label="LOCAL DEMO" />} label="service.request" meta="007" />
        <CardBody className="p-0">
          {selectedService ? (
            <ServiceInputForm
              service={selectedService}
              inputFields={inputFields}
              inputValues={inputValues}
              error={error}
              isSubmitting={isSubmitting}
              onInputChange={handleInputChange}
              onRequest={handleRequest}
              onBack={handleBack}
            />
          ) : (
            <ServiceList services={services} onSelect={handleServiceSelect} />
          )}
        </CardBody>
      </Card>
    );
  }

  // Phase 2: Request created, awaiting execution
  if (
    requestCreated &&
    serviceRequest &&
    (state.phase === "idle" || state.phase === "intent_rejected" || state.phase === "failed")
  ) {
    return (
      <RequestCreatedCard
        serviceRequest={serviceRequest}
        state={state}
        error={error}
        canExecute={canExecute}
        isSubmitting={isSubmitting}
        onExecute={handleExecute}
        onCancel={cancel}
        onReset={reset}
      />
    );
  }

  // Phase 3: Execution in progress or completed
  return (
    <ExecutionCard
      serviceRequest={serviceRequest}
      serviceResult={serviceResult}
      resultStatus={resultStatus}
      state={state}
      isSubmitting={isSubmitting}
      onExecute={handleExecute}
      onFulfill={handleFulfill}
      onCancel={cancel}
      onReset={reset}
    />
  );
}

// ============== SUB-COMPONENTS ==============

function ServiceList({ services, onSelect }: { services: readonly Service[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm font-bold uppercase">SELECT A SERVICE</p>
      <ul className="flex flex-col gap-2">
        {services.map((service, index) => (
          <li
            key={service.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${
              index < services.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase">{service.name}</p>
              <p className="mt-0.5 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                {service.category}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(service.price, service.currency)}
            </span>
            <button
              className="border border-foreground bg-foreground px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => onSelect(service.id)}
              type="button"
            >
              Select
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceInputForm({
  service,
  inputFields,
  inputValues,
  error,
  isSubmitting,
  onInputChange,
  onRequest,
  onBack,
}: {
  service: Service;
  inputFields: ServiceInputField[];
  inputValues: Record<string, string>;
  error: string | null;
  isSubmitting: boolean;
  onInputChange: (name: string, value: string) => void;
  onRequest: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 border-2 border-foreground p-4">
        <p className="text-sm font-bold uppercase">{service.name}</p>
        <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
          {service.category} · {formatMoney(service.price, service.currency)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {inputFields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1">
            <label className="text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
              {field.label} {field.required && <span className="text-accent">*</span>}
            </label>
            <InputField
              field={field}
              value={inputValues[field.name] ?? ""}
              onChange={(v) => onInputChange(field.name, v)}
            />
          </div>
        ))}

        {error && (
          <p className="text-[10px] tracking-[0.15em] text-accent uppercase" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button className={PRIMARY_BTN} disabled={isSubmitting} onClick={onRequest} type="button">
            {isSubmitting ? "Creating..." : "Create Request"}
          </button>
          <button className={SECONDARY_BTN} onClick={onBack} type="button">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({
  field,
  value,
  onChange,
}: {
  field: ServiceInputField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className="border-2 border-foreground bg-background px-3 py-2 text-[10px] font-mono uppercase text-foreground"
      >
        <option value="">Select...</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        className="border-2 border-foreground bg-background px-3 py-2 text-[10px] font-mono uppercase text-foreground resize-y min-h-[80px]"
        rows={4}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="border-2 border-foreground bg-background px-3 py-2 text-[10px] font-mono uppercase text-foreground"
    />
  );
}

function RequestCreatedCard({
  serviceRequest,
  state,
  error,
  canExecute,
  isSubmitting,
  onExecute,
  onCancel,
  onReset,
}: {
  serviceRequest: ServiceRequest;
  state: AgentExecutionState;
  error: string | null;
  canExecute: boolean;
  isSubmitting: boolean;
  onExecute: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const isFailed = state.phase === "failed";
  const recipient = serviceRequest.paymentIntentId ?? serviceRequest.id;

  return (
    <Card>
      <CardHeader
        action={<DemoBadge label="LOCAL DEMO" />}
        label="service.request"
        meta="007"
      />
      <CardBody className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <div className="border-2 border-foreground p-4">
            <p className="text-sm font-bold uppercase">SERVICE REQUEST CREATED</p>
            <p className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              {isFailed ? "Execution failed." : "Payment intent created. Awaiting wallet execution."}
            </p>
          </div>

          <dl className="grid gap-0 border-2 border-foreground sm:grid-cols-2">
            <Row label="Service" value={serviceRequest.serviceName} />
            <Row label="Status" value={serviceRequest.status} tone={isFailed ? "bad" : "ok"} />
            <Row label="Request ID" value={serviceRequest.id} mono title={serviceRequest.id} />
            <Row label="Intent ID" value={recipient} mono title={recipient} />
            <Row label="Created" value={new Date(serviceRequest.createdAt).toLocaleString()} />
            <Row
              label="Tx Hash"
              value={serviceRequest.txHash ?? "—"}
              mono
              title={serviceRequest.txHash ?? undefined}
            />
          </dl>

          {error && (
            <p className="text-[10px] tracking-[0.15em] text-accent uppercase" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {canExecute ? (
              <>
                <button className={PRIMARY_BTN} disabled={isSubmitting} onClick={onExecute} type="button">
                  Execute Payment
                </button>
                <button className={SECONDARY_BTN} onClick={onCancel} type="button">
                  Cancel
                </button>
              </>
            ) : (
              <button className={SECONDARY_BTN} onClick={onReset} type="button">
                Start Over
              </button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ExecutionCard({
  serviceRequest,
  serviceResult,
  resultStatus,
  state,
  isSubmitting,
  onExecute,
  onFulfill,
  onCancel,
  onReset,
}: {
  serviceRequest: ServiceRequest | null;
  serviceResult: ServiceResult | null;
  resultStatus: "idle" | "fetching" | "ready" | "not_ready" | "error";
  state: AgentExecutionState;
  isSubmitting: boolean;
  onExecute: () => void;
  onFulfill: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const executionPhase = state.phase;
  const isExecuting = ["requesting_intent", "awaiting_signature", "submitted", "verification_pending"].includes(executionPhase);
  const isCompleted = ["confirmed", "failed"].includes(executionPhase);
  const isFulfilled = serviceRequest?.status === "fulfilled";

  const subline = getExecutionSubline(executionPhase, isFulfilled);

  return (
    <Card>
      <CardHeader
        action={<DemoBadge label="LOCAL DEMO" />}
        label="agent.execution"
        meta="008"
      />
      <CardBody className="p-0">
        <div className="flex flex-col gap-4 p-4">
          <div className="border-2 border-foreground p-4">
            <p className="text-sm font-bold uppercase">{executionPhase.replace(/_/g, " ").toUpperCase()}</p>
            <p className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">{subline}</p>
          </div>

          <dl className="grid gap-0 border-2 border-foreground sm:grid-cols-2">
            <Row label="Service" value={serviceRequest?.serviceName ?? "—"} />
            <Row label="Status" value={serviceRequest?.status ?? executionPhase} tone={isFulfilled ? "ok" : executionPhase === "failed" ? "bad" : undefined} />
            <Row label="Request ID" value={serviceRequest?.id ?? "—"} mono />
            <Row
              label="Tx Hash"
              value={state.transactionHash ? `${state.transactionHash.slice(0, 16)}…` : "—"}
              mono
            />
            <Row label="Trusted Payment" value={serviceRequest?.trustedPaymentId ?? "—"} mono />
            <Row label="Fulfilled At" value={serviceRequest?.fulfilledAt ? new Date(serviceRequest.fulfilledAt).toLocaleString() : "—"} />
          </dl>

          {resultStatus === "fetching" && (
            <div className="border-2 border-foreground p-4">
              <p className="text-sm font-bold uppercase">FETCHING RESULT</p>
              <p className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                Retrieving service result…
              </p>
            </div>
          )}

          {resultStatus === "not_ready" && (
            <div className="border-2 border-foreground p-4">
              <p className="text-sm font-bold uppercase">RESULT NOT READY</p>
              <p className="mt-1 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                Fulfillment completed but result is not yet available.
              </p>
            </div>
          )}

          {resultStatus === "error" && (
            <div className="border-2 border-accent p-4">
              <p className="text-sm font-bold uppercase">RESULT FETCH FAILED</p>
              <p className="mt-1 text-[10px] tracking-[0.15em] text-accent uppercase">
                Could not retrieve service result.
              </p>
            </div>
          )}

          {serviceResult && resultStatus === "ready" && (
            <ServiceResultDisplay result={serviceResult} />
          )}

          {state.failureReason && (
            <div className="border-2 border-accent p-3">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Reason</p>
              <p className="mt-1.5 text-xs leading-relaxed">{state.failureReason}</p>
            </div>
          )}

          {state.error && (
            <p className="text-[10px] tracking-[0.15em] text-accent uppercase" role="alert">
              {state.error}
            </p>
          )}

          <ExecutionActions
            executionPhase={executionPhase}
            isExecuting={isExecuting}
            isCompleted={isCompleted}
            isFulfilled={isFulfilled}
            isSubmitting={isSubmitting}
            onExecute={onExecute}
            onFulfill={onFulfill}
            onCancel={onCancel}
            onReset={onReset}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function ExecutionActions({
  executionPhase,
  isExecuting,
  isCompleted,
  isFulfilled,
  isSubmitting,
  onExecute,
  onFulfill,
  onCancel,
  onReset,
}: {
  executionPhase: string;
  isExecuting: boolean;
  isCompleted: boolean;
  isFulfilled: boolean;
  isSubmitting: boolean;
  onExecute: () => void;
  onFulfill: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  if (executionPhase === "intent_approved" && !isExecuting && !isCompleted) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button className={PRIMARY_BTN} disabled={isSubmitting} onClick={onExecute} type="button">
          {isSubmitting ? "Executing…" : "Confirm & Execute"}
        </button>
        <button className={SECONDARY_BTN} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    );
  }

  if (executionPhase === "confirmed" && !isFulfilled) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button className={PRIMARY_BTN} disabled={isSubmitting} onClick={onFulfill} type="button">
          Fulfill Service
        </button>
        <button className={SECONDARY_BTN} onClick={onReset} type="button">
          Done
        </button>
      </div>
    );
  }

  if (executionPhase === "confirmed" && isFulfilled) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button className={SECONDARY_BTN} onClick={onReset} type="button">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      <button className={SECONDARY_BTN} onClick={onReset} type="button">
        Reset
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  tone,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "bad";
  title?: string;
}) {
  return (
    <div className="border-b border-border p-3 last:border-b-0 sm:odd:border-r-2 sm:odd:border-r-foreground">
      <dt className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</dt>
      <dd
        className={`mt-1 text-xs ${mono ? "font-mono" : ""} ${
          tone === "ok" ? "text-accent" : tone === "bad" ? "text-accent" : ""
        }`}
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function ServiceResultDisplay({ result }: { result: ServiceResult }) {
  const isMarketData = result.serviceId === "market-data";
  const output = result.output as Record<string, unknown> | null;
  const provider = isMarketData && output?.provider ? String(output.provider) : "unknown";
  const source = isMarketData && output?.source ? String(output.source) : "unknown";
  const freshness = isMarketData && output?.freshness ? String(output.freshness) : undefined;
  const timestamp = output?.timestamp ? String(output.timestamp) : result.fulfilledAt;

  return (
    <div className="border-2 border-foreground p-4">
      <p className="text-sm font-bold uppercase">SERVICE RESULT</p>

      <dl className="mt-4 grid gap-0 border-2 border-foreground sm:grid-cols-2">
        <Row label="Status" value={result.status.toUpperCase()} tone={result.status === "fulfilled" ? "ok" : "bad"} />
        <Row label="Provider" value={provider.toUpperCase()} />
        <Row label="Data Source" value={source.toUpperCase()} />
        {freshness && <Row label="Freshness" value={freshness.toUpperCase()} />}
        <Row label="Fetched At" value={new Date(timestamp).toLocaleString()} />
        <Row label="Trusted Payment" value={result.trustedPaymentId} mono />
        <Row label="Result ID" value={result.id} mono />
      </dl>

      {output && (
        <div className="mt-4 border-2 border-border p-4">
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">Data</p>
          <pre className="text-xs font-mono whitespace-pre-wrap break-words">
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function getExecutionSubline(phase: string, fulfilled: boolean): string {
  if (fulfilled) return "Service fulfilled. Result returned.";
  switch (phase) {
    case "requesting_intent":
      return "Requesting payment intent from server…";
    case "intent_approved":
      return "Policy approved. Awaiting wallet confirmation.";
    case "awaiting_signature":
      return "Waiting for wallet confirmation…";
    case "submitted":
      return "Transaction submitted. Waiting for Arc confirmation…";
    case "verification_pending":
      return "Verifying transaction on Arc…";
    case "confirmed":
      return "Payment verified. Service can now be fulfilled.";
    case "failed":
      return "Execution failed.";
    default:
      return "Awaiting action.";
  }
}
