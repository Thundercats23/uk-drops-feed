import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

export const DEFAULT_BASE_URL = "https://uk-drops-feed.8bitbudgets.workers.dev";
export const EXPECTED_PAY_TO = "0xb3f6872E6ffeA3f8Da7a5d5EB52ed2a5e15D60AA".toLowerCase();
export const BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
export const BASE_MAINNET_NETWORK = "eip155:8453";

export const FRANCHISES = [
  "pokemon-tcg",
  "mtg",
  "one-piece",
  "lorcana",
  "yugioh",
  "star-wars-unlimited",
  "lego",
  "video-game",
  "retail-sale",
  "jellycat",
  "needoh",
  "other",
] as const;

export type Franchise = (typeof FRANCHISES)[number];

export const DROP_KINDS = [
  "release",
  "retiring",
  "sale-window",
  "restock-watch",
  "reference",
  "prerelease",
  "organised-play",
] as const;

export type DropKind = (typeof DROP_KINDS)[number];

export const OFFER_CHANNELS = [
  "preorder",
  "raffle",
  "queue",
  "in-store-only",
  "online",
  "unconfirmed",
] as const;

export type OfferChannel = (typeof OFFER_CHANNELS)[number];

export interface UkDropsFeedOptions {
  /** Base URL (defaults to https://uk-drops-feed.8bitbudgets.workers.dev). */
  baseUrl?: string;
  /** 25-call free trial key (tr_...). */
  trialKey?: string;
  /** 25-call prepaid credit token (cr_...). */
  creditToken?: string;
  /** Automatically call POST /v1/trial-key on first paid-route call when no key/wallet is provided. */
  autoTrial?: boolean;
  /** Optional channel attribution tag passed to POST /v1/trial-key?ref=... (defaults to "js-sdk"). */
  trialRef?: string;
  /** Optional 0x-prefixed EVM private key for x402 USDC payments on Base mainnet. */
  evmPrivateKey?: `0x${string}`;
  /** Maximum atomic USDC units allowed per x402 payment (default "200000" = $0.20 USDC). */
  maxAtomicAmount?: string;
  /** Custom fetch implementation (useful for tests). */
  fetch?: typeof fetch;
}

export interface UpcomingParams {
  region?: string;
  franchise?: Franchise | string;
  kind?: DropKind | string;
  channel?: OfferChannel | string;
  set?: string;
  days?: number;
  limit?: number;
}

export interface CalendarParams {
  region?: string;
  franchise?: string;
  kind?: "release" | "prerelease" | string;
  set?: string;
  days?: number;
  limit?: number;
}

export interface RestocksParams {
  since?: string;
  region?: string;
  franchise?: Franchise | string;
  channel?: OfferChannel | string;
}

export interface StatusParams {
  ids?: string[] | string;
  region?: string;
  franchise?: Franchise | string;
}

export interface BriefsParams {
  franchise?: Franchise | string;
  week?: string;
}

export interface TrialKeyResponse {
  token: string;
  remaining: number;
  pack: number;
  issued_at: string;
  ref?: string;
  valid_for: string[];
  usage?: string;
}

export class UkDropsFeedError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "UkDropsFeedError";
  }
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

function decodePaymentRequired(res: Response): { accepts?: Array<Record<string, unknown>> } | null {
  const raw = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export class UkDropsFeedClient {
  public readonly baseUrl: string;
  private trialKey?: string;
  private creditToken?: string;
  private readonly autoTrial: boolean;
  private readonly trialRef: string;
  private readonly evmPrivateKey?: `0x${string}`;
  private readonly maxAtomicAmount: bigint;
  private readonly fetchImpl: typeof fetch;
  private paidFetchCache?: typeof fetch;

  constructor(options: UkDropsFeedOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.trialKey = options.trialKey;
    this.creditToken = options.creditToken;
    this.autoTrial = options.autoTrial ?? false;
    this.trialRef = options.trialRef ?? "js-sdk";
    this.evmPrivateKey = options.evmPrivateKey;
    this.maxAtomicAmount = BigInt(options.maxAtomicAmount ?? "200000");
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  setTrialKey(token: string): void {
    this.trialKey = token;
  }

  getTrialKey(): string | undefined {
    return this.trialKey;
  }

  setCreditToken(token: string): void {
    this.creditToken = token;
  }

  private authHeaders(): Record<string, string> {
    if (this.trialKey) {
      return { Authorization: `Bearer ${this.trialKey}`, "X-Trial-Key": this.trialKey };
    }
    if (this.creditToken) {
      return { Authorization: `Bearer ${this.creditToken}`, "X-Credit-Token": this.creditToken };
    }
    return {};
  }

  private async requestJson<T = Record<string, unknown>>(
    path: string,
    opts: { method?: "GET" | "POST"; body?: unknown; payable?: boolean; supportsTrial?: boolean } = {},
  ): Promise<T> {
    const method = opts.method ?? "GET";
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    };

    if (opts.supportsTrial !== false && this.trialKey) {
      Object.assign(headers, { Authorization: `Bearer ${this.trialKey}`, "X-Trial-Key": this.trialKey });
    } else if (opts.supportsTrial !== false && this.creditToken) {
      Object.assign(headers, { Authorization: `Bearer ${this.creditToken}`, "X-Credit-Token": this.creditToken });
    } else if (opts.payable && opts.supportsTrial !== false && this.autoTrial && !this.evmPrivateKey) {
      const issued = await this.mintTrialKey(this.trialRef);
      this.trialKey = issued.token;
      Object.assign(headers, { Authorization: `Bearer ${this.trialKey}`, "X-Trial-Key": this.trialKey });
    }

    const init: RequestInit = {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    };

    let res = await this.fetchImpl(url, init);

    if (res.status === 402 && opts.payable && this.evmPrivateKey) {
      const req = decodePaymentRequired(res);
      const accept = req?.accepts?.[0];
      if (!accept) throw new UkDropsFeedError("402 response missing accepts[]", 402, req);
      const amount = BigInt(String(accept.amount ?? "0"));
      if (amount <= 0n || amount > this.maxAtomicAmount) {
        throw new UkDropsFeedError(`402 amount ${amount} exceeds cap ${this.maxAtomicAmount}`, 402, accept);
      }
      if (String(accept.network) !== BASE_MAINNET_NETWORK) {
        throw new UkDropsFeedError(`Unexpected payment network ${String(accept.network)}`, 402, accept);
      }
      if (String(accept.asset).toLowerCase() !== BASE_USDC_ASSET) {
        throw new UkDropsFeedError(`Unexpected payment asset ${String(accept.asset)}`, 402, accept);
      }
      if (String(accept.payTo).toLowerCase() !== EXPECTED_PAY_TO) {
        throw new UkDropsFeedError(`Unexpected payTo address ${String(accept.payTo)}`, 402, accept);
      }
      if (!this.paidFetchCache) {
        const signer = privateKeyToAccount(this.evmPrivateKey);
        const client = new x402Client();
        client.register("eip155:*", new ExactEvmScheme(signer));
        this.paidFetchCache = wrapFetchWithPayment(this.fetchImpl, client);
      }
      res = await this.paidFetchCache(url, { method, headers: opts.body !== undefined ? { "Content-Type": "application/json" } : {}, ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}) });
    }

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // keep raw text
    }
    if (!res.ok) {
      throw new UkDropsFeedError(`UK Drops Feed ${method} ${path} failed with ${res.status}`, res.status, parsed);
    }
    return parsed as T;
  }

  /** Free: next 3 upcoming drops + restock watches. */
  async teaser<T = Record<string, unknown>>(region = "UK"): Promise<T> {
    return this.requestJson<T>(`/v1/teaser${buildQuery({ region })}`);
  }

  /** Free: permitted sources & attribution metadata. */
  async sources<T = Record<string, unknown>>(): Promise<T> {
    return this.requestJson<T>("/v1/sources");
  }

  /** Free: mint a 25-call trial key (up to 3 keys/day per IP). */
  async mintTrialKey(ref = this.trialRef): Promise<TrialKeyResponse> {
    const res = await this.requestJson<TrialKeyResponse>(
      `/v1/trial-key${buildQuery({ ref })}`,
      { method: "POST", supportsTrial: false },
    );
    this.trialKey = res.token;
    return res;
  }

  /** Free: check remaining trial calls for the active trial key. */
  async trialBalance<T = Record<string, unknown>>(): Promise<T> {
    if (!this.trialKey) throw new UkDropsFeedError("No trialKey configured", 401);
    return this.requestJson<T>("/v1/trial/balance");
  }

  /** Free: check remaining prepaid credits for the active credit token. */
  async creditsBalance<T = Record<string, unknown>>(): Promise<T> {
    if (!this.creditToken) throw new UkDropsFeedError("No creditToken configured", 401);
    return this.requestJson<T>("/v1/credits/balance");
  }

  /** $0.01 (or 1 trial/credit call): upcoming drops. */
  async upcoming<T = Record<string, unknown>>(params: UpcomingParams = {}): Promise<T> {
    return this.requestJson<T>(
      `/v1/drops/upcoming${buildQuery({ ...params })}`,
      { payable: true },
    );
  }

  /** $0.01 (or 1 trial/credit call): official TCG street-date calendar. */
  async calendar<T = Record<string, unknown>>(params: CalendarParams = {}): Promise<T> {
    return this.requestJson<T>(
      `/v1/drops/calendar${buildQuery({ ...params })}`,
      { payable: true },
    );
  }

  /** $0.01 (or 1 trial/credit call): restocks and in-stock items. */
  async restocks<T = Record<string, unknown>>(params: RestocksParams = {}): Promise<T> {
    return this.requestJson<T>(
      `/v1/drops/restocks${buildQuery({ ...params })}`,
      { payable: true },
    );
  }

  /** $0.01 (or 1 trial/credit call): curated stock, preorder and purchase-limit status. */
  async status<T = Record<string, unknown>>(params: StatusParams = {}): Promise<T> {
    const ids = Array.isArray(params.ids) ? params.ids.join(",") : params.ids;
    return this.requestJson<T>(
      `/v1/drops/status${buildQuery({ ids, region: params.region, franchise: params.franchise })}`,
      { payable: true },
    );
  }

  /** $0.01 (or 1 trial/credit call): one drop by id with offers and history. */
  async item<T = Record<string, unknown>>(id: string): Promise<T> {
    return this.requestJson<T>(`/v1/drops/item/${encodeURIComponent(id)}`, { payable: true });
  }

  /** $0.01 (or 1 trial/credit call): weekly official-source games and TCG brief. */
  async weeklyBrief<T = Record<string, unknown>>(params: BriefsParams = {}): Promise<T> {
    return this.requestJson<T>(
      `/v1/briefs/weekly${buildQuery({ ...params })}`,
      { payable: true },
    );
  }

  /** $0.20 (x402 only): buy a 25-call prepaid credit pack. */
  async buyCredits<T = Record<string, unknown>>(): Promise<T> {
    return this.requestJson<T>("/v1/credits/buy", { method: "POST", payable: true, supportsTrial: false });
  }

  /** $0.15 (x402 only): submit a hand-checked drop/stock question (async; poll askStatus). */
  async ask<T = Record<string, unknown>>(question: string): Promise<T> {
    return this.requestJson<T>("/v1/ask", {
      method: "POST",
      body: { question },
      payable: true,
      supportsTrial: false,
    });
  }

  /** Free: poll a submitted /v1/ask/{id} question. */
  async askStatus<T = Record<string, unknown>>(id: string): Promise<T> {
    return this.requestJson<T>(`/v1/ask/${encodeURIComponent(id)}`, { supportsTrial: false });
  }
}
