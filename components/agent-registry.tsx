"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/components/wallet-provider";
import { useAuth } from "@/components/auth-provider";
import { shortenAddress } from "@/lib/wallet/state";

const PRIMARY =
  "border-2 border-foreground bg-foreground px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-background transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "border border-foreground/40 px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "border-2 border-foreground bg-background px-3 py-2 text-[10px] font-mono uppercase text-foreground focus:outline-none focus:border-accent";

interface AgentView {
  id: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  ownerWalletAddress: string;
  createdAt: string;
}

export function AgentRegistry() {
  const { session: walletSession } = useWallet();
  const auth = useAuth();
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!auth.session) return;
    setLoading(true);
    try {
      const response = await fetch("/api/agents/register", {
        method: "GET",
        headers: { "content-type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (data.ok) {
        setAgents(data.agents);
      }
    } catch {
      // Silent fail for demo
    } finally {
      setLoading(false);
    }
  }, [auth.session]);

  const handleCreate = async () => {
    if (!newAgentName.trim()) {
      setCreateError("Agent name is required");
      return;
    }
    setCreateError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newAgentName.trim(),
          description: newAgentDescription.trim(),
        }),
      });
      const data = await response.json();
      if (data.ok) {
        setCreatedApiKey(data.apiKey);
        setShowApiKeyWarning(true);
        setNewAgentName("");
        setNewAgentDescription("");
        setShowCreate(false);
        await fetchAgents();
      } else {
        setCreateError(data.error?.message ?? "Failed to create agent");
      }
    } catch {
      setCreateError("Failed to create agent");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (agent: AgentView) => {
    setLoading(true);
    try {
      // In a real implementation, this would call a PATCH endpoint
      // For demo, we just toggle locally
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, status: a.status === "active" ? "disabled" : "active" } : a,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="border-2 border-foreground bg-background/80 p-6">
      <div className="flex flex-col items-center gap-4 text-center mb-6">
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          Agent Registry
        </span>
        <p className="text-sm text-foreground max-w-md">
          Register external AI agents that can programmatically request services.
          Each agent receives an API key for authentication. Payments still require
          explicit human wallet approval.
        </p>
      </div>

      {!showCreate && !createdApiKey ? (
        <button className={PRIMARY} onClick={() => setShowCreate(true)} type="button">
          Create Agent
        </button>
      ) : null}

      {showCreate && (
        <div className="mx-auto max-w-xl border-2 border-foreground p-6">
          <h3 className="text-sm font-bold uppercase mb-4">Create New Agent</h3>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
                Agent Name *
              </label>
              <input
                className={INPUT}
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="My Research Agent"
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
                Description
              </label>
              <textarea
                className={INPUT}
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                placeholder="Autonomous market research agent"
                rows={3}
                disabled={loading}
              />
            </div>
            {createError && (
              <p className="text-[10px] tracking-[0.15em] text-accent uppercase" role="alert">
                {createError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button className={PRIMARY} disabled={loading || !newAgentName.trim()} onClick={handleCreate} type="button">
                {loading ? "Creating…" : "Create Agent"}
              </button>
              <button className={SECONDARY} onClick={() => setShowCreate(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {createdApiKey && showApiKeyWarning && (
        <div className="mx-auto max-w-xl border-2 border-accent bg-accent/5 p-6">
          <div className="flex flex-col gap-3">
            <div className="border-2 border-foreground p-4">
              <p className="text-sm font-bold uppercase text-accent mb-2">
                ⚠️ SAVE THIS KEY NOW — IT CANNOT BE RECOVERED
              </p>
              <code className="font-mono text-sm break-all text-foreground">{createdApiKey}</code>
            </div>
            <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              Copy the API key above and store it securely. It will never be shown again.
            </p>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button
                className={PRIMARY}
                onClick={() => {
                  navigator.clipboard.writeText(createdApiKey);
                  setShowApiKeyWarning(false);
                  setCreatedApiKey(null);
                }}
                type="button"
              >
                Copied — Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {agents.length > 0 && (
        <div className="mt-8 border-2 border-foreground">
          <div className="border-b-2 border-foreground px-4 py-2">
            <p className="text-sm font-bold uppercase">Registered Agents</p>
          </div>
          <ul className="divide-y divide-border">
            {agents.map((agent) => (
              <li key={agent.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold uppercase">{agent.name}</p>
                    <span
                      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[9px] font-bold tracking-[0.2em] uppercase ${
                        agent.status === "active"
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {agent.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                    {agent.description}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    ID: {agent.id} · Owner: {shortenAddress(agent.ownerWalletAddress)} · Created: {new Date(agent.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={SECONDARY}
                    onClick={() => handleToggleStatus(agent)}
                    disabled={loading}
                    type="button"
                  >
                    {agent.status === "active" ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {agents.length === 0 && !showCreate && !createdApiKey && !loading && (
        <p className="text-center text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-8">
          No agents registered yet. Create your first agent to get started.
        </p>
      )}
    </section>
  );
}