import { UkDropsFeedClient } from "uk-drops-feed";
import { createLangChainTools } from "uk-drops-feed/langchain";
// Requires: npm install @langchain/core @langchain/openai

const client = new UkDropsFeedClient({
  trialKey: process.env.UKDF_TRIAL_KEY,
  autoTrial: !process.env.UKDF_TRIAL_KEY,
  trialRef: "langchain-js",
});

const tools = await createLangChainTools(client);
console.log("Loaded LangChain tools:", tools.map((t) => t.name));
// Pass `tools` to `createReactAgent({ llm, tools })` or `model.bindTools(tools)`.
