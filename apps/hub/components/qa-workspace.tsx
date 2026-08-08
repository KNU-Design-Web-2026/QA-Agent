"use client";

import {
  ArrowsOutCardinal,
  ArrowSquareOut,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChatCenteredText,
  CornersOut,
  Cursor,
  Eyedropper,
  Eye,
  EyeSlash,
  MapPin,
  Minus,
  PencilSimple,
  Plus,
  RectangleDashed,
  SidebarSimple,
  SignOut,
  SquaresFour,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQaAccessSession } from "@/components/auth-gate";

const viewports = [
  { width: 1920, height: 1340 },
  { width: 1350, height: 900 },
  { width: 1020, height: 1370 },
  { width: 600, height: 980 },
  { width: 400, height: 880 },
] as const;

type Tool = "browse" | "pin" | "area" | "arrow" | "draw" | "compare";
type Point = { x: number; y: number };
type Draft = { start: Point; end: Point; kind: "pin" | "area" };
type QaStatus = "open" | "in_progress" | "review_requested" | "done";
type QaComment = {
  id: string;
  body: string;
  type: "visual" | "interaction" | "content" | "design_reference";
  priority: "low" | "medium" | "high" | "blocker";
  status: QaStatus;
  pathname: string;
  query_string: string;
  viewport_width: number;
  viewport_height: number;
  device_scale_factor: number;
  zoom: number;
  scroll_x: number;
  scroll_y: number;
  element_qa_id: string | null;
  normalized_anchor_json: Record<string, unknown>;
  created_at: string;
  author: { display_name: string | null; email: string } | null;
  annotations: Array<{
    id: string;
    kind: string;
    geometry_json: Record<string, unknown>;
  }>;
};
type DeploymentInfo = {
  id: string;
  immutable_url: string;
  production_alias: string | null;
  git_sha: string;
  git_ref: string | null;
  provider_deployment_id: string;
  deployed_at: string | null;
  created_at: string;
};
type MarkerPreview = {
  comment: QaComment;
  x: number;
  y: number;
  side: "left" | "right";
};
type TutorialSpotlight = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const statusLabel: Record<QaStatus, string> = {
  open: "열림",
  in_progress: "진행 중",
  review_requested: "검토 요청",
  done: "완료",
};
const priorityLabel: Record<QaComment["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  blocker: "Blocker",
};
const nextStatus: Record<QaStatus, QaStatus> = {
  open: "in_progress",
  in_progress: "review_requested",
  review_requested: "done",
  done: "open",
};
const tutorialSteps = [
  {
    title: "KNUD Design QA 튜토리얼",
    description: "디자인학과 졸업 전시회 화이팅!! Enter로 넘기면 편해용",
    target: null,
  },
  {
    title: "실제 소개 사이트를 살펴보세요",
    description:
      "가운데 화면은 지금 공개된 전시 사이트입니다. \n 직접 클릭하고 페이지를 이동해 보세요.",
    target: '[data-tutorial="qa-preview"]',
  },
  {
    title: "확인할 화면 크기를 골라보세요",
    description:
      "왼쪽에서 컴퓨터, 태블릿, 휴대폰 화면 크기를 선택할 수 있습니다. 보기 비율을 바꿔도 선택한 화면 크기는 그대로 유지돼요.",
    target: '[data-tutorial="qa-screen-size"]',
  },
  {
    title: "넓은 화면으로 보고 싶다면",
    description:
      "왼쪽 위 버튼으로 목록과 상세 패널을 접을 수 있어요.\n사이트 화면을 더 넓게 보며 확인하고 싶을 때 사용하세요.",
    target: '[data-tutorial="qa-panel-toggles"]',
  },
  {
    title: "보기 비율과 실제 크기",
    description:
      "67%는 화면을 작업 공간에 맞게 줄여 보여 주는 비율이에요.\n선택한 화면 크기와 내용은 그대로 유지됩니다.\n원본 크기로 확인하려면 실제 크기로 열기를 눌러 보세요.",
    target: '[data-tutorial="qa-open-original"]',
  },
  {
    title: "수정이 필요한 곳을 표시하세요",
    description:
      "마커랑 드래그 툴을 사용해서, \n 수정이 필요한 위치를 표시하고 의견을 남겨주세요 :) ",
    target: '[data-tutorial="qa-comment"]',
    demo: "comment",
  },
  {
    title: "의견을 적어주세요",
    description:
      "무엇이 어색한지, 어떻게 바뀌면 좋은지 자유롭게 적어주세요. \n 급한 작업은 우선순위 남겨주세요! 참고자료도 함께 있으면 👍🏻",
    target: '[data-tutorial="qa-comment"]',
    demo: "priority",
  },
  {
    title: "남긴 의견을 다시 확인하세요",
    description:
      "이름이 적힌 표시를 누르면 코멘트를 다시 볼 수 있습니다. \n 다른 사람의 의견도 함께 확인해 보세요.",
    target: '[data-tutorial="qa-comment-list"]',
  },
  {
    title: "내 의견은 다시 수정할 수 있어요",
    description:
      "내 코멘트에서 의견을 선택한 뒤, \n 오른쪽 상세 화면의 내 의견 수정을 눌러 내용을 고쳐 주세요.",
    target: '[data-tutorial="qa-my-comments"]',
    demo: "edit",
  },
] as const;

export function QaWorkspace({
  deploymentUrl,
}: {
  deploymentUrl: string | null;
}) {
  const accessSession = useQaAccessSession();
  const [tool, setTool] = useState<Tool>("browse");
  const [selectedViewport, setSelectedViewport] = useState(() => {
    if (typeof window === "undefined") return 2;
    const width = Number(
      new URLSearchParams(window.location.search).get("viewport"),
    );
    const index = viewports.findIndex((viewport) => viewport.width === width);
    return index === -1 ? 2 : index;
  });
  const [route, setRoute] = useState(() =>
    typeof window === "undefined"
      ? "/"
      : (new URLSearchParams(window.location.search).get("route") ?? "/"),
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [priority, setPriority] = useState<QaComment["priority"]>("high");
  const [comparePosition, setComparePosition] = useState(62);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [comments, setComments] = useState<QaComment[]>([]);
  const [authoredComments, setAuthoredComments] = useState<QaComment[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  );
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [editedPriority, setEditedPriority] =
    useState<QaComment["priority"]>("medium");
  const [editError, setEditError] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [isRegisteringDeployment, setIsRegisteringDeployment] = useState(false);
  const [deploymentForm, setDeploymentForm] = useState({
    immutableUrl: "",
    providerDeploymentId: "",
    gitSha: "",
    gitRef: "main",
  });
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [hoveredMarker, setHoveredMarker] = useState<MarkerPreview | null>(
    null,
  );
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(0.67);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<Draft | null>(null);
  const currentViewport = viewports[selectedViewport] ?? {
    width: 1020,
    height: 1370,
  };
  const zoom = previewZoom;
  const projectSlug =
    process.env.NEXT_PUBLIC_QA_PROJECT_SLUG ?? "knud-exhibition";
  const fallbackDeploymentUrl = (
    deploymentUrl ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const selectedDeployment =
    deployments.find((item) => item.id === selectedDeploymentId) ?? null;
  const actualUrl = selectedDeployment?.immutable_url ?? fallbackDeploymentUrl;
  const isCommentMode = tool === "pin" || tool === "area" || commentOpen;
  const selectedComment =
    comments.find((comment) => comment.id === selectedCommentId) ??
    comments[0] ??
    null;

  const openOriginalSize = () =>
    window.open(
      new URL(route, actualUrl).toString(),
      "_blank",
      "noopener,noreferrer",
    );
  const openTutorial = () => {
    setIsLeftPanelOpen(true);
    setIsRightPanelOpen(true);
    setTool("browse");
    setTutorialStep(0);
    setIsTutorialOpen(true);
  };
  const startTutorial = () => {
    setIsLeftPanelOpen(true);
    setIsRightPanelOpen(true);
    setTool("browse");
    setTutorialStep(1);
  };

  const saveTutorialState = async (action: "dismiss" | "complete") => {
    try {
      await fetch("/api/tutorial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch {
      // The tutorial should still close even if a temporary network error occurs.
    }
  };

  const loadDeployments = useCallback(async () => {
    setDeploymentsError(null);
    try {
      const response = await fetch(
        `/api/deployments?${new URLSearchParams({ projectSlug })}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "배포 버전 목록을 불러오지 못했습니다.",
        );
      const nextDeployments = result.deployments ?? [];
      setDeployments(nextDeployments);
      setSelectedDeploymentId(
        result.activeDeploymentId ?? nextDeployments[0]?.id ?? null,
      );
    } catch (error) {
      setDeploymentsError(
        error instanceof Error
          ? error.message
          : "배포 버전 목록을 불러오지 못했습니다.",
      );
      setDeployments([]);
      setSelectedDeploymentId(null);
    }
  }, [projectSlug]);

  const loadComments = useCallback(async () => {
    if (!selectedDeployment) {
      setComments([]);
      setSelectedCommentId(null);
      setIsLoadingComments(false);
      return;
    }
    setIsLoadingComments(true);
    setCommentsError(null);
    try {
      const params = new URLSearchParams({
        projectSlug,
        deploymentUrl: actualUrl,
        pathname: route,
      });
      const response = await fetch(`/api/comments?${params}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "코멘트 목록을 불러오지 못했습니다.");
      setComments(result.comments ?? []);
      setSelectedCommentId((current) =>
        result.comments?.some((comment: QaComment) => comment.id === current)
          ? current
          : (result.comments?.[0]?.id ?? null),
      );
    } catch (error) {
      setCommentsError(
        error instanceof Error
          ? error.message
          : "코멘트 목록을 불러오지 못했습니다.",
      );
      setComments([]);
      setSelectedCommentId(null);
    } finally {
      setIsLoadingComments(false);
    }
  }, [actualUrl, projectSlug, route, selectedDeployment]);

  const loadAuthoredComments = useCallback(async () => {
    if (!selectedDeployment) {
      setAuthoredComments([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        projectSlug,
        deploymentUrl: actualUrl,
        scope: "authored",
      });
      const response = await fetch(`/api/comments?${params}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "내 코멘트를 불러오지 못했습니다.");
      setAuthoredComments(result.comments ?? []);
    } catch {
      setAuthoredComments([]);
    }
  }, [actualUrl, projectSlug, selectedDeployment]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      if (event.key === "Escape") {
        setTool("browse");
        setCommentOpen(false);
        setDraft(null);
        draftRef.current = null;
        setIsSelecting(false);
      }
      const shortcut = event.key.toLowerCase();
      if (shortcut === "v" || shortcut === "c" || shortcut === "r") {
        event.preventDefault();
        setTool(
          shortcut === "v" ? "browse" : shortcut === "c" ? "pin" : "area",
        );
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    void loadDeployments();
  }, [loadDeployments]);
  useEffect(() => {
    let isMounted = true;
    fetch("/api/tutorial")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "튜토리얼 상태를 불러오지 못했습니다.",
          );
        if (isMounted) setIsTutorialOpen(result.shouldShow === true);
      })
      .catch(() => {
        if (isMounted) setIsTutorialOpen(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    void loadComments();
  }, [loadComments]);
  useEffect(() => {
    void loadAuthoredComments();
  }, [loadAuthoredComments]);

  useEffect(() => {
    const commentId = new URLSearchParams(window.location.search).get(
      "comment",
    );
    if (commentId && comments.some((comment) => comment.id === commentId))
      setSelectedCommentId(commentId);
  }, [comments]);

  const pointerToCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(currentViewport.width, (event.clientX - rect.left) / zoom),
      ),
      y: Math.max(
        0,
        Math.min(currentViewport.height, (event.clientY - rect.top) / zoom),
      ),
    };
  };

  const selectTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCommentMode || commentOpen || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    const nextDraft = {
      start: point,
      end: point,
      kind: tool === "area" ? "area" : "pin",
    } as Draft;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setIsSelecting(true);
  };

  const updateTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    const currentDraft = draftRef.current;
    if (!isSelecting || !currentDraft || currentDraft.kind !== "area") return;
    const nextDraft = { ...currentDraft, end: pointerToCanvas(event) };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };

  const finishTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelecting || !draftRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setIsSelecting(false);
    setCommentOpen(true);
  };

  const cancelTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setIsSelecting(false);
  };

  const scaleLabel = `${Math.round(zoom * 100)}%`;
  const deploymentLabel = selectedDeployment?.git_sha
    ? selectedDeployment.git_sha.slice(0, 7)
    : "버전 미선택";
  const deployedLabel = selectedDeployment?.deployed_at
    ? relativeTime(selectedDeployment.deployed_at)
    : "배포 시각 없음";

  async function saveComment() {
    if (!draft || !message.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const normalizedAnchor = {
        space: "viewport-normalized",
        x: Math.min(draft.start.x, draft.end.x) / currentViewport.width,
        y: Math.min(draft.start.y, draft.end.y) / currentViewport.height,
        width: Math.abs(draft.end.x - draft.start.x) / currentViewport.width,
        height: Math.abs(draft.end.y - draft.start.y) / currentViewport.height,
      };
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectSlug,
          deploymentUrl: actualUrl,
          body: message.trim(),
          pathname: route,
          viewportWidth: currentViewport.width,
          viewportHeight: currentViewport.height,
          deviceScaleFactor: window.devicePixelRatio,
          zoom,
          kind: draft.kind,
          anchor: normalizedAnchor,
          type: "visual",
          priority,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "코멘트를 저장하지 못했습니다.");
      setMessage("");
      setCommentOpen(false);
      setTool("browse");
      setDraft(null);
      draftRef.current = null;
      await loadComments();
      await loadAuthoredComments();
      setSelectedCommentId(result.id);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "코멘트를 저장하지 못했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function signOut() {
    setIsSigningOut(true);
    try {
      await fetch("/api/access", { method: "DELETE" });
    } finally {
      window.location.reload();
    }
  }

  async function registerDeployment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRegisteringDeployment(true);
    setDeploymentsError(null);
    try {
      const response = await fetch("/api/deployments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectSlug, ...deploymentForm }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "배포 버전을 등록하지 못했습니다.");
      await loadDeployments();
      setDeploymentForm({
        immutableUrl: "",
        providerDeploymentId: "",
        gitSha: "",
        gitRef: "main",
      });
      setIsDeploymentModalOpen(false);
    } catch (error) {
      setDeploymentsError(
        error instanceof Error
          ? error.message
          : "배포 버전을 등록하지 못했습니다.",
      );
    } finally {
      setIsRegisteringDeployment(false);
    }
  }

  async function activateDeployment(deploymentId: string) {
    setDeploymentsError(null);
    try {
      const response = await fetch("/api/deployments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectSlug, deploymentId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "QA 기준 버전을 변경하지 못했습니다.");
      setSelectedDeploymentId(result.activeDeploymentId);
    } catch (error) {
      setDeploymentsError(
        error instanceof Error
          ? error.message
          : "QA 기준 버전을 변경하지 못했습니다.",
      );
    }
  }

  async function updateCommentStatus(nextStatus: QaStatus) {
    if (!selectedComment) return;
    setIsTransitioning(true);
    try {
      const response = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId: selectedComment.id, nextStatus }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "상태를 변경하지 못했습니다.");
      await loadComments();
      await loadAuthoredComments();
    } catch (error) {
      setCommentsError(
        error instanceof Error ? error.message : "상태를 변경하지 못했습니다.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }

  function startEditingComment() {
    if (!selectedComment) return;
    setEditedBody(selectedComment.body);
    setEditedPriority(selectedComment.priority);
    setEditError(null);
    setIsEditingComment(true);
  }

  async function saveEditedComment() {
    if (!selectedComment || !editedBody.trim()) return;
    setIsTransitioning(true);
    setEditError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          commentId: selectedComment.id,
          body: editedBody.trim(),
          priority: editedPriority,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "코멘트를 수정하지 못했습니다.");
      setIsEditingComment(false);
      await loadComments();
      await loadAuthoredComments();
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "코멘트를 수정하지 못했습니다.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }

  const openComment = (comment: QaComment) => {
    setRoute(comment.pathname);
    setSelectedCommentId(comment.id);
    setIsEditingComment(false);
  };

  return (
    <main className="qa-app">
      <header className="qa-toolbar">
        <div className="toolbar-tools">
          <img
            className="toolbar-logo"
            src="/assets/ignite-mark-white.png"
            alt="KNUD Design QA"
            width={260}
            height={145}
          />
          <div
            className="panel-toggles"
            data-tutorial="qa-panel-toggles"
            aria-label="패널 표시 설정"
          >
            <button
              className={`panel-toggle ${!isLeftPanelOpen ? "is-closed" : ""}`}
              type="button"
              data-tooltip={
                isLeftPanelOpen ? "왼쪽 목록 숨기기" : "왼쪽 목록 보기"
              }
              aria-label={
                isLeftPanelOpen ? "좌측 패널 숨기기" : "좌측 패널 보기"
              }
              aria-pressed={isLeftPanelOpen}
              onClick={() => setIsLeftPanelOpen((open) => !open)}
            >
              <SidebarSimple />
            </button>
            <button
              className={`panel-toggle panel-toggle--right ${!isRightPanelOpen ? "is-closed" : ""}`}
              type="button"
              data-tooltip={
                isRightPanelOpen ? "오른쪽 상세 숨기기" : "오른쪽 상세 보기"
              }
              aria-label={
                isRightPanelOpen ? "우측 패널 숨기기" : "우측 패널 보기"
              }
              aria-pressed={isRightPanelOpen}
              onClick={() => setIsRightPanelOpen((open) => !open)}
            >
              <SidebarSimple />
            </button>
          </div>
          <span className="toolbar-divider" />
          <ToolButton
            active={tool === "browse"}
            title="탐색 · V"
            onClick={() => setTool("browse")}
          >
            <Cursor />
          </ToolButton>
          <div className="toolbar-comment-tools" data-tutorial="qa-comment">
            <ToolButton
              active={tool === "pin"}
              title="핀 코멘트 · C"
              onClick={() => setTool("pin")}
            >
              <MapPin />
            </ToolButton>
            <ToolButton
              active={tool === "area"}
              title="영역 코멘트 · R"
              onClick={() => setTool("area")}
            >
              <RectangleDashed />
            </ToolButton>
          </div>
          <ToolButton
            active={false}
            title="드로잉 (준비 중)"
            onClick={() =>
              setComingSoon("드로잉 주석은 다음 작업에서 추가됩니다.")
            }
          >
            <PencilSimple />
          </ToolButton>
          <span className="toolbar-divider" />
          <ToolButton
            active={false}
            title="비교 (준비 중)"
            onClick={() =>
              setComingSoon(
                "Figma 기준 연결 및 비교 기능은 추가 구현 중입니다.",
              )
            }
          >
            <SquaresFour />
          </ToolButton>
        </div>
        <div className="project-name">
          <strong>KNUD 2026 Exhibition</strong>
          <span>/</span>
          {accessSession?.role === "admin" ? (
            <label className="deploy-select">
              <i />
              <select
                value={selectedDeploymentId ?? ""}
                onChange={(event) =>
                  void activateDeployment(event.target.value)
                }
                aria-label="QA 기준 배포 버전"
              >
                <option value="">배포 버전 선택</option>
                {deployments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.git_sha.slice(0, 7)} ·{" "}
                    {item.deployed_at
                      ? relativeTime(item.deployed_at)
                      : "배포 시각 없음"}
                  </option>
                ))}
              </select>
              <code>{deploymentLabel}</code>
              <small>{deployedLabel}</small>
            </label>
          ) : (
            <span className="deploy-select">
              <i />
              QA 기준 <code>{deploymentLabel}</code>
              <small>{deployedLabel}</small>
            </span>
          )}
        </div>
        <div className="toolbar-actions">
          {accessSession?.role === "admin" && (
            <button
              className="register-deployment-button"
              type="button"
              onClick={() => setIsDeploymentModalOpen(true)}
            >
              새 버전 등록
            </button>
          )}
          <span className="user-profile" title={accessSession?.email}>
            <b>{accessSession?.displayName ?? "사용자"}</b>
          </span>
          <button
            className="tutorial-replay-button"
            type="button"
            onClick={openTutorial}
          >
            튜토리얼 다시보기
          </button>
          <button
            className="logout-button"
            type="button"
            onClick={() => void signOut()}
            disabled={isSigningOut}
            title="로그아웃"
            aria-label="로그아웃"
          >
            <SignOut />
            {isSigningOut ? "나가는 중" : "로그아웃"}
          </button>
        </div>
      </header>
      {comingSoon && (
        <div className="tool-modal-backdrop">
          <section
            className="tool-notice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-notice-title"
          >
            <span className="tool-notice__eyebrow">KNUD DESIGN QA HUB</span>
            <h2 id="tool-notice-title">추가 구현 중입니다</h2>
            <p>{comingSoon}</p>
            <button type="button" onClick={() => setComingSoon(null)}>
              확인
            </button>
          </section>
        </div>
      )}
      {isDeploymentModalOpen && (
        <div className="tool-modal-backdrop">
          <form className="deployment-modal" onSubmit={registerDeployment}>
            <span className="tool-notice__eyebrow">DEPLOYMENT RECORD</span>
            <h2>새 배포 버전 등록</h2>
            <p>
              Vercel 배포 상세에서 고유 URL, Deployment ID, Git SHA를 복사해
              입력하세요.
            </p>
            <label>
              고유 Deployment URL
              <input
                type="url"
                value={deploymentForm.immutableUrl}
                onChange={(event) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    immutableUrl: event.target.value,
                  })
                }
                placeholder="https://…vercel.app"
                required
                autoFocus
              />
            </label>
            <label>
              Vercel Deployment ID
              <input
                value={deploymentForm.providerDeploymentId}
                onChange={(event) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    providerDeploymentId: event.target.value,
                  })
                }
                placeholder="dpl_…"
                required
              />
            </label>
            <label>
              Git SHA
              <input
                value={deploymentForm.gitSha}
                onChange={(event) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    gitSha: event.target.value,
                  })
                }
                placeholder="전체 SHA 또는 앞 7자리"
                minLength={7}
                required
              />
            </label>
            <label>
              Git Branch
              <input
                value={deploymentForm.gitRef}
                onChange={(event) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    gitRef: event.target.value,
                  })
                }
                required
              />
            </label>
            {deploymentsError && (
              <div className="deployment-modal__error">{deploymentsError}</div>
            )}
            <footer>
              <button
                type="button"
                className="cancel"
                onClick={() => setIsDeploymentModalOpen(false)}
              >
                취소
              </button>
              <button
                type="submit"
                className="save"
                disabled={isRegisteringDeployment}
              >
                {isRegisteringDeployment ? "등록 중…" : "버전 등록"}
              </button>
            </footer>
          </form>
        </div>
      )}

      <section
        className={`qa-layout ${!isLeftPanelOpen ? "qa-layout--left-closed" : ""} ${!isRightPanelOpen ? "qa-layout--right-closed" : ""}`}
      >
        <aside className="left-panel">
          <div className="panel-heading">
            <strong>검수 설정</strong>
            <small>현재 화면</small>
          </div>
          <SectionTitle label="현재 페이지" />
          <div className="tree-list">
            <div
              className="tree-row current-route"
              aria-label={`현재 경로 ${route}`}
            >
              <CornersOut />
              <code>{route}</code>
              <b>{comments.length}</b>
            </div>
          </div>
          <div className="panel-rule" />
          <SectionTitle label="검수 뷰포트" />
          <div className="tree-list" data-tutorial="qa-screen-size">
            {viewports.map((item, index) => (
              <button
                key={item.width}
                className={`tree-row viewport-row ${selectedViewport === index ? "selected" : ""}`}
                onClick={() => setSelectedViewport(index)}
              >
                <span className="viewport-icon" />
                <code>
                  {item.width} × {item.height}
                </code>
                {selectedViewport === index && <b>주 화면</b>}
              </button>
            ))}
          </div>
          <div className="panel-rule" />
          <SectionTitle label="현재 페이지" count={String(comments.length)} />
          <div className="comment-list" data-tutorial="qa-comment-list">
            {comments.map((comment) => (
              <CommentListItem
                key={comment.id}
                comment={comment}
                selected={selectedComment?.id === comment.id}
                onClick={() => setSelectedCommentId(comment.id)}
              />
            ))}
            {!isLoadingComments && !comments.length && (
              <p className="empty-comments">
                이 경로에는 아직 코멘트가 없습니다.
              </p>
            )}
          </div>
          <div className="panel-rule" />
          <SectionTitle
            label="내 코멘트"
            count={String(authoredComments.length)}
          />
          <div className="comment-list" data-tutorial="qa-my-comments">
            {authoredComments.map((comment) => (
              <CommentListItem
                key={comment.id}
                comment={comment}
                selected={selectedComment?.id === comment.id}
                onClick={() => openComment(comment)}
              />
            ))}
            {!authoredComments.length && (
              <p className="empty-comments">
                이 버전에서 작성한 코멘트가 없습니다.
              </p>
            )}
          </div>
        </aside>

        <section className="qa-canvas">
          <div className="frame-workspace">
            <article
              className="live-stage"
              style={{ width: Math.round(currentViewport.width * zoom) }}
            >
              <header className="frame-caption">
                <span>
                  <code>
                    {currentViewport.width} × {currentViewport.height}
                  </code>{" "}
                  태블릿 · 주 검수 화면
                </span>
                <span>
                  <code>{scaleLabel}</code> · scrollY 0
                </span>
              </header>
              <div className="live-frame" data-tutorial="qa-preview">
                <div className="browser-bar">
                  <button aria-label="뒤로">
                    <CaretLeft />
                  </button>
                  <button aria-label="새로고침">
                    <span className="reload">↻</span>
                  </button>
                  <div className="address">
                    <i /> <code>knud-2026.vercel.app</code>
                    <strong>{route}</strong>
                  </div>
                  <span className="live-badge">
                    <i />
                    전시 사이트
                  </span>
                </div>
                {isCommentMode && (
                  <div className="mode-banner">
                    <span>
                      <MapPin /> 코멘트 모드 — 사이트 위를 클릭하거나 영역을
                      드래그하세요
                    </span>
                    <button
                      onClick={() => {
                        setTool("browse");
                        setCommentOpen(false);
                        setDraft(null);
                        draftRef.current = null;
                        setIsSelecting(false);
                        setSaveError(null);
                      }}
                    >
                      <kbd>Esc</kbd> 종료
                    </button>
                  </div>
                )}
                <div
                  className="viewport-clip"
                  style={{
                    width: Math.round(currentViewport.width * zoom),
                    height: Math.round(currentViewport.height * zoom),
                  }}
                >
                  <div
                    className="scaled-viewport"
                    style={{
                      width: currentViewport.width,
                      height: currentViewport.height,
                      transform: `scale(${zoom})`,
                    }}
                  >
                    <iframe
                      title="KNUD production deployment"
                      src={`${actualUrl}${route}`}
                      scrolling="yes"
                      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                    />
                  </div>
                  {tool === "compare" && (
                    <CompareOverlay
                      position={comparePosition}
                      onChange={setComparePosition}
                    />
                  )}
                  {isCommentMode && (
                    <div
                      className="comment-mask"
                      style={{ pointerEvents: commentOpen ? "none" : "auto" }}
                      onPointerDown={selectTarget}
                      onPointerMove={updateTarget}
                      onPointerUp={finishTarget}
                      onPointerCancel={cancelTarget}
                    />
                  )}
                  {draft && (
                    <Selection
                      draft={draft}
                      zoom={zoom}
                      viewport={currentViewport}
                    />
                  )}
                  {markersVisible && hoveredMarker && (
                    <SavedAreaPreview
                      comment={hoveredMarker.comment}
                      zoom={zoom}
                      viewport={currentViewport}
                    />
                  )}
                  {markersVisible &&
                    comments.map((comment, index) => (
                      <SavedAnnotation
                        key={comment.id}
                        comment={comment}
                        number={index + 1}
                        zoom={zoom}
                        viewport={currentViewport}
                        onClick={() => setSelectedCommentId(comment.id)}
                        onHover={(point) =>
                          setHoveredMarker({ comment, ...point })
                        }
                        onLeave={() => setHoveredMarker(null)}
                      />
                    ))}
                  {commentOpen && draft && (
                    <CommentComposer
                      message={message}
                      setMessage={setMessage}
                      saveError={saveError}
                      isSaving={isSaving}
                      draft={draft}
                      zoom={zoom}
                      viewport={currentViewport}
                      canvasHeight={Math.round(currentViewport.height * zoom)}
                      priority={priority}
                      setPriority={setPriority}
                      onCancel={() => {
                        setCommentOpen(false);
                        setDraft(null);
                        draftRef.current = null;
                        setTool("browse");
                        setSaveError(null);
                      }}
                      onSave={saveComment}
                    />
                  )}
                </div>
              </div>
              {markersVisible && hoveredMarker && (
                <MarkerTooltip preview={hoveredMarker} />
              )}
              <p className="frame-hint">
                탐색 모드에서 프레임 안을 스크롤하며 실제 사이트를 확인하세요.{" "}
                <strong>코멘트를 남기려면</strong> <kbd>C</kbd> 또는 아래 주석
                버튼
              </p>
            </article>
          </div>
          <nav className="mode-switch">
            <button
              className={tool === "browse" ? "active" : ""}
              onClick={() => setTool("browse")}
            >
              <Cursor />
              탐색
            </button>
            <button
              className={isCommentMode ? "active" : ""}
              onClick={() => setTool("pin")}
            >
              <MapPin />
              코멘트 <kbd>C</kbd>
            </button>
            <button
              onClick={() =>
                setMarkersVisible((visible) => {
                  if (visible) setHoveredMarker(null);
                  return !visible;
                })
              }
            >
              {markersVisible ? <EyeSlash /> : <Eye />}
              {markersVisible ? "마커 숨기기" : "마커 보기"}
            </button>
            <button
              onClick={() =>
                setComingSoon(
                  "Figma 기준 연결 및 비교 기능은 추가 구현 중입니다.",
                )
              }
            >
              <SquaresFour />
              비교
            </button>
            <span className="mode-switch__divider" />
            <button
              className="open-original-mode"
              data-tutorial="qa-open-original"
              type="button"
              onClick={openOriginalSize}
              title="선택한 전시 사이트를 실제 크기로 새 탭에서 열기"
            >
              <ArrowSquareOut />
              실제 크기로 열기
            </button>
            <label className="preview-zoom-control">
              보기
              <select
                value={previewZoom}
                onChange={(event) => setPreviewZoom(Number(event.target.value))}
                aria-label="검수 화면 보기 배율"
              >
                <option value={0.5}>50%</option>
                <option value={0.67}>67%</option>
                <option value={0.8}>80%</option>
                <option value={1}>100%</option>
              </select>
            </label>
          </nav>
        </section>

        <aside className="right-panel">
          <div className="panel-heading">
            <strong>선택한 코멘트</strong>
            <small>상세 · 재현 · 상태</small>
          </div>
          <CommentInspector
            comment={selectedComment}
            isLoading={isLoadingComments}
            error={commentsError}
            isTransitioning={isTransitioning}
            canEdit={
              Boolean(accessSession?.email) &&
              selectedComment?.author?.email.toLowerCase() ===
                accessSession?.email.toLowerCase()
            }
            isEditing={isEditingComment}
            editedBody={editedBody}
            editedPriority={editedPriority}
            editError={editError}
            onStartEdit={startEditingComment}
            onCancelEdit={() => {
              setIsEditingComment(false);
              setEditError(null);
            }}
            onSaveEdit={() => void saveEditedComment()}
            onEditedBodyChange={setEditedBody}
            onEditedPriorityChange={setEditedPriority}
            canComplete={accessSession?.role === "admin"}
            onTransition={() =>
              void updateCommentStatus(
                nextStatus[selectedComment?.status ?? "open"],
              )
            }
            onComplete={() => void updateCommentStatus("done")}
          />
        </aside>
      </section>
      {isTutorialOpen && (
        <TutorialTour
          step={tutorialStep}
          onStart={startTutorial}
          onNext={() => {
            if (tutorialStep === tutorialSteps.length - 1) {
              setIsTutorialOpen(false);
              void saveTutorialState("complete");
            } else setTutorialStep((current) => current + 1);
          }}
          onPrev={() => setTutorialStep((current) => Math.max(current - 1, 1))}
          onDismiss={() => {
            setIsTutorialOpen(false);
            void saveTutorialState("dismiss");
          }}
          onExit={() => setIsTutorialOpen(false)}
        />
      )}
    </main>
  );
}

function ToolButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={title}
      data-tooltip={title}
      className={`tool-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}
function commentAuthorName(author: QaComment["author"], fallback = "익명") {
  const name =
    author?.display_name?.trim() || author?.email?.split("@")[0] || fallback;
  return /^[가-힣]{3}$/.test(name) ? name.slice(1) : name;
}

function TutorialTour({
  step,
  onStart,
  onNext,
  onPrev,
  onDismiss,
  onExit,
}: {
  step: number;
  onStart: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
  onExit: () => void;
}) {
  const item = tutorialSteps[step] ?? tutorialSteps[0]!;
  const [spotlight, setSpotlight] = useState<TutorialSpotlight | null>(null);

  useEffect(() => {
    if (!item.target) {
      setSpotlight(null);
      return;
    }
    const updateSpotlight = () => {
      const element = document.querySelector(item.target);
      if (!element) {
        setSpotlight(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const padding = 8;
      setSpotlight({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [item.target]);

  const demo = "demo" in item ? item.demo : null;
  const hasCommentDemo = demo === "comment";
  const cardStyle = getTutorialCardStyle(
    spotlight,
    hasCommentDemo
      ? 390
      : demo === "priority"
        ? 370
        : demo === "edit"
          ? 330
          : 270,
  );
  const isWelcome = step === 0;
  const isLastStep = step === tutorialSteps.length - 1;
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      event.preventDefault();
      if (isWelcome) onStart();
      else onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWelcome, onNext, onStart]);
  return (
    <section
      className={`tutorial-tour ${isWelcome ? "tutorial-tour--welcome" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="tutorial-tour__blocker" />
      {spotlight && (
        <div
          className="tutorial-tour__spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}
      <div
        className={`tutorial-tour__card ${isWelcome ? "tutorial-tour__card--welcome" : ""}`}
        style={cardStyle}
      >
        <button
          className="tutorial-tour__close"
          type="button"
          onClick={onExit}
          aria-label="튜토리얼 닫기"
        >
          <X />
        </button>
        <span className="tutorial-tour__eyebrow">KNUD DESIGN QA HUB</span>
        {isWelcome ? (
          <>
            <div className="tutorial-tour__art" aria-hidden="true">
              <img src="/assets/ignite-mark-white.png" alt="" />
            </div>
            <h2 id="tutorial-title">{item.title}</h2>
            <p>{item.description}</p>
            <button
              className="tutorial-tour__primary"
              type="button"
              onClick={onStart}
            >
              시작하기
            </button>
            <button
              className="tutorial-tour__later"
              type="button"
              onClick={onDismiss}
            >
              다시 보지 않기
            </button>
          </>
        ) : (
          <>
            <div
              className="tutorial-tour__progress"
              aria-label={`튜토리얼 ${step} / ${tutorialSteps.length - 1}`}
            >
              {tutorialSteps.slice(1).map((_, index) => (
                <i
                  key={index}
                  className={
                    index < step - 1
                      ? "is-complete"
                      : index === step - 1
                        ? "is-active"
                        : ""
                  }
                />
              ))}
            </div>
            <div className="tutorial-tour__count">
              {step} / {tutorialSteps.length - 1}
            </div>
            <h2 id="tutorial-title">{item.title}</h2>
            <p>{item.description}</p>
            {hasCommentDemo && <TutorialCommentDemo />}
            {demo === "priority" && <TutorialPriorityDemo />}
            {demo === "edit" && <TutorialEditDemo />}
            <footer>
              <button
                className="tutorial-tour__previous"
                type="button"
                disabled={step === 1}
                onClick={onPrev}
              >
                이전
              </button>
              <button
                className="tutorial-tour__primary"
                type="button"
                onClick={onNext}
              >
                {isLastStep ? "완료" : "다음"}
              </button>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}

function TutorialCommentDemo() {
  return (
    <div className="tutorial-comment-demo" aria-label="코멘트 작성 방법 예시">
      <div className="tutorial-comment-demo__canvas" aria-hidden="true">
        <i className="tutorial-comment-demo__selection" />
        <i className="tutorial-comment-demo__cursor">↖</i>
        <span className="tutorial-comment-demo__pin">서윤</span>
        <span className="tutorial-comment-demo__bubble">의견을 남겨요</span>
      </div>
      <div className="tutorial-comment-demo__steps">
        <span>1. 드래그</span>
        <span>2. 표시 확인</span>
        <span>3. 의견 작성</span>
      </div>
    </div>
  );
}

function TutorialPriorityDemo() {
  return (
    <div
      className="tutorial-priority-demo"
      aria-label="우선순위 선택 방법 예시"
    >
      <span>우선순위</span>
      <div className="tutorial-priority-demo__select" aria-hidden="true">
        <i />
        <strong>High</strong>
        <small>⌄</small>
        <div className="tutorial-priority-demo__options">
          <b>Low</b>
          <b>Medium</b>
          <b className="is-selected">High</b>
          <b>Blocker</b>
        </div>
      </div>
      <p>지금 바로 확인이 필요한 의견에는 High를 선택하세요.</p>
    </div>
  );
}

function TutorialEditDemo() {
  return (
    <div className="tutorial-edit-demo" aria-label="내 의견 수정 버튼 예시">
      <span>오른쪽 상세 화면</span>
      <button type="button" tabIndex={-1}>
        <PencilSimple /> 내 의견 수정
      </button>
      <p>작성자 본인의 의견만 수정할 수 있어요.</p>
    </div>
  );
}

function getTutorialCardStyle(
  spotlight: TutorialSpotlight | null,
  cardHeight = 270,
) {
  if (!spotlight || typeof window === "undefined")
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const cardWidth = 360;
  const gap = 24;
  const top =
    spotlight.top + cardHeight + 32 <= window.innerHeight
      ? Math.max(70, spotlight.top)
      : Math.max(48, spotlight.top - cardHeight - gap);
  if (window.innerWidth - (spotlight.left + spotlight.width) > cardWidth + gap)
    return { top, left: spotlight.left + spotlight.width + gap };
  if (spotlight.left > cardWidth + gap)
    return { top, left: spotlight.left - cardWidth - gap };
  if (window.innerHeight - (spotlight.top + spotlight.height) > 260)
    return {
      top: spotlight.top + spotlight.height + gap,
      left: "50%",
      transform: "translateX(-50%)",
    };
  return { bottom: 48, left: "50%", transform: "translateX(-50%)" };
}

function SectionTitle({ label, count }: { label: string; count?: string }) {
  return (
    <div className="section-title">
      <span>{label}</span>
      {count && <small>{count}</small>}
    </div>
  );
}
function PinBadge({
  number,
  tone,
  className = "",
}: {
  number: number;
  tone: string;
  className?: string;
}) {
  return (
    <span className={`pin-badge ${tone} ${className}`}>
      <MapPin weight="fill" /> <b>{number}</b>
    </span>
  );
}

function CommentListItem({
  comment,
  selected,
  onClick,
}: {
  comment: QaComment;
  selected: boolean;
  onClick: () => void;
}) {
  const authorName = commentAuthorName(comment.author);
  return (
    <button
      className={`comment-list-item ${selected ? "selected" : ""}`}
      type="button"
      onClick={onClick}
    >
      <span
        className={`comment-list-item__avatar ${comment.status === "done" ? "is-done" : ""}`}
      >
        {authorName}
      </span>
      <span className="comment-list-item__content">
        <b>{comment.body}</b>
        <small>
          {authorName} · {statusLabel[comment.status]}
        </small>
      </span>
    </button>
  );
}

function Selection({
  draft,
  zoom,
  viewport,
}: {
  draft: Draft;
  zoom: number;
  viewport: { width: number; height: number };
}) {
  const left = Math.min(draft.start.x, draft.end.x);
  const top = Math.min(draft.start.y, draft.end.y);
  const width =
    draft.kind === "pin"
      ? 38
      : Math.max(24, Math.abs(draft.end.x - draft.start.x));
  const height =
    draft.kind === "pin"
      ? 38
      : Math.max(24, Math.abs(draft.end.y - draft.start.y));
  const pinLeft =
    draft.kind === "pin"
      ? Math.max(0, Math.min(viewport.width - width, left - width / 2))
      : left;
  const pinTop =
    draft.kind === "pin"
      ? Math.max(0, Math.min(viewport.height - height, top - height / 2))
      : top;
  return (
    <div
      className="selection"
      style={{
        left: pinLeft * zoom,
        top: pinTop * zoom,
        width: width * zoom,
        height: height * zoom,
      }}
    >
      <i />
      <i />
      <i />
      <i />
      <span>
        {draft.kind === "pin" ? "핀 위치" : "선택 영역"} · {Math.round(width)} ×{" "}
        {Math.round(height)}
      </span>
    </div>
  );
}

function SavedAnnotation({
  comment,
  number,
  zoom,
  viewport,
  onClick,
  onHover,
  onLeave,
}: {
  comment: QaComment;
  number: number;
  zoom: number;
  viewport: { width: number; height: number };
  onClick: () => void;
  onHover: (point: Omit<MarkerPreview, "comment">) => void;
  onLeave: () => void;
}) {
  const anchor = comment.normalized_anchor_json;
  const x = typeof anchor.x === "number" ? anchor.x : 0;
  const y = typeof anchor.y === "number" ? anchor.y : 0;
  const authorName = commentAuthorName(comment.author);
  const markerX = x * viewport.width * zoom;
  const markerY = y * viewport.height * zoom;
  return (
    <button
      className={`saved-pin saved-pin--${comment.status === "done" ? "done" : "open"}`}
      type="button"
      style={{ left: `${markerX}px`, top: `${markerY}px` }}
      onClick={onClick}
      onMouseEnter={() =>
        onHover({
          x: markerX,
          y: markerY,
          side: markerX > viewport.width * zoom - 320 ? "left" : "right",
        })
      }
      onMouseLeave={onLeave}
      aria-label={`${authorName}의 코멘트 ${number} 열기`}
    >
      <span className="saved-pin__avatar">{authorName}</span>
    </button>
  );
}

function MarkerTooltip({ preview }: { preview: MarkerPreview }) {
  const authorName = commentAuthorName(preview.comment.author);
  return (
    <aside
      className={`marker-tooltip marker-tooltip--${preview.side}`}
      style={{ left: preview.x, top: 58 + preview.y }}
    >
      <span className="marker-tooltip__avatar">{authorName}</span>
      <div>
        <div className="marker-tooltip__meta">
          <b>{authorName}</b>
          <time>{relativeTime(preview.comment.created_at)}</time>
        </div>
        <p>{preview.comment.body}</p>
      </div>
    </aside>
  );
}

function SavedAreaPreview({
  comment,
  zoom,
  viewport,
}: {
  comment: QaComment;
  zoom: number;
  viewport: { width: number; height: number };
}) {
  const annotation = comment.annotations.find((item) => item.kind === "rect");
  if (!annotation) return null;
  const geometry = annotation.geometry_json;
  const x = typeof geometry.x === "number" ? geometry.x : 0;
  const y = typeof geometry.y === "number" ? geometry.y : 0;
  const width = typeof geometry.width === "number" ? geometry.width : 0;
  const height = typeof geometry.height === "number" ? geometry.height : 0;
  if (width <= 0 || height <= 0) return null;
  return (
    <div
      className="saved-area-preview"
      style={{
        left: x * viewport.width * zoom,
        top: y * viewport.height * zoom,
        width: width * viewport.width * zoom,
        height: height * viewport.height * zoom,
      }}
    >
      <span>선택 영역</span>
    </div>
  );
}

function CommentComposer({
  message,
  setMessage,
  saveError,
  isSaving,
  draft,
  zoom,
  viewport,
  canvasHeight,
  priority,
  setPriority,
  onCancel,
  onSave,
}: {
  message: string;
  setMessage: (value: string) => void;
  saveError: string | null;
  isSaving: boolean;
  draft: Draft;
  zoom: number;
  viewport: { width: number; height: number };
  canvasHeight: number;
  priority: QaComment["priority"];
  setPriority: (value: QaComment["priority"]) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const left = Math.min(
    viewport.width * zoom - 372,
    Math.max(10, draft.end.x * zoom + 14),
  );
  const top = Math.min(
    canvasHeight - 288,
    Math.max(10, draft.end.y * zoom + 14),
  );
  return (
    <form
      className="comment-composer"
      style={{ left, top }}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <header>
        <span className="avatar yellow">QA</span>
        <strong>여기에 코멘트 남기기</strong>
        <code>{draft.kind === "area" ? "선택 영역" : "핀 위치"}</code>
      </header>
      <textarea
        autoFocus
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="이 위치에 대한 피드백을 입력하세요."
        required
      />
      <div className="composer-actions">
        <label className="select-pill">
          <i />
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as QaComment["priority"])
            }
            aria-label="우선순위"
          >
            {Object.entries(priorityLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span />
        <button type="button" className="cancel" onClick={onCancel}>
          취소
        </button>
        <button className="save" disabled={isSaving}>
          {isSaving ? "저장 중…" : "저장"} <code>⌘↵</code>
        </button>
      </div>
      {saveError && <p className="composer-error">{saveError}</p>}
      <footer>뷰포트 · 경로 · 좌표 · 배포본 자동 저장</footer>
    </form>
  );
}

function CompareOverlay({
  position,
  onChange,
}: {
  position: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="compare-overlay">
      <div className="reference-layer" style={{ width: `${position}%` }}>
        <span>FIGMA 기준</span>
      </div>
      <div className="live-layer">
        <span>LIVE 구현</span>
      </div>
      <input
        aria-label="비교 분할 위치"
        type="range"
        min="40"
        max="90"
        value={position}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function CommentInspector({
  comment,
  isLoading,
  error,
  isTransitioning,
  canEdit,
  isEditing,
  editedBody,
  editedPriority,
  editError,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditedBodyChange,
  onEditedPriorityChange,
  canComplete,
  onTransition,
  onComplete,
}: {
  comment: QaComment | null;
  isLoading: boolean;
  error: string | null;
  isTransitioning: boolean;
  canEdit: boolean;
  isEditing: boolean;
  editedBody: string;
  editedPriority: QaComment["priority"];
  editError: string | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditedBodyChange: (value: string) => void;
  onEditedPriorityChange: (value: QaComment["priority"]) => void;
  canComplete: boolean;
  onTransition: () => void;
  onComplete: () => void;
}) {
  if (isLoading)
    return <div className="inspector-empty">코멘트를 불러오는 중…</div>;
  if (error) return <div className="inspector-empty">{error}</div>;
  if (!comment)
    return (
      <div className="inspector-empty">
        이 경로에는 아직 코멘트가 없습니다.
        <br />핀 또는 영역 도구로 첫 코멘트를 남겨보세요.
      </div>
    );
  const next = nextStatus[comment.status];
  const authorName = commentAuthorName(comment.author, "알 수 없음");
  const query = new URLSearchParams({
    comment: comment.id,
    route: comment.pathname,
    viewport: String(comment.viewport_width),
  });
  return (
    <div className="comment-inspector">
      <section className="thread">
        <div className="thread-meta">
          <PinBadge
            number={1}
            tone={
              comment.status === "done"
                ? "gray"
                : comment.priority === "blocker"
                  ? "red"
                  : "yellow"
            }
          />
          <b className="priority">{priorityLabel[comment.priority]}</b>
          <b className="status">{statusLabel[comment.status]}</b>
        </div>
        <div className="author">
          <span className="avatar yellow">{authorName.slice(0, 2)}</span>
          <strong>{authorName}</strong>
          <time>
            {new Intl.DateTimeFormat("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(comment.created_at))}
          </time>
        </div>
        {isEditing ? (
          <div className="comment-editor">
            <textarea
              value={editedBody}
              onChange={(event) => onEditedBodyChange(event.target.value)}
              aria-label="코멘트 내용 수정"
              autoFocus
            />
            <div className="comment-editor__options">
              <label>
                우선순위
                <select
                  value={editedPriority}
                  onChange={(event) =>
                    onEditedPriorityChange(
                      event.target.value as QaComment["priority"],
                    )
                  }
                >
                  {Object.entries(priorityLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {editError && <p className="comment-editor__error">{editError}</p>}
            <div className="comment-editor__actions">
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={isTransitioning}
              >
                취소
              </button>
              <button
                className="save"
                type="button"
                onClick={onSaveEdit}
                disabled={isTransitioning || !editedBody.trim()}
              >
                {isTransitioning ? "저장 중…" : "수정 저장"}
              </button>
            </div>
          </div>
        ) : (
          <p>{comment.body}</p>
        )}
        {canEdit && !isEditing && (
          <button
            className="comment-edit-button"
            type="button"
            onClick={onStartEdit}
          >
            <PencilSimple /> 내 의견 수정
          </button>
        )}
      </section>
      <section className="reproduction">
        <SectionTitle label="재현 정보" />
        {[
          ["anchor", comment.element_qa_id ?? "선택 좌표"],
          ["뷰포트", `${comment.viewport_width} × ${comment.viewport_height}`],
          ["경로", `${comment.pathname}${comment.query_string}`],
          ["scroll", `${comment.scroll_x}, ${comment.scroll_y}`],
          ["확대", `${Math.round(comment.zoom * 100)}%`],
        ].map(([label, value]) => (
          <p key={label}>
            <span>{label}</span>
            <code>{value}</code>
          </p>
        ))}
        <button
          type="button"
          onClick={() =>
            window.open(`${window.location.origin}/?${query}`, "_blank")
          }
        >
          <ArrowSquareOut /> 이 코멘트 검수 화면 열기
        </button>
      </section>
      {canComplete && (
        <div className="thread-actions">
          {comment.status !== "done" && (
            <button
              className="advance"
              type="button"
              disabled={isTransitioning}
              onClick={onComplete}
            >
              {isTransitioning ? "처리 중…" : "완료 처리"}
            </button>
          )}
          {comment.status === "done" && (
            <button
              className="reopen"
              type="button"
              disabled={isTransitioning}
              onClick={onTransition}
            >
              {isTransitioning ? "처리 중…" : "재오픈"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
