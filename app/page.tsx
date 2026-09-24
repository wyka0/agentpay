"use client";

import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { TrustStatement } from "@/components/landing/trust-statement";
import { AgentOrigins } from "@/components/landing/agent-origins";
import { AgentPayFlow } from "@/components/landing/agent-pay-flow";
import { RealRequestExample } from "@/components/landing/real-request-example";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PolicySection } from "@/components/landing/policy-section";
import { ServicesSection } from "@/components/landing/services-section";
import { ExecutionTerminal } from "@/components/landing/execution-terminal";
import { TrustedLedgerSection } from "@/components/landing/trusted-ledger-section";
import { ArcSection } from "@/components/landing/arc-section";
import { SecuritySection } from "@/components/landing/security-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function LandingPage() {
  return (
    <div className="dot-grid-bg flex min-h-full flex-col font-mono">
      <LandingNav />
      <main className="flex-1">
        <LandingHero />
        <TrustStatement />
        <AgentOrigins />
        <AgentPayFlow />
        <RealRequestExample />
        <HowItWorks />
        <PolicySection />
        <ServicesSection />
        <ExecutionTerminal />
        <TrustedLedgerSection />
        <ArcSection />
        <SecuritySection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}