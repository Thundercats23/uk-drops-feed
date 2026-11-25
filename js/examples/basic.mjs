import { UkDropsFeedClient } from "../dist/index.js";

const client = new UkDropsFeedClient({
  trialKey: process.env.UKDF_TRIAL_KEY,
  creditToken: process.env.UKDF_CREDIT_TOKEN,
  autoTrial: !process.env.UKDF_TRIAL_KEY && !process.env.UKDF_CREDIT_TOKEN && !process.env.EVM_PRIVATE_KEY,
  trialRef: "js-example",
  evmPrivateKey: process.env.EVM_PRIVATE_KEY,
});

const teaser = await client.teaser("UK");
console.log("Free teaser drops:", teaser.drops?.length ?? 0);

const upcoming = await client.upcoming({ franchise: "pokemon-tcg", days: 60, limit: 5 });
console.log("Upcoming Pokemon TCG drops:", upcoming.count ?? upcoming.drops?.length ?? 0);
