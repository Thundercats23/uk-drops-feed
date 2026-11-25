import { UkDropsFeedClient } from "uk-drops-feed";
import { createOpenAIAgentsTools } from "uk-drops-feed/openai-agents";
// Requires: npm install @openai/agents

const client = new UkDropsFeedClient({
  trialKey: process.env.UKDF_TRIAL_KEY,
  autoTrial: !process.env.UKDF_TRIAL_KEY,
  trialRef: "openai-agents-js",
});

const tools = await createOpenAIAgentsTools(client);
console.log("Loaded OpenAI Agents tools:", tools.length);
// Pass `tools` to `new Agent({ name: "Drops Assistant", instructions: "...", tools })`.
