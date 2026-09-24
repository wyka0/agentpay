import { AgentCard } from "@/components/agent-card";
import { AgentRegistry } from "@/components/agent-registry";
import { Hero } from "@/components/hero";
import { PaymentPanel } from "@/components/payment-panel";
import { PaymentsPanel } from "@/components/payments-panel";
import { PendingAgentRequests } from "@/components/pending-agent-requests";
import { PolicyCard } from "@/components/policy-card";
import { SectionLabel } from "@/components/section-label";
import { ServiceRequestPanel } from "@/components/service-request-panel";
import { ServicesPanel } from "@/components/services-panel";
import { SignInAction } from "@/components/sign-in-action";
import { SiteHeader } from "@/components/site-header";
import { TrustedLedgerPanel } from "@/components/trusted-ledger-panel";
import { AgentExecutionProvider } from "@/components/agent-execution-provider";
import { DEMO_AGENT, DEMO_SPENDING_POLICY } from "@/lib/demo/agent";
import { listServices } from "@/lib/services/registry";

export default function Home() {
  const services = listServices();

  return (
    <div className="dot-grid-bg flex flex-1 flex-col">
      <SiteHeader />

      <main className="w-full">
        <Hero />
        <SignInAction />

        <section className="w-full px-6 pb-16 lg:px-12">
          <SectionLabel index="000" label="// SECTION: AGENT_RUNTIME" />

          <div className="mt-8 grid grid-cols-1 border-2 border-foreground lg:grid-cols-2">
            <div className="border-b-2 border-foreground lg:border-r-2 lg:border-b-0">
              <AgentCard agent={DEMO_AGENT} />
            </div>
            <div>
              <PolicyCard policy={DEMO_SPENDING_POLICY} />
            </div>
            <div className="border-t-2 border-foreground lg:border-r-2">
              <ServicesPanel services={services} />
            </div>
            <div className="border-t-2 border-foreground">
              <PaymentPanel />
            </div>
            <div className="border-t-2 border-foreground border-l-0 lg:col-span-2">
              <TrustedLedgerPanel />
            </div>
            <div className="border-t-2 border-foreground border-l-0 lg:col-span-2">
              <PaymentsPanel />
            </div>
          </div>

          <section className="mt-8 border-2 border-foreground">
            <SectionLabel index="001" label="// SECTION: SERVICE_EXECUTION" />
            <AgentExecutionProvider>
              <ServiceRequestPanel />
            </AgentExecutionProvider>
          </section>

          <section className="mt-8 border-2 border-foreground">
            <SectionLabel index="002" label="// SECTION: AGENT_REGISTRY" />
            <AgentRegistry />
          </section>

          <section className="mt-8 border-2 border-foreground">
            <SectionLabel index="003" label="// SECTION: PENDING_AGENT_REQUESTS" />
            <PendingAgentRequests />
          </section>

          <footer className="mt-10 flex flex-col gap-2 border-t-2 border-foreground pt-6 md:flex-row md:items-center md:justify-between">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">AgentPay</span>
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              AgentPay provides the payment rail. Your agent decides which service it needs.
            </span>
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              No custodial keys · no autonomous signing
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
