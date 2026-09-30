"use client";

import { HeroSystemDiagram } from "./hero-system-diagram";

export function LandingHero() {
  return (
    <section className="relative w-full px-6 pt-10 pb-12 lg:px-12 lg:pt-16 lg:pb-20">
      <div className="flex flex-col items-center text-center max-w-[1400px] mx-auto">
        {/* Eyebrow */}
        <div className="mb-4 animate-text-reveal">
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
            AGENT PAYMENT INFRASTRUCTURE
          </span>
        </div>

        {/* Primary headline - DOMINANT, single line on desktop */}
        <h1 className="text-6xl sm:text-8xl lg:text-9xl xl:text-[clamp(4.5rem,8vw,9rem)] tracking-tight mb-3 select-none font-bold leading-[1.0] whitespace-nowrap max-w-full animate-text-reveal" style={{ animationDelay: "100ms" }}>
          <span className="text-accent">AI</span>{" "}
          <span className="text-foreground">AGENTS</span>
        </h1>

        {/* Secondary headline - NOTICEABLY SMALLER */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl tracking-tight mb-4 select-none font-medium leading-[1.1] text-muted-foreground animate-text-reveal" style={{ animationDelay: "200ms" }}>
          NEED PAYMENT RAILS.
        </h2>

        {/* Supporting copy */}
        <p className="text-sm lg:text-base text-muted-foreground max-w-2xl mb-10 leading-relaxed font-mono animate-fade-up" style={{ animationDelay: "400ms" }}>
          AgentPay gives AI agents controlled USDC spending on Arc with server-enforced policy, verified settlement, and service fulfillment.
        </p>

        {/* Technical metadata badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10 animate-fade-up" style={{ animationDelay: "500ms" }}>
          <span className="border border-accent px-3 py-1 text-[10px] font-mono tracking-[0.15em] uppercase text-accent">
            ARC MAINNET
          </span>
          <span className="border border-accent px-3 py-1 text-[10px] font-mono tracking-[0.15em] uppercase text-accent">
            USDC
          </span>
          <span className="border border-accent px-3 py-1 text-[10px] font-mono tracking-[0.15em] uppercase text-accent">
            POLICY CONTROL
          </span>
          <span className="border border-accent px-3 py-1 text-[10px] font-mono tracking-[0.15em] uppercase text-accent">
            VERIFIED SETTLEMENT
          </span>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: "600ms" }}>
          <a
            href="/app"
            className="group flex items-center gap-0 bg-foreground text-background text-base font-mono tracking-[0.15em] uppercase hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
          >
            <span className="flex items-center justify-center w-12 h-12 bg-accent">
              <span className="inline-flex transition-transform duration-200 group-hover:translate-x-1">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-accent-foreground">
                  <line x1={5} y1={12} x2={19} y2={12} />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </span>
            <span className="px-6 py-3">
              OPEN AGENTPAY
            </span>
          </a>
          <a
            href="#how-it-works"
            className="border border-foreground/20 bg-transparent text-foreground text-base font-mono tracking-[0.15em] uppercase px-6 py-3 hover:bg-foreground hover:text-background transition-colors duration-200"
          >
            SEE HOW IT WORKS
          </a>
        </div>

        {/* System Diagram - centered BELOW the hero content, contained in normal flow */}
        <div className="w-full max-w-[760px] mx-auto animate-panel-slide-in" style={{ animationDelay: "700ms" }}>
          <HeroSystemDiagram />
        </div>
      </div>
    </section>
  );
}