"use client";

import { Card, CardBody, CardHeader } from "@/components/card";
import { DemoBadge } from "@/components/demo-badge";
import { usePaymentFlow } from "@/components/payment-flow-provider";
import { formatMoney } from "@/lib/money";
import { getRecipientEnvVarName } from "@/lib/payments/recipients";
import type { Service } from "@/types";

export function ServicesPanel({ services }: { services: readonly Service[] }) {
  const { requestPayment, gate, status } = usePaymentFlow();

  const blockedServiceId =
    gate.status === "blocked" && status === "blocked" ? gate.serviceId : undefined;

  return (
    <Card>
      <CardHeader action={<DemoBadge label="LOCAL DEMO" />} label="service.registry" meta="003" />
      <CardBody className="p-0">
        <ul>
          {services.map((service, index) => {
            const isBlocked = blockedServiceId === service.id;
            return (
              <li
                className={`flex flex-col gap-2 px-4 py-3 ${
                  index < services.length - 1 ? "border-b border-border" : ""
                }`}
                key={service.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase">{service.name}</p>
                    <p className="mt-0.5 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                      {service.category}
                      {service.active ? "" : " · INACTIVE"}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-sm"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatMoney(service.price, service.currency)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="border border-foreground bg-foreground px-2.5 py-1.5 text-[9px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => requestPayment(service)}
                    type="button"
                  >
                    Request Payment
                  </button>
                  {isBlocked ? (
                    <span className="text-[9px] tracking-[0.15em] text-accent uppercase">
                      Blocked
                    </span>
                  ) : null}
                </div>

                {isBlocked ? <RecipientHint serviceId={service.id} /> : null}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground uppercase">
          Local demo service definitions. Not real external services. Selecting a service builds a
          payment request only — it does not send a transaction.
        </p>
      </CardBody>
    </Card>
  );
}

function RecipientHint({ serviceId }: { serviceId: string }) {
  return (
    <p className="text-[9px] leading-relaxed tracking-[0.1em] text-muted-foreground uppercase">
      Demo recipient env: {getRecipientEnvVarName(serviceId)}
    </p>
  );
}
