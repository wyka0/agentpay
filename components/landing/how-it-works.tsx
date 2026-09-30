"use client";

const STEPS = [
  {
    number: "01",
    title: "REQUEST",
    description: "Agent requests a service by selecting from the available registry and providing required input parameters.",
  },
  {
    number: "02",
    title: "POLICY",
    description: "Server evaluates the request against the agent's spending policy using trusted accounting from the verified ledger.",
  },
  {
    number: "03",
    title: "INTENT",
    description: "AgentPay creates an immutable payment intent with fixed amount, recipient, chain, and expiry. Values cannot be modified.",
  },
  {
    number: "04",
    title: "SIGN",
    description: "User wallet explicitly authorizes the transaction. No autonomous signing. The user must confirm in their wallet.",
  },
  {
    number: "05",
    title: "SETTLE",
    description: "USDC transfers on Arc mainnet (chain 5042). Native gas token is USDC. Transaction settles in seconds.",
  },
  {
    number: "06",
    title: "VERIFY",
    description: "Server independently verifies the Arc transaction against the intent. Only on success is a trusted payment recorded.",
  },
  {
    number: "07",
    title: "FULFILL",
    description: "Service executes only after trusted payment verification. Fulfillment is gated by server-authoritative payment proof.",
  },
  {
    number: "08",
    title: "RESULT",
    description: "Agent receives the structured service result. The result is bound to the request, payment, and trusted ledger entry.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full px-6 py-20 lg:px-12 lg:py-28 border-t-2 border-foreground">
      {/* Section label */}
      <div className="flex items-center gap-4 mb-12 animate-text-reveal">
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">
          SECTION: LIFECYCLE
        </span>
        <div className="flex-1 border-t border-border" />
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-mono">004</span>
      </div>

      <div className="max-w-5xl mx-auto">
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            className="flex flex-col sm:flex-row gap-6 sm:gap-8 py-8 border-b border-border first:border-t-2 border-foreground animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start gap-4 sm:gap-6 flex-shrink-0 w-full sm:w-28">
              <span className="text-3xl sm:text-4xl font-bold text-accent font-mono tracking-[0.1em] leading-none pt-1">
                {step.number}
              </span>
              <div className="hidden sm:block w-px h-12 bg-gradient-to-b from-border/50 to-transparent" />
            </div>

            <div className="flex-1 pt-2">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground font-mono tracking-[0.05em] uppercase mb-2">
                {step.title}
              </h3>
              <p className="text-base sm:text-lg text-muted-foreground font-mono leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}