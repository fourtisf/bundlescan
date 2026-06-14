import WebSocket from "ws";
import { EventEmitter } from "events";
import { PUMPPORTAL_WS_URL } from "./config";

/**
 * Free realtime source — PumpPortal WebSocket (no API key, no Helius). Streams
 * new pump.fun token creations and per-token trades, which the live indexer
 * turns into block-zero forensics in realtime (lib/livescan.ts).
 * Docs: https://pumpportal.fun/data-api/real-time
 */

export interface PumpCreateEvent {
  signature: string;
  mint: string;
  traderPublicKey: string; // creator / dev
  txType: "create";
  initialBuy?: number; // tokens the dev bought at creation (UI amount)
  solAmount?: number;
  name?: string;
  symbol?: string;
  uri?: string;
  marketCapSol?: number;
  pool?: string;
}

export interface PumpTradeEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: "buy" | "sell";
  tokenAmount: number; // UI amount traded
  solAmount?: number;
  newTokenBalance?: number; // trader's balance after the trade (UI amount)
  marketCapSol?: number;
  pool?: string;
}

export interface PumpPortalClient {
  on(event: "newToken", listener: (e: PumpCreateEvent) => void): this;
  on(event: "trade", listener: (e: PumpTradeEvent) => void): this;
  on(event: "open", listener: () => void): this;
  on(event: "error", listener: (e: Error) => void): this;
}

export class PumpPortalClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private wantNewToken = false;
  private tracked = new Set<string>();
  private closed = false;

  connect(): void {
    this.ws = new WebSocket(PUMPPORTAL_WS_URL);

    this.ws.on("open", () => {
      this.reconnectDelay = 1000;
      this.emit("open");
      // Re-apply subscriptions after a (re)connect.
      if (this.wantNewToken) this.send({ method: "subscribeNewToken" });
      if (this.tracked.size) this.send({ method: "subscribeTokenTrade", keys: [...this.tracked] });
    });

    this.ws.on("message", (raw: WebSocket.RawData) => {
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (typeof d.message === "string") return; // server ack / status
      if (d.txType === "create") this.emit("newToken", d as unknown as PumpCreateEvent);
      else if (d.txType === "buy" || d.txType === "sell") this.emit("trade", d as unknown as PumpTradeEvent);
    });

    this.ws.on("close", () => {
      if (!this.closed) this.scheduleReconnect();
    });
    this.ws.on("error", (e: Error) => this.emit("error", e));
  }

  private scheduleReconnect(): void {
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  subscribeNewToken(): void {
    this.wantNewToken = true;
    this.send({ method: "subscribeNewToken" });
  }

  subscribeTokenTrade(mints: string[]): void {
    for (const m of mints) this.tracked.add(m);
    if (mints.length) this.send({ method: "subscribeTokenTrade", keys: mints });
  }

  unsubscribeTokenTrade(mints: string[]): void {
    for (const m of mints) this.tracked.delete(m);
    if (mints.length) this.send({ method: "unsubscribeTokenTrade", keys: mints });
  }

  get trackedCount(): number {
    return this.tracked.size;
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
