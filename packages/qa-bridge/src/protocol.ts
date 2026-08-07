export const QA_PROTOCOL_VERSION = 1 as const;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VerifiedSession = {
  sessionId: string;
  hubOrigin: string;
  deploymentId: string;
  deploymentOrigin: string;
  expiresAt: number;
};

export type BridgeInitMessage = {
  type: "knud.qa/init";
  version: typeof QA_PROTOCOL_VERSION;
  token: string;
  nonce: string;
};

export type HubCommand =
  | { type: "knud.qa/set-mode"; mode: "browse" | "comment" }
  | { type: "knud.qa/request-state" }
  | { type: "knud.qa/scroll-to"; x: number; y: number };

export type ElementTarget = {
  qaId: string | null;
  entityKey: string | null;
  selectorHint: string;
  rect: Rect;
  documentRect: Rect;
  normalizedRect: Rect;
  relativePoint: { x: number; y: number };
};

export type BridgeEvent =
  | {
      type: "knud.qa/ready";
      sessionId: string;
      deploymentId: string;
      gitSha: string;
      href: string;
    }
  | {
      type: "knud.qa/state";
      href: string;
      pathname: string;
      query: string;
      scrollX: number;
      scrollY: number;
      viewportWidth: number;
      viewportHeight: number;
      deviceScaleFactor: number;
      zoom: number;
    }
  | { type: "knud.qa/target"; target: ElementTarget };

export function isBridgeInitMessage(value: unknown): value is BridgeInitMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BridgeInitMessage>;
  return (
    candidate.type === "knud.qa/init" &&
    candidate.version === QA_PROTOCOL_VERSION &&
    typeof candidate.token === "string" &&
    candidate.token.length >= 20 &&
    typeof candidate.nonce === "string" &&
    candidate.nonce.length >= 16
  );
}
