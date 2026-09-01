const QA_ROUTE_STATE_EVENT = "knud.qa/route-state";
const QA_ROUTE_READY_EVENT = "knud.qa/route-ready";

type QaRouteStateMessage = {
  type: typeof QA_ROUTE_STATE_EVENT;
  version: 1;
  pathname: string;
};

type QaRouteReadyMessage = {
  type: typeof QA_ROUTE_READY_EVENT;
  version: 1;
};

export function isQaRouteReady(
  value: unknown,
  eventOrigin: string,
  expectedDeploymentOrigin: string,
) {
  if (eventOrigin !== expectedDeploymentOrigin) return false;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QaRouteReadyMessage>;
  return candidate.type === QA_ROUTE_READY_EVENT && candidate.version === 1;
}

export function readQaRouteState(
  value: unknown,
  eventOrigin: string,
  expectedDeploymentOrigin: string,
) {
  if (eventOrigin !== expectedDeploymentOrigin) return null;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<QaRouteStateMessage>;
  if (
    candidate.type !== QA_ROUTE_STATE_EVENT ||
    candidate.version !== 1 ||
    typeof candidate.pathname !== "string" ||
    !candidate.pathname.startsWith("/") ||
    candidate.pathname.startsWith("//")
  ) {
    return null;
  }

  return candidate.pathname;
}
