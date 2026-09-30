"use client";

import { useState, useEffect } from "react";

const STAGES = [
  { id: "requesting_intent", label: "REQUESTING INTENT", concept: "AGENT" },
  { id: "intent_approved", label: "INTENT APPROVED", concept: "POLICY" },
  { id: "awaiting_signature", label: "AWAITING SIGNATURE", concept: "WALLET" },
  { id: "submitted", label: "TRANSACTION SUBMITTED", concept: "PAYMENT" },
  { id: "verification_pending", label: "VERIFYING ON ARC", concept: "ARC" },
  { id: "confirmed", label: "PAYMENT CONFIRMED", concept: "VERIFIED" },
  { id: "fulfillment_pending", label: "FULFILLMENT PENDING", concept: "SERVICE" },
  { id: "fulfilled", label: "SERVICE FULFILLED", concept: "RESULT" },
];

export function ExecutionTerminal() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const timer = setTimeout(() => {
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(currentStep);
        return next;
      });
      setCurrentStep((prev) => (prev + 1) % STAGES.length);
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentStep, mounted]);

  if (!mounted) {
    return <div className="h-[450px] w-full" />;
  }

  return (
    <section id="execution" className="w-full px-6 py-20 lg:px-12 lg:py-28 border-t-2 border-foreground bg-muted/30">
      {/* Section label */}
      <div className="flex items-center gap-4 mb-12 animate-text-reveal">
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          SECTION: EXECUTION_LIFECYCLE
        </span>
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">007</span>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <p className="text-4xl sm:text-5xl lg:text-6xl tracking-tight text-foreground font-bold leading-[1.1] mb-4">
            PAYMENT
            <br />
            EXECUTION
            <br />
            TERMINAL
          </p>
          <p className="text-lg text-muted-foreground font-mono leading-relaxed max-w-2xl mx-auto">
            Visualization of the AgentPay payment flow. Each stage must complete
            before the next begins. No stage can be skipped.
          </p>
        </div>

        <div className="border-2 border-foreground p-6 lg:p-8 font-mono animate-panel-slide-in" style={{ animationDelay: "200ms" }}>
          {STAGES.map((stage, i) => {
            const isCompleted = completed.has(i);
            const isActive = currentStep === i;
            return (
              <div
                key={stage.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-border/50 last:border-b-0 transition-all duration-300 ${
                  isActive ? "bg-accent/3" : ""
                }`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Step number */}
                <span className={`text-sm font-bold w-8 flex-shrink-0 ${isCompleted ? "text-success" : isActive ? "text-accent" : "text-muted-foreground"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Status indicator */}
                <div
                  className={`w-3 h-3 rounded-none flex-shrink-0 transition-all duration-300 ${
                    isCompleted ? "bg-success border-success" : isActive ? "bg-accent border-accent animate-pulse-ring" : "bg-transparent border-border"
                  }`}
                >
                  {isCompleted && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-success">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {isActive && !isCompleted && (
                    <span className="inline-block w-full h-full animate-pipeline-pulse" />
                  )}
                </div>

                {/* Label */}
                <span className={`text-sm font-bold flex-1 text-left sm:w-48 ${isCompleted ? "text-foreground" : isActive ? "text-accent" : "text-muted-foreground"}`}>
                  {stage.label}
                </span>

                {/* Active concept indicator */}
                {isActive && !isCompleted && (
                  <span className="px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] uppercase text-accent bg-accent/10 border border-accent/20 animate-fade-up">
                    {stage.concept}
                  </span>
                )}

                {/* Status text */}
                <span className={`text-[10px] tracking-[0.15em] uppercase shrink-0 ${isCompleted ? "text-success" : isActive ? "text-accent" : "text-muted-foreground"}`}>
                  {isCompleted ? "DONE" : isActive ? "ACTIVE" : "PENDING"}
                </span>
              </div>
            );
          })}

          {/* Conceptual disclaimer */}
          <p className="mt-6 pt-4 border-t border-border text-[10px] tracking-[0.15em] uppercase text-muted-foreground text-center animate-fade-up" style={{ animationDelay: "800ms" }}>
            CONCEPTUAL VISUALIZATION — NO LIVE TRANSACTION DISPLAYED
          </p>
        </div>
      </div>
    </section>
  );
}