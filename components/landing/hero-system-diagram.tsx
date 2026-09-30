"use client";

import { useState, useEffect, useRef } from "react";

const NODES = [
  { id: "agent", label: "AGENT", subLabel: "DECISION", concept: "AGENT", y: 60 },
  { id: "policy", label: "POLICY", subLabel: "ENGINE", concept: "POLICY", y: 130 },
  { id: "intent", label: "PAYMENT", subLabel: "INTENT", concept: "INTENT", y: 200 },
  { id: "wallet", label: "WALLET", subLabel: "SIGNATURE", concept: "WALLET", y: 270 },
  { id: "arc", label: "ARC", subLabel: "SETTLEMENT", concept: "ARC", y: 340 },
  { id: "verify", label: "VERIFIED", subLabel: "PAYMENT", concept: "VERIFY", y: 410 },
  { id: "fulfill", label: "SERVICE", subLabel: "FULFILLMENT", concept: "SERVICE", y: 480 },
];

const CONNECTIONS = [
  { from: "agent", to: "policy" },
  { from: "policy", to: "intent" },
  { from: "intent", to: "wallet" },
  { from: "wallet", to: "arc" },
  { from: "arc", to: "verify" },
  { from: "verify", to: "fulfill" },
];

const SIDE_LABELS = [
  { id: "agent", text: "AGENT DECISION" },
  { id: "policy", text: "SERVER POLICY" },
  { id: "intent", text: "IMMUTABLE INTENT" },
  { id: "wallet", text: "EXPLICIT AUTH" },
  { id: "arc", text: "ARC SETTLEMENT" },
  { id: "verify", text: "PAYMENT VERIFY" },
  { id: "fulfill", text: "GATED RESULT" },
];

const VB_WIDTH = 600;
const VB_HEIGHT = 540;
const CENTER_X = VB_WIDTH / 2;
const NODE_WIDTH = 104;
const NODE_X = CENTER_X - NODE_WIDTH / 2;
const NODE_HEIGHT = 52;
const NODE_SPACING = 70;

const ACTIVE_DURATION = 1200;
const PACKET_DURATION = 600;

export function HeroSystemDiagram() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [packetProgress, setPacketProgress] = useState(0);
  const [packetFrom, setPacketFrom] = useState(0);
  const [packetTo, setPacketTo] = useState(1);
  const [showPacket, setShowPacket] = useState(false);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Animation cycle using CSS-like timing
  useEffect(() => {
    if (reducedMotion) {
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    let currentIndex = 0;

    const runCycle = () => {
      if (cancelled) return;

      // Activate current node
      setActiveIndex(currentIndex);

      const isLastNode = currentIndex === NODES.length - 1;

      // Hold active state
      const holdTimeout = setTimeout(() => {
        if (cancelled) return;

        if (!isLastNode) {
          // Start packet animation to next node
          setPacketFrom(currentIndex);
          setPacketTo(currentIndex + 1);
          setPacketProgress(0);
          setShowPacket(true);

          // Animate packet
          const startTime = Date.now();
          const animatePacket = () => {
            if (cancelled) return;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / PACKET_DURATION, 1);
            setPacketProgress(progress);
            if (progress < 1) {
              requestAnimationFrame(animatePacket);
            } else {
              // Packet arrived
              setShowPacket(false);
              currentIndex = (currentIndex + 1) % NODES.length;
              runCycle();
            }
          };
          animatePacket();
        } else {
          // Last node - loop back
          currentIndex = 0;
          runCycle();
        }
      }, ACTIVE_DURATION);

      cycleRef.current = holdTimeout;
    };

    runCycle();

    return () => {
      cancelled = true;
      if (cycleRef.current) clearTimeout(cycleRef.current);
    };
  }, [reducedMotion]);

  if (!mounted) {
    return (
      <div
        className="relative w-full max-w-[760px] mx-auto"
        style={{ aspectRatio: `${VB_WIDTH} / ${VB_HEIGHT}` }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="relative w-full max-w-[760px] mx-auto">
      <svg
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        className="block w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={reducedMotion
          ? "AgentPay payment flow diagram (static): Agent Decision to Policy Engine to Payment Intent to Wallet Signature to Arc Settlement to Verified Payment to Service Fulfillment"
          : "AgentPay payment flow diagram (animated): Agent Decision to Policy Engine to Payment Intent to Wallet Signature to Arc Settlement to Verified Payment to Service Fulfillment"}
      >
        {/* Vertical center connector line */}
        <line
          x1={CENTER_X}
          y1={34}
          y2={506}
          x2={CENTER_X}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />

        {/* Connection lines with packet animation */}
        {CONNECTIONS.map((conn, i) => {
          const fromNode = NODES.find((n) => n.id === conn.from);
          const toNode = NODES.find((n) => n.id === conn.to);
          if (!fromNode || !toNode) return null;

          const isActiveConnection = packetFrom === i && packetTo === i + 1 && showPacket;
          const progress = isActiveConnection ? packetProgress : 0;
          const fromY = fromNode.y;
          const toY = toNode.y;
          const segmentLength = toY - fromY;
          const packetY = fromY + segmentLength * progress;

          return (
            <g key={`conn-${conn.from}-${conn.to}`}>
              {/* Base connector (always gray) */}
              <line
                x1={CENTER_X}
                y1={fromY + NODE_HEIGHT / 2}
                x2={CENTER_X}
                y2={toY - NODE_HEIGHT / 2}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />

              {/* Orange active segment */}
              {isActiveConnection && progress > 0 && (
                <line
                  x1={CENTER_X}
                  y1={fromY + NODE_HEIGHT / 2}
                  x2={CENTER_X}
                  y2={packetY}
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  className="animate-line-draw"
                />
              )}

              {/* Moving packet */}
              {isActiveConnection && progress > 0 && progress < 1 && (
                <circle
                  cx={CENTER_X}
                  cy={packetY}
                  r={4}
                  fill="hsl(var(--accent))"
                  className="animate-pipeline-pulse"
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {NODES.map((node, i) => {
          const isActive = i === activeIndex;
          const isCompleted = i < activeIndex && !reducedMotion;
          const y = 60 + i * NODE_SPACING;

          return (
            <g
              key={node.id}
              transform={`translate(0, ${y - 60})`}
              style={{
                opacity: isActive || isCompleted ? 1 : 0,
                transform: `translateY(${isActive || isCompleted ? 0 : 20}px)`,
                transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
              }}
            >
              {/* Pulse ring (only when active) */}
              {isActive && !reducedMotion && (
                <circle
                  cx={CENTER_X}
                  cy={30}
                  r={20}
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth={1.5}
                  className="animate-pulse-ring"
                />
              )}

              {/* Node background */}
              <rect
                x={NODE_X}
                y={4}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={0}
                fill="hsl(var(--card))"
                stroke={isActive ? "hsl(var(--accent))" : isCompleted ? "hsl(var(--success))" : "hsl(var(--border))"}
                strokeWidth={isActive ? 2 : 1}
              />

              {/* Main label */}
              <text
                x={CENTER_X}
                y={20}
                textAnchor="middle"
                fill={isActive ? "hsl(var(--accent))" : isCompleted ? "hsl(var(--success))" : "hsl(var(--foreground))"}
                fontSize={10}
                fontFamily="var(--font-mono), monospace"
                fontWeight={600}
                letterSpacing="0.1em"
                className="select-none"
              >
                {node.label}
              </text>

              {/* Sub label */}
              <text
                x={CENTER_X}
                y={40}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize={7}
                fontFamily="var(--font-mono), monospace"
                fontWeight={500}
                letterSpacing="0.08em"
                className="select-none"
              >
                {node.subLabel}
              </text>

              {/* Active indicator dot */}
              <circle
                cx={NODE_X + NODE_WIDTH - 10}
                cy={30}
                r={4}
                fill={isActive ? "hsl(var(--accent))" : isCompleted ? "hsl(var(--success))" : "hsl(var(--border))"}
              />

              {/* Active concept badge */}
              {isActive && !reducedMotion && (
                <g>
                  <rect
                    x={CENTER_X - 35}
                    y={-18}
                    width={70}
                    height={14}
                    rx={0}
                    fill="hsl(var(--accent) / 0.1)"
                    stroke="hsl(var(--accent) / 0.3)"
                    strokeWidth={1}
                  />
                  <text
                    x={CENTER_X}
                    y={-8}
                    textAnchor="middle"
                    fill="hsl(var(--accent))"
                    fontSize={6}
                    fontFamily="var(--font-mono), monospace"
                    fontWeight={600}
                    letterSpacing="0.1em"
                    className="select-none"
                  >
                    {node.concept}
                  </text>
                </g>
              )}

              {/* Completed checkmark */}
              {isCompleted && (
                <g transform={`translate(${NODE_X + NODE_WIDTH - 10}, 30)`}>
                  <circle r={6} fill="hsl(var(--success))" />
                  <path d="M-3 0 L-1 2 L3 -2" stroke="white" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}
            </g>
          );
        })}

        {/* Side annotations */}
        <g>
          {/* Left side labels */}
          {SIDE_LABELS.map((l, i) => {
            const isActive = activeIndex === i;
            return (
              <text
                key={`lbl-${l.text}`}
                x={20}
                y={60 + i * NODE_SPACING + 4}
                textAnchor="start"
                fill={isActive ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))"}
                fontSize={6}
                fontFamily="var(--font-mono), monospace"
                fontWeight={500}
                letterSpacing="0.1em"
                className="select-none"
                style={{ transition: "fill 0.2s ease" }}
              >
                {l.text}
              </text>
            );
          })}

          {/* Right side status markers */}
          {NODES.map((node, i) => {
            const isActive = activeIndex === i;
            const isCompleted = i < activeIndex && !reducedMotion;
            const y = 60 + i * NODE_SPACING;
            return (
              <g key={`status-${node.id}`}>
                <circle
                  cx={VB_WIDTH - 60}
                  cy={y + 4}
                  r={3}
                  fill={isActive ? "hsl(var(--accent))" : isCompleted ? "hsl(var(--success))" : "hsl(var(--border))"}
                />
                <text
                  x={VB_WIDTH - 50}
                  y={y + 11}
                  textAnchor="start"
                  fill={isActive ? "hsl(var(--accent))" : isCompleted ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"}
                  fontSize={6}
                  fontFamily="var(--font-mono), monospace"
                  fontWeight={500}
                  letterSpacing="0.08em"
                  className="select-none"
                  style={{ transition: "fill 0.2s ease" }}
                >
                  {isCompleted ? "DONE" : isActive ? "ACTIVE" : "PENDING"}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}