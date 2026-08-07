import { describeTarget } from "./geometry";
import {
  isBridgeInitMessage,
  type BridgeEvent,
  type HubCommand,
  type VerifiedSession,
} from "./protocol";

export * from "./geometry";
export * from "./protocol";

export type QaBridgeOptions = {
  allowedHubOrigins: readonly string[];
  deploymentId: string;
  gitSha: string;
  verifySessionToken: (token: string) => Promise<VerifiedSession>;
};

export type QaBridge = { destroy: () => void };

export function installQaBridge(options: QaBridgeOptions): QaBridge {
  let port: MessagePort | null = null;
  let expiresAt = 0;
  let mode: "browse" | "comment" = "browse";
  let destroyed = false;

  const post = (event: BridgeEvent) => {
    if (!port || Date.now() >= expiresAt) return;
    port.postMessage(event);
  };

  const sendState = () => {
    post({
      type: "knud.qa/state",
      href: location.href,
      pathname: location.pathname,
      query: location.search,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      deviceScaleFactor: window.devicePixelRatio,
      zoom: window.visualViewport?.scale ?? 1,
    });
  };

  const onClick = (event: MouseEvent) => {
    if (mode !== "comment" || !port || Date.now() >= expiresAt) return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    post({ type: "knud.qa/target", target: describeTarget(element, event.clientX, event.clientY) });
  };

  const onCommand = (event: MessageEvent<HubCommand>) => {
    const command = event.data;
    if (!command || typeof command !== "object" || Date.now() >= expiresAt) return;
    if (command.type === "knud.qa/set-mode") mode = command.mode;
    if (command.type === "knud.qa/request-state") sendState();
    if (command.type === "knud.qa/scroll-to") window.scrollTo(command.x, command.y);
  };

  const activate = async (event: MessageEvent) => {
    if (destroyed || port || !isBridgeInitMessage(event.data)) return;
    if (event.source !== window.parent || !options.allowedHubOrigins.includes(event.origin)) return;
    const candidatePort = event.ports[0];
    if (!candidatePort) return;

    try {
      const session = await options.verifySessionToken(event.data.token);
      if (
        session.hubOrigin !== event.origin ||
        session.deploymentOrigin !== location.origin ||
        session.deploymentId !== options.deploymentId ||
        session.expiresAt <= Date.now()
      ) {
        candidatePort.close();
        return;
      }

      port = candidatePort;
      expiresAt = session.expiresAt;
      port.addEventListener("message", onCommand);
      port.start();
      post({
        type: "knud.qa/ready",
        sessionId: session.sessionId,
        deploymentId: options.deploymentId,
        gitSha: options.gitSha,
        href: location.href,
      });
      sendState();
    } catch {
      candidatePort.close();
    }
  };

  window.addEventListener("message", activate);
  window.addEventListener("click", onClick, true);
  window.addEventListener("scroll", sendState, { passive: true });
  window.addEventListener("popstate", sendState);
  window.addEventListener("hashchange", sendState);

  return {
    destroy() {
      destroyed = true;
      mode = "browse";
      window.removeEventListener("message", activate);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", sendState);
      window.removeEventListener("popstate", sendState);
      window.removeEventListener("hashchange", sendState);
      port?.close();
      port = null;
    },
  };
}
