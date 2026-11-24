#!/usr/bin/env node
/**
 * Tiny UK Drops Feed client.
 * - teaser: free
 * - upcoming: credit/trial token, or x402 payment after a 402 inspect
 *
 * Does nothing paid unless you set UKDF_CREDIT_TOKEN or EVM_PRIVATE_KEY
 * and are not in UKDF_DRY_RUN=1.
 */
import { wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.UKDF_BASE || "https://uk-drops-feed.8bitbudgets.workers.dev";
const PAY_TO = "0xb3f6872E6ffeA3f8Da7a5d5EB52ed2a5e15D60AA".toLowerCase();
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DROP_AMOUNT = "10000"; // 0.01 USDC (6 decimals)
const NETWORK = "eip155:8453";
const UPCOMING = "/v1/drops/upcoming?franchise=pokemon-tcg&days=60&limit=10&region=UK";

function creditHeaders() {
  const trial = process.env.UKDF_TRIAL_KEY;
  if (trial) return { Authorization: `Bearer ${trial}`, "X-Trial-Key": trial };
  const token = process.env.UKDF_CREDIT_TOKEN;
  if (token) return { Authorization: `Bearer ${token}`, "X-Credit-Token": token };
  return {};
}

function decodePaymentRequired(res) {
  const raw = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function assertDropTerms(req) {
  const a = req?.accepts?.[0];
  if (!a) throw new Error("402 had no accepts[]");
  if (a.amount !== DROP_AMOUNT) throw new Error(`unexpected amount ${a.amount}, wanted ${DROP_AMOUNT}`);
  if (a.network !== NETWORK) throw new Error(`unexpected network ${a.network}`);
  if (String(a.asset).toLowerCase() !== USDC.toLowerCase()) throw new Error("unexpected asset");
  if (String(a.payTo).toLowerCase() !== PAY_TO) throw new Error("unexpected payTo");
  return a;
}

async function teaser() {
  const res = await fetch(`${BASE}/v1/teaser?region=UK`);
  if (!res.ok) throw new Error(`teaser ${res.status}`);
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
}

async function upcomingWithToken() {
  const res = await fetch(`${BASE}${UPCOMING}`, { headers: creditHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`upcoming ${res.status}: ${text.slice(0, 400)}`);
  console.log(text);
}

async function upcomingInspectOrPay() {
  const url = `${BASE}${UPCOMING}`;
  const pre = await fetch(url);
  if (pre.status === 200) {
    console.log(await pre.text());
    return;
  }
  if (pre.status !== 402) throw new Error(`expected 402 or 200, got ${pre.status}`);
  const req = decodePaymentRequired(pre);
  const accepted = assertDropTerms(req);
  console.error("402 terms OK:", { amount: accepted.amount, network: accepted.network, payTo: accepted.payTo, asset: accepted.asset });
  if (process.env.UKDF_DRY_RUN === "1") {
    console.error("UKDF_DRY_RUN=1 — not paying.");
    return;
  }
  const key = process.env.EVM_PRIVATE_KEY;
  if (!key) throw new Error("Set UKDF_TRIAL_KEY or UKDF_CREDIT_TOKEN, or EVM_PRIVATE_KEY to pay, or UKDF_DRY_RUN=1 to inspect only.");

  const signer = privateKeyToAccount(key);
  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(signer));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const httpClient = new x402HTTPClient(client);
  const response = await fetchWithPayment(url, { method: "GET" });
  const result = await httpClient.processResponse(response);
  if (result.paymentStatus === "settle_failed") {
    console.error("Settlement failed:", result.header);
    process.exit(2);
  }
  console.log(typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2));
}

const cmd = process.argv[2] || "teaser";
try {
  if (cmd === "teaser") await teaser();
  else if (cmd === "upcoming") {
    if (process.env.UKDF_TRIAL_KEY || process.env.UKDF_CREDIT_TOKEN) await upcomingWithToken();
    else await upcomingInspectOrPay();
  } else {
    console.error("Usage: node example.mjs [teaser|upcoming]");
    process.exit(1);
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
