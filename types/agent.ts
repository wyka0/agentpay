import type { TokenAmount } from "./money";

export type AgentStatus = "active" | "paused";

export interface Agent {
  id: string;
  name: string;
  description: string;
  walletAddress: string | null;
  balance: TokenAmount | null;
  status: AgentStatus;
}
