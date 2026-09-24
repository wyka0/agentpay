/**
 * Research Agent Example
 *
 * A demonstration of how an external AI agent integrates with AgentPay.
 *
 * This example:
 * 1. Authenticates using AGENTPAY_API_KEY
 * 2. Requests market data for BTC
 * 3. Receives payment_required with payment intent
 * 4. Prints the payment intent for human approval
 * 5. Polls for payment confirmation
 * 6. Retrieves and prints the service result
 *
 * Prerequisites:
 * - AgentPay server running at AGENTPAY_BASE_URL
 * - AGENTPAY_API_KEY set (from agent registration)
 *
 * Usage:
 * AGENTPAY_BASE_URL=https://agentpay-self.vercel.app \
 * AGENTPAY_API_KEY=ap_xxxxxxxxxxxx \
 * npx tsx examples/research-agent/index.ts
 */

import { AgentPayClient, AgentPayConfig } from "@/lib/agent/sdk";

const config: AgentPayConfig = {
  baseUrl: process.env.AGENTPAY_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.AGENTPAY_API_KEY ?? "",
};

async function main() {
  if (!config.apiKey) {
    console.error("❌ AGENTPAY_API_KEY environment variable is required");
    console.error("   Get your API key by registering an agent in the AgentPay web UI");
    process.exit(1);
  }

  console.log("🤖 Research Agent starting...");
  console.log(`   Base URL: ${config.baseUrl}`);
  console.log(`   API Key:  ${config.apiKey.slice(0, 8)}...`);

  const agent = new AgentPayClient(config);

  // Step 1: Create a service request for market data
  console.log("\n📊 Requesting Market Data for BTC...");
  const requestResult = await agent.createRequest({
    serviceId: "market-data",
    input: {
      symbol: "BTC",
      timeframe: "24h",
    },
    idempotencyKey: `research-btc-${Date.now()}`,
  });

  if (!requestResult.ok) {
    console.error("❌ Failed to create request:", requestResult.error);
    process.exit(1);
  }

  console.log("✅ Service request created:");
  console.log(`   Request ID: ${requestResult.requestId}`);
  console.log(`   Status:     ${requestResult.status}`);
  console.log("\n💳 Payment Required:");
  console.log(`   Intent ID:  ${requestResult.payment.intentId}`);
  console.log(`   Amount:     ${requestResult.payment.amount.amount} ${requestResult.payment.amount.currency}`);
  console.log(`   Recipient:  ${requestResult.payment.recipient}`);
  console.log(`   Chain ID:   ${requestResult.payment.chainId}`);
  console.log(`   Expires:    ${requestResult.payment.expiresAt}`);

  console.log("\n⏳ Waiting for human wallet approval...");
  console.log("   Please go to the AgentPay web UI and approve the payment.");

  // Step 2: Poll for payment confirmation and result
  const result = await agent.waitForResult(requestResult.requestId, {
    intervalMs: 10000,
    timeoutMs: 600000, // 10 minutes
  });

  if (!result.ok) {
    console.error("❌ Failed to get result:", result.error);
    process.exit(1);
  }

  if (!result.result) {
    console.error("❌ No result returned");
    process.exit(1);
  }

  console.log("\n✅ Payment confirmed and service fulfilled!");
  console.log(`   Result ID: ${result.result.id}`);
  console.log(`   Status:    ${result.result.status}`);
  console.log(`   Fulfilled: ${result.result.fulfilledAt}`);
  console.log(`   Trusted Payment: ${result.result.trustedPaymentId}`);

  if (result.result.output) {
    console.log("\n📋 Service Output:");
    console.log(JSON.stringify(result.result.output, null, 2));
  }

  if (result.result.error) {
    console.error("\n❌ Service Error:", result.result.error);
  }

  console.log("\n🎉 Research Agent completed successfully!");
}

main().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});