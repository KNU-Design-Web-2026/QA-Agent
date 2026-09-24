"use client";

import {
  ArrowsOutCardinal,
  ArrowSquareOut,
  Bell,
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
import { getCommentNavigation } from "@/lib/comment-navigation";
import {
  getDeploymentLabel,
  getViewerDeploymentOptionLabel,
} from "@/lib/deployment-label";
import { getDeploymentView } from "@/lib/deployment-view";
import { getInitialDeploymentSelection } from "@/lib/initial-deployment-selection";
import { isQaRouteReady, readQaRouteState } from "@/lib/qa-route-bridge";
import {
  getCommentAnchorGeometry,
  getCommentAnchorPosition,
} from "@/lib/comment-anchor";
import { getReviewScreen } from "@/lib/review-screen";
import { shouldShowScreenLoading } from "@/lib/screen-loading";
import { getVisibleVersionComments } from "@/lib/version-comments";

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
  deployment_id: string;
  review_deployment_id: string | null;
  reviewDeployment: {
    id: string;
    immutable_url: string;
    git_sha: string;
    deployed_at: string | null;
  } | null;
  annotations: Array<{
    id: string;
    kind: string;
    geometry_json: Record<string, unknown>;
  }>;
  events: Array<{
    id: string;
    kind: string;
    from_status: QaStatus | null;
    to_status: QaStatus | null;
    payload_json: { note?: string };
    created_at: string;
    actor: { display_name: string | null; email: string } | null;
  }>;
  reviewers: Array<{ display_name: string | null; email: string }>;
};
type QaNotification = {
  id: string;
  kind: "comment_created" | "review_requested" | "reopened" | "confirmed";
  read_at: string | null;
  created_at: string;
  comment: {
    id: string;
    body: string;
    pathname: string;
    viewport_width: number;
    viewport_height: number;
    deployment_id: string;
    review_deployment_id: string | null;
    author: QaComment["author"];
  };
  reviewDeployment: QaComment["reviewDeployment"];
};
type Reviewer = { id: string; displayName: string };
type DeploymentInfo = {
  id: string;
  immutable_url: string;
  production_alias: string | null;
  git_sha: string;
  git_ref: string | null;
  version_name: string | null;
  change_summary: string | null;
  provider_deployment_id: string;
  deployed_at: string | null;
  created_at: string;
};
type MarkerPreview = {
  comment: QaComment;
  x: number;
  y: number;
  placement: "left" | "right" | "top" | "bottom";
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
  const [allComments, setAllComments] = useState<QaComment[]>([]);
  const [isQaListOpen, setIsQaListOpen] = useState(false);
  const [isLoadingAllComments, setIsLoadingAllComments] = useState(false);
  const [isLoadingAuthoredComments, setIsLoadingAuthoredComments] =
    useState(false);
  const [qaListStatus, setQaListStatus] = useState<"all" | QaStatus>("all");
  const [notifications, setNotifications] = useState<QaNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isManagementMenuOpen, setIsManagementMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [reviewerTarget, setReviewerTarget] = useState("none");
  const [reviewTargetDeploymentId, setReviewTargetDeploymentId] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null,
  );
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [editedPriority, setEditedPriority] =
    useState<QaComment["priority"]>("medium");
  const [editError, setEditError] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("deployment");
  });
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(
    null,
  );
  const [adminDeploymentNotice, setAdminDeploymentNotice] =
    useState<DeploymentInfo | null>(null);
  const [reviewCommentId, setReviewCommentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("review");
  });
  const [reviewComment, setReviewComment] = useState<QaComment | null>(null);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [isRegisteringDeployment, setIsRegisteringDeployment] = useState(false);
  const [isDeploymentEditModalOpen, setIsDeploymentEditModalOpen] =
    useState(false);
  const [isUpdatingDeployment, setIsUpdatingDeployment] = useState(false);
  const [deploymentEditForm, setDeploymentEditForm] = useState({
    versionName: "",
    changeSummary: "",
  });
  const [deploymentForm, setDeploymentForm] = useState({
    immutableUrl: "",
    providerDeploymentId: "",
    gitSha: "",
    gitRef: "main",
    versionName: "",
    changeSummary: "",
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
  const [iframeScroll, setIframeScroll] = useState<Point>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef<Draft | null>(null);
  const pendingIframeScrollRef = useRef<(Point & { pathname: string }) | null>(
    null,
  );
  const previousActiveDeploymentIdRef = useRef<string | null | undefined>(
    undefined,
  );
  const commentsRequestIdRef = useRef(0);
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
  const activeDeployment =
    deployments.find((item) => item.id === activeDeploymentId) ?? null;
  const deploymentView = getDeploymentView(
    selectedDeploymentId,
    activeDeploymentId,
  );
  const isPastDeployment = deploymentView === "past";
  const actualUrl = selectedDeployment?.immutable_url ?? fallbackDeploymentUrl;
  const isCommentMode = tool === "pin" || tool === "area" || commentOpen;
  const displayComments =
    reviewComment && !comments.some((comment) => comment.id === reviewComment.id)
      ? [reviewComment, ...comments]
      : comments;
  const selectedComment =
    displayComments.find((comment) => comment.id === selectedCommentId) ??
    displayComments[0] ??
    null;
  const reviewContextComment =
    reviewComment?.review_deployment_id
      ? reviewComment
      : selectedComment?.review_deployment_id
        ? selectedComment
        : null;
  const reviewScreen = getReviewScreen(
    reviewContextComment?.deployment_id ?? null,
    reviewContextComment?.review_deployment_id ?? null,
    selectedDeploymentId,
  );
  const versionComments = getVisibleVersionComments(allComments);
  const isScreenLoading = shouldShowScreenLoading(isSwitchingVersion);
  const shouldShowVersionUpdate =
    accessSession?.role !== "admin" &&
    Boolean(activeDeployment) &&
    Boolean(selectedDeployment) &&
    isPastDeployment;

  useEffect(() => {
    const deploymentOrigin = new URL(actualUrl).origin;
    const subscribe = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "knud.qa/subscribe-route", version: 1 },
        deploymentOrigin,
      );
    };
    const handleRouteState = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (isQaRouteReady(event.data, event.origin, deploymentOrigin)) {
        subscribe();
        return;
      }
      const routeState = readQaRouteState(
        event.data,
        event.origin,
        deploymentOrigin,
      );
      if (!routeState) return;
      setRoute((current) =>
        current === routeState.pathname ? current : routeState.pathname,
      );
      setIframeScroll({ x: routeState.scrollX, y: routeState.scrollY });

      const pending = pendingIframeScrollRef.current;
      if (pending?.pathname === routeState.pathname) {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "knud.qa/scroll-to",
            version: 1,
            scrollX: pending.x,
            scrollY: pending.y,
          },
          deploymentOrigin,
        );
        pendingIframeScrollRef.current = null;
      }
    };

    window.addEventListener("message", handleRouteState);
    return () => window.removeEventListener("message", handleRouteState);
  }, [actualUrl]);

  const subscribeToIframeRoute = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage(
      { type: "knud.qa/subscribe-route", version: 1 },
      new URL(actualUrl).origin,
    );
  };

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
      const nextActiveDeploymentId = result.activeDeploymentId ?? null;
      const previousActiveDeploymentId =
        previousActiveDeploymentIdRef.current;
      const nextActiveDeployment = nextDeployments.find(
        (deployment: DeploymentInfo) => deployment.id === nextActiveDeploymentId,
      );
      setDeployments(nextDeployments);
      setActiveDeploymentId(nextActiveDeploymentId);
      previousActiveDeploymentIdRef.current = nextActiveDeploymentId;

      if (accessSession?.role === "admin") {
        const requestedDeploymentId = new URLSearchParams(
          window.location.search,
        ).get("deployment");
        setSelectedDeploymentId(
          getInitialDeploymentSelection({
            requestedDeploymentId,
            activeDeploymentId: nextActiveDeploymentId,
            availableDeploymentIds: nextDeployments.map(
              (deployment: DeploymentInfo) => deployment.id,
            ),
          }),
        );
        if (
          previousActiveDeploymentId !== undefined &&
          previousActiveDeploymentId !== nextActiveDeploymentId &&
          nextActiveDeployment
        ) {
          setAdminDeploymentNotice(nextActiveDeployment);
        }
      } else {
        setSelectedDeploymentId((current) =>
          nextDeployments.some(
            (deployment: DeploymentInfo) => deployment.id === current,
          )
            ? current
            : (nextActiveDeploymentId ?? nextDeployments[0]?.id ?? null),
        );
      }
    } catch (error) {
      setDeploymentsError(
        error instanceof Error
          ? error.message
          : "배포 버전 목록을 불러오지 못했습니다.",
      );
      setDeployments([]);
      setSelectedDeploymentId(null);
      setActiveDeploymentId(null);
    }
  }, [accessSession?.role, projectSlug]);

  const loadComments = useCallback(async () => {
    const requestId = ++commentsRequestIdRef.current;
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
      if (requestId !== commentsRequestIdRef.current) return;
      const activeComments = (result.comments ?? []).filter(
        (comment: QaComment) => comment.status !== "done",
      );
      setComments(activeComments);
      setSelectedCommentId((current) =>
        activeComments.some((comment: QaComment) => comment.id === current)
          ? current
          : (activeComments[0]?.id ?? null),
      );
    } catch (error) {
      if (requestId !== commentsRequestIdRef.current) return;
      setCommentsError(
        error instanceof Error
          ? error.message
          : "코멘트 목록을 불러오지 못했습니다.",
      );
      setComments([]);
      setSelectedCommentId(null);
    } finally {
      if (requestId === commentsRequestIdRef.current) {
        setIsLoadingComments(false);
      }
    }
  }, [actualUrl, projectSlug, route, selectedDeployment]);

  const loadAuthoredComments = useCallback(async () => {
    if (!selectedDeployment) {
      setAuthoredComments([]);
      setIsLoadingAuthoredComments(false);
      return;
    }
    setIsLoadingAuthoredComments(true);
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
      setAuthoredComments(
        (result.comments ?? []).filter(
          (comment: QaComment) => comment.status !== "done",
        ),
      );
    } catch {
      setAuthoredComments([]);
    } finally {
      setIsLoadingAuthoredComments(false);
    }
  }, [actualUrl, projectSlug, selectedDeployment]);

  const loadReviewComment = useCallback(async () => {
    if (!reviewCommentId || !selectedDeployment) {
      setReviewComment(null);
      return;
    }
    try {
      const params = new URLSearchParams({
        projectSlug,
        deploymentUrl: actualUrl,
        scope: "review",
        commentId: reviewCommentId,
      });
      const response = await fetch(`/api/comments?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error();
      const comment = result.comments?.[0] as QaComment | undefined;
      setReviewComment(
        comment &&
          (comment.review_deployment_id === selectedDeployment.id ||
            comment.deployment_id === selectedDeployment.id)
          ? comment
          : null,
      );
    } catch {
      setReviewComment(null);
    }
  }, [actualUrl, projectSlug, reviewCommentId, selectedDeployment]);

  const loadAllComments = useCallback(async () => {
    if (!selectedDeployment) {
      setAllComments([]);
      return;
    }
    setIsLoadingAllComments(true);
    try {
      const params = new URLSearchParams({
        projectSlug,
        deploymentUrl: actualUrl,
        scope: "all",
      });
      const response = await fetch(`/api/comments?${params}`);
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "QA 목록을 불러오지 못했습니다.");
      setAllComments(
        (result.comments ?? []).filter(
          (comment: QaComment) => comment.status !== "done",
        ),
      );
    } catch {
      setAllComments([]);
    } finally {
      setIsLoadingAllComments(false);
    }
  }, [actualUrl, projectSlug, selectedDeployment]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "알림을 불러오지 못했습니다.");
      setNotifications(result.notifications ?? []);
      setUnreadNotificationCount(result.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setUnreadNotificationCount(0);
    }
  }, []);

  const loadReviewers = useCallback(async () => {
    if (accessSession?.role !== "admin") {
      setReviewers([]);
      return;
    }
    try {
      const response = await fetch(`/api/reviewers?${new URLSearchParams({ projectSlug })}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "디자이너 목록을 불러오지 못했습니다.");
      setReviewers(result.reviewers ?? []);
    } catch {
      setReviewers([]);
    }
  }, [accessSession?.role, projectSlug]);

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
    const timer = window.setInterval(() => void loadDeployments(), 30_000);
    return () => window.clearInterval(timer);
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
    if (isSwitchingVersion && !isLoadingComments) {
      setIsSwitchingVersion(false);
    }
  }, [isLoadingComments, isSwitchingVersion]);
  useEffect(() => {
    void loadReviewComment();
  }, [loadReviewComment]);
  useEffect(() => {
    void loadAuthoredComments();
  }, [loadAuthoredComments]);
  useEffect(() => {
    void loadAllComments();
  }, [loadAllComments]);
  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);
  useEffect(() => {
    void loadReviewers();
  }, [loadReviewers]);
  useEffect(() => {
    if (activeDeploymentId) setReviewTargetDeploymentId(activeDeploymentId);
  }, [activeDeploymentId]);

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
  const deploymentLabel = selectedDeployment
    ? getDeploymentLabel(selectedDeployment)
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
          scrollX: iframeScroll.x,
          scrollY: iframeScroll.y,
          zoom,
          kind: draft.kind,
          anchor: normalizedAnchor,
          type: "visual",
          priority,
          reviewerIds:
            accessSession?.role === "admin"
              ? reviewerTarget === "all"
                ? reviewers.map((reviewer) => reviewer.id)
                : reviewerTarget === "none"
                  ? []
                  : [reviewerTarget]
              : [],
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "코멘트를 저장하지 못했습니다.");
      setMessage("");
      setReviewerTarget("none");
      setCommentOpen(false);
      setTool("browse");
      setDraft(null);
      draftRef.current = null;
      await loadComments();
      await loadAuthoredComments();
      await loadNotifications();
      if (isQaListOpen) await loadAllComments();
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
        versionName: "",
        changeSummary: "",
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
    commentsRequestIdRef.current += 1;
    setIsSwitchingVersion(true);
    setIsLoadingComments(true);
    try {
      const response = await fetch("/api/deployments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", projectSlug, deploymentId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "QA 기준 버전을 변경하지 못했습니다.");
      setSelectedDeploymentId(result.activeDeploymentId);
    } catch (error) {
      setIsSwitchingVersion(false);
      setIsLoadingComments(false);
      setDeploymentsError(
        error instanceof Error
          ? error.message
          : "QA 기준 버전을 변경하지 못했습니다.",
      );
    }
  }

  function openDeploymentEdit() {
    if (!selectedDeployment) return;
    setDeploymentsError(null);
    setDeploymentEditForm({
      versionName: selectedDeployment.version_name ?? selectedDeployment.git_sha.slice(0, 7),
      changeSummary: selectedDeployment.change_summary ?? "",
    });
    setIsManagementMenuOpen(false);
    setIsDeploymentEditModalOpen(true);
  }

  async function updateDeploymentDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDeployment) return;
    setIsUpdatingDeployment(true);
    setDeploymentsError(null);
    try {
      const response = await fetch("/api/deployments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          projectSlug,
          deploymentId: selectedDeployment.id,
          ...deploymentEditForm,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "버전 이름을 수정하지 못했습니다.");
      await loadDeployments();
      setIsDeploymentEditModalOpen(false);
    } catch (error) {
      setDeploymentsError(
        error instanceof Error ? error.message : "버전 이름을 수정하지 못했습니다.",
      );
    } finally {
      setIsUpdatingDeployment(false);
    }
  }

  function selectDeploymentForViewing(deploymentId: string) {
    if (deploymentId === selectedDeploymentId) return;
    commentsRequestIdRef.current += 1;
    setIsSwitchingVersion(true);
    setIsLoadingComments(true);
    setSelectedDeploymentId(deploymentId);
    setSelectedCommentId(null);

    const query = new URLSearchParams(window.location.search);
    if (deploymentId === activeDeploymentId) {
      query.delete("deployment");
    } else {
      query.set("deployment", deploymentId);
    }
    const search = query.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }

  async function updateCommentStatus(
    nextStatus: QaStatus,
    note?: string,
    reviewDeploymentId?: string,
  ) {
    if (!selectedComment) return;
    setIsTransitioning(true);
    try {
      const response = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commentId: selectedComment.id,
          nextStatus,
          note,
          reviewDeploymentId,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "상태를 변경하지 못했습니다.");
      await loadComments();
      await loadAuthoredComments();
      await loadNotifications();
      if (isQaListOpen) await loadAllComments();
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
      await loadNotifications();
      if (isQaListOpen) await loadAllComments();
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

  async function deleteComment() {
    if (!selectedComment) return;
    setIsTransitioning(true);
    setEditError(null);
    try {
      const response = await fetch("/api/comments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", commentId: selectedComment.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "코멘트를 삭제하지 못했습니다.");
      setSelectedCommentId(null);
      setIsEditingComment(false);
      await loadComments();
      await loadAuthoredComments();
      if (isQaListOpen) await loadAllComments();
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "코멘트를 삭제하지 못했습니다.",
      );
    } finally {
      setIsTransitioning(false);
    }
  }

  const openComment = (comment: QaComment) => {
    const navigation = getCommentNavigation(
      comment,
      viewports.map((viewport) => viewport.width),
    );
    if (comment.deployment_id !== selectedDeploymentId) {
      selectDeploymentForViewing(comment.deployment_id);
    }
    setRoute(navigation.pathname);
    pendingIframeScrollRef.current = {
      pathname: navigation.pathname,
      x: comment.scroll_x,
      y: comment.scroll_y,
    };
    if (navigation.viewportIndex !== -1) {
      setSelectedViewport(navigation.viewportIndex);
    }
    setSelectedCommentId(comment.id);
    setIsEditingComment(false);
  };

  const openQaList = () => {
    setIsQaListOpen(true);
    void loadAllComments();
  };

  const markNotificationsRead = async (notificationId?: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(notificationId ? { action: "read", notificationId } : { action: "read_all" }),
      });
      if (notificationId) {
        setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification));
        setUnreadNotificationCount((current) => Math.max(0, current - 1));
      } else {
        setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at ?? new Date().toISOString() })));
        setUnreadNotificationCount(0);
      }
    } catch {
      // Opening the referenced QA screen remains available even if a read receipt is delayed.
    }
  };

  const openNotification = (notification: QaNotification) => {
    const viewportIndex = viewports.findIndex((viewport) => viewport.width === notification.comment.viewport_width);
    const shouldOpenUpdatedScreen =
      notification.kind === "review_requested" &&
      Boolean(notification.reviewDeployment);
    selectDeploymentForViewing(
      shouldOpenUpdatedScreen
        ? notification.reviewDeployment!.id
        : notification.comment.deployment_id,
    );
    setReviewCommentId(
      shouldOpenUpdatedScreen ? notification.comment.id : null,
    );
    setRoute(notification.comment.pathname);
    if (viewportIndex !== -1) setSelectedViewport(viewportIndex);
    setSelectedCommentId(notification.comment.id);
    setIsNotificationOpen(false);
    void markNotificationsRead(notification.id);
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
                    {getDeploymentLabel(item)} · {item.git_sha.slice(0, 7)} ·{" "}
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
            <label className="deploy-select deploy-select--viewer">
              <i />
              <span>검수 화면</span>
              <select
                value={selectedDeploymentId ?? ""}
                onChange={(event) => selectDeploymentForViewing(event.target.value)}
                aria-label="검수 화면 선택"
              >
                <option value="">검수 화면 선택</option>
                {deployments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getViewerDeploymentOptionLabel(
                      item,
                      item.id === activeDeploymentId,
                    )}
                  </option>
                ))}
              </select>
              <small>{deployedLabel}</small>
            </label>
          )}
        </div>
        <div className="toolbar-actions">
          <div className="toolbar-menu">
            <button
              className="toolbar-menu__trigger"
              type="button"
              aria-expanded={isManagementMenuOpen}
              onClick={() => {
                setIsManagementMenuOpen((current) => !current);
                setIsNotificationOpen(false);
                setIsProfileMenuOpen(false);
              }}
            >
              검수 관리 <CaretDown />
            </button>
            {isManagementMenuOpen && (
              <div className="toolbar-menu__popover">
                <button type="button" onClick={() => { setIsManagementMenuOpen(false); openQaList(); }}>
                  <span>이 버전 의견</span>
                  <small>현재 검수 중인 버전</small>
                </button>
                <button type="button" onClick={() => window.location.assign("/history")}>
                  <span>전체 QA 기록</span>
                  <small>모든 버전의 검수 이력</small>
                </button>
                {accessSession?.role === "admin" && (
                  <>
                    <button type="button" onClick={openDeploymentEdit} disabled={!selectedDeployment}>
                      <span>현재 버전 이름 수정</span>
                      <small>이름과 변경 요약 편집</small>
                    </button>
                    <button type="button" onClick={() => { setIsManagementMenuOpen(false); setIsDeploymentModalOpen(true); }}>
                      <span>최신 버전 등록</span>
                      <small>등록 후 바로 검수 기준 전환</small>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="notification-menu">
            <button
              className="notification-button"
              type="button"
              aria-label={`알림${unreadNotificationCount ? ` ${unreadNotificationCount}개` : ""}`}
              aria-expanded={isNotificationOpen}
              onClick={() => {
                setIsNotificationOpen((current) => !current);
                setIsManagementMenuOpen(false);
                setIsProfileMenuOpen(false);
                void loadNotifications();
              }}
            >
              <Bell />
              {unreadNotificationCount > 0 && <b>{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</b>}
            </button>
            {isNotificationOpen && (
              <NotificationPopover
                notifications={notifications}
                onOpen={openNotification}
                onReadAll={() => void markNotificationsRead()}
              />
            )}
          </div>
          <div className="profile-menu">
            <button
              className="user-profile"
              type="button"
              title={accessSession?.email}
              aria-expanded={isProfileMenuOpen}
              onClick={() => {
                setIsProfileMenuOpen((current) => !current);
                setIsManagementMenuOpen(false);
                setIsNotificationOpen(false);
              }}
            >
              <b>{accessSession?.displayName ?? "사용자"}</b>
              <CaretDown />
            </button>
            {isProfileMenuOpen && (
              <div className="profile-menu__popover">
                <span>{accessSession?.email}</span>
                <button type="button" onClick={() => { setIsProfileMenuOpen(false); openTutorial(); }}>사용 가이드 다시보기</button>
                <button type="button" onClick={() => void signOut()} disabled={isSigningOut}>
                  <SignOut /> {isSigningOut ? "나가는 중" : "로그아웃"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {shouldShowVersionUpdate && activeDeployment && selectedDeployment && (
        <div className="qa-version-update qa-version-update--past" role="status">
          <div>
            <strong>과거 검수 버전을 보고 있어요</strong>
            <span>
              보고 있는 버전 <code>{getDeploymentLabel(selectedDeployment)}</code>
              <i>·</i>
              현재 기준 <code>{getDeploymentLabel(activeDeployment)}</code>
            </span>
          </div>
          <div className="qa-version-update__actions">
            <button
              className="go"
              type="button"
              onClick={() => {
                selectDeploymentForViewing(activeDeployment.id);
              }}
            >
              현재 검수 버전으로 돌아가기
            </button>
          </div>
        </div>
      )}
      {accessSession?.role === "admin" && adminDeploymentNotice && (
        <div className="qa-version-update qa-version-update--admin" role="status">
          <div>
            <strong>최신 검수 버전으로 전환했어요</strong>
            <span>
              {getDeploymentLabel(adminDeploymentNotice)} · SHA{" "}
              <code>{adminDeploymentNotice.git_sha.slice(0, 7)}</code>
            </span>
          </div>
          <div className="qa-version-update__actions">
            <button
              className="later"
              type="button"
              onClick={() => setAdminDeploymentNotice(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
      {reviewScreen === "updated" && reviewContextComment && (
        <div className="qa-review-screen-banner" role="status">
          <div>
            <strong>수정된 화면을 확인 중이에요</strong>
            <span>남긴 의견이 원하는 방향으로 반영되었는지 확인해 주세요.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              selectDeploymentForViewing(reviewContextComment.deployment_id);
              setSelectedCommentId(reviewContextComment.id);
            }}
          >
            이전 화면 보기
          </button>
        </div>
      )}
      {reviewScreen === "original" && reviewContextComment && (
        <div className="qa-review-screen-banner qa-review-screen-banner--original" role="status">
          <div>
            <strong>처음 의견을 남긴 화면이에요</strong>
            <span>수정된 화면과 비교해 보고 싶다면 다시 이동할 수 있어요.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!reviewContextComment.review_deployment_id) return;
              setReviewCommentId(reviewContextComment.id);
              selectDeploymentForViewing(reviewContextComment.review_deployment_id);
              setSelectedCommentId(reviewContextComment.id);
            }}
          >
            수정된 화면 보기
          </button>
        </div>
      )}
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
            <h2>최신 배포 버전 등록</h2>
            <p>
              개발자가 이해할 버전 이름과 변경 요약을 먼저 적고, Vercel 배포
              정보를 연결하세요. 등록하면 이 버전이 바로 팀의 최신 검수 기준이 됩니다.
            </p>
            <label>
              버전 이름
              <input
                value={deploymentForm.versionName}
                onChange={(event) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    versionName: event.target.value,
                  })
                }
                placeholder="예: 모바일 메인 화면 수정"
                maxLength={80}
                required
                autoFocus
              />
            </label>
            <label>
              변경 요약 <small>(선택)</small>
              <textarea
                value={deploymentForm.changeSummary}
                onChange={(event) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    changeSummary: event.target.value,
                  })
                }
                placeholder="예: 헤더 여백과 작품 이미지 크기를 조정했습니다."
                maxLength={500}
                rows={3}
              />
            </label>
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
                {isRegisteringDeployment ? "등록 중…" : "등록하고 검수 시작"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {isDeploymentEditModalOpen && selectedDeployment && (
        <div className="tool-modal-backdrop">
          <form className="deployment-modal" onSubmit={updateDeploymentDetails}>
            <span className="tool-notice__eyebrow">DEPLOYMENT RECORD</span>
            <h2>현재 버전 정보 수정</h2>
            <p>
              코멘트와 배포 주소는 그대로 두고, 팀에서 구분하기 쉬운 버전 이름과
              변경 요약만 수정합니다.
            </p>
            <label>
              버전 이름
              <input
                value={deploymentEditForm.versionName}
                onChange={(event) =>
                  setDeploymentEditForm({
                    ...deploymentEditForm,
                    versionName: event.target.value,
                  })
                }
                maxLength={80}
                required
                autoFocus
              />
            </label>
            <label>
              변경 요약 <small>(선택)</small>
              <textarea
                value={deploymentEditForm.changeSummary}
                onChange={(event) =>
                  setDeploymentEditForm({
                    ...deploymentEditForm,
                    changeSummary: event.target.value,
                  })
                }
                maxLength={500}
                rows={3}
              />
            </label>
            {deploymentsError && (
              <div className="deployment-modal__error">{deploymentsError}</div>
            )}
            <footer>
              <button
                type="button"
                className="cancel"
                onClick={() => setIsDeploymentEditModalOpen(false)}
              >
                취소
              </button>
              <button type="submit" className="save" disabled={isUpdatingDeployment}>
                {isUpdatingDeployment ? "저장 중…" : "버전 정보 저장"}
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
              <b>{displayComments.length}</b>
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
          <SectionTitle label="현재 페이지" count={String(displayComments.length)} />
          <div className="comment-list" data-tutorial="qa-comment-list" role="region" aria-label="현재 페이지 코멘트 목록" tabIndex={0}>
            {isLoadingComments ? <CommentListSkeleton /> : displayComments.map((comment) => (
              <CommentListItem
                key={comment.id}
                comment={comment}
                selected={selectedComment?.id === comment.id}
                onClick={() => openComment(comment)}
              />
            ))}
            {!isLoadingComments && !displayComments.length && (
              <p className="empty-comments">
                이 경로에는 아직 코멘트가 없습니다.
              </p>
            )}
          </div>
          <div className="panel-rule" />
          <SectionTitle
            label="이 버전의 코멘트"
            count={String(versionComments.length)}
          />
          <div className="comment-list comment-list--version" data-tutorial="qa-version-comments" role="region" aria-label="이 버전의 코멘트 목록" tabIndex={0}>
            {isLoadingAllComments ? <CommentListSkeleton /> : versionComments.map((comment) => (
              <CommentListItem
                key={comment.id}
                comment={comment}
                selected={selectedComment?.id === comment.id}
                onClick={() => openComment(comment)}
              />
            ))}
            {!isLoadingAllComments && !versionComments.length && (
              <p className="empty-comments">
                이 버전에는 아직 코멘트가 없습니다.
              </p>
            )}
          </div>
          <div className="panel-rule" />
          <SectionTitle
            label="내 코멘트"
            count={String(authoredComments.length)}
          />
          <div className="comment-list" data-tutorial="qa-my-comments" role="region" aria-label="내 코멘트 목록" tabIndex={0}>
            {isLoadingAuthoredComments ? <CommentListSkeleton rows={2} /> : authoredComments.map((comment) => (
              <CommentListItem
                key={comment.id}
                comment={comment}
                selected={selectedComment?.id === comment.id}
                onClick={() => openComment(comment)}
              />
            ))}
            {!isLoadingAuthoredComments && !authoredComments.length && (
              <p className="empty-comments">
                이 버전에서 작성한 코멘트가 없습니다.
              </p>
            )}
          </div>
        </aside>

        <section className="qa-canvas">
          {isScreenLoading && <ScreenLoadingOverlay />}
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
                  <code>{scaleLabel}</code> · scrollY {Math.round(iframeScroll.y)}
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
                      ref={iframeRef}
                      title="KNUD production deployment"
                      src={`${actualUrl}${route}`}
                      onLoad={subscribeToIframeRoute}
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
                      currentScroll={iframeScroll}
                    />
                  )}
                  {markersVisible &&
                    displayComments.map((comment, index) => (
                      <SavedAnnotation
                        key={comment.id}
                        comment={comment}
                        number={index + 1}
                        zoom={zoom}
                        viewport={currentViewport}
                        currentScroll={iframeScroll}
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
                      deploymentSha={deploymentLabel}
                      priority={priority}
                      setPriority={setPriority}
                      showReviewerTarget={accessSession?.role === "admin"}
                      reviewerTarget={reviewerTarget}
                      reviewers={reviewers}
                      onReviewerTargetChange={setReviewerTarget}
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
            onDelete={() => void deleteComment()}
            onEditedBodyChange={setEditedBody}
            onEditedPriorityChange={setEditedPriority}
            canRequestReview={
              accessSession?.role === "admin" ||
              accessSession?.role === "developer"
            }
            reviewDeployments={deployments}
            reviewTargetDeploymentId={reviewTargetDeploymentId}
            onReviewTargetDeploymentChange={setReviewTargetDeploymentId}
            canConfirm={Boolean(
              accessSession?.role === "admin" ||
              (Boolean(accessSession?.email) &&
                (selectedComment?.author?.email.toLowerCase() ===
                  accessSession?.email.toLowerCase() ||
                  selectedComment?.reviewers.some(
                    (reviewer) =>
                      reviewer.email.toLowerCase() ===
                      accessSession?.email.toLowerCase(),
                  ))),
            )}
            onStartWork={() => void updateCommentStatus("in_progress")}
            onRequestReview={() =>
              void updateCommentStatus(
                "review_requested",
                undefined,
                reviewTargetDeploymentId,
              )
            }
            onOpenUpdatedScreen={() => {
              if (!selectedComment?.review_deployment_id) return;
              setReviewCommentId(selectedComment.id);
              selectDeploymentForViewing(selectedComment.review_deployment_id);
              setSelectedCommentId(selectedComment.id);
            }}
            onConfirm={() => void updateCommentStatus("done")}
            onReopen={(note) =>
              void updateCommentStatus(
                selectedComment?.status === "done" ? "open" : "in_progress",
                note,
              )
            }
          />
        </aside>
      </section>
      {isQaListOpen && (
        <QaListDrawer
          comments={allComments}
          isLoading={isLoadingAllComments}
          status={qaListStatus}
          onStatusChange={setQaListStatus}
          onClose={() => setIsQaListOpen(false)}
          onSelect={(comment) => {
            setIsQaListOpen(false);
            openComment(comment);
          }}
        />
      )}
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

function getAreaGeometry(
  comment: QaComment,
  viewport: { width: number; height: number },
  zoom: number,
  currentScroll: Point,
) {
  const annotation = comment.annotations.find((item) => item.kind === "rect");
  if (!annotation) return null;
  const geometry = getCommentAnchorGeometry({
    anchor: annotation.geometry_json,
    viewport,
    savedScroll: { x: comment.scroll_x, y: comment.scroll_y },
    currentScroll,
  });
  if (!geometry) return null;
  return {
    x: geometry.x * zoom,
    y: geometry.y * zoom,
    width: geometry.width * zoom,
    height: geometry.height * zoom,
  };
}

const notificationCopy: Record<QaNotification["kind"], string> = {
  comment_created: "새 의견이 남겨졌어요",
  review_requested: "수정이 반영되었어요. 확인해 주세요",
  reopened: "다시 수정이 필요해요",
  confirmed: "디자이너가 최종 확인을 완료했어요",
};

function NotificationPopover({
  notifications,
  onOpen,
  onReadAll,
}: {
  notifications: QaNotification[];
  onOpen: (notification: QaNotification) => void;
  onReadAll: () => void;
}) {
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  return (
    <div className="notification-popover" role="dialog" aria-label="알림 목록">
      <header>
        <div>
          <strong>알림</strong>
          <span>읽지 않음 {unreadCount}</span>
        </div>
        {unreadCount > 0 && <button type="button" onClick={onReadAll}>모두 읽음</button>}
      </header>
      <div className="notification-popover__list">
        {notifications.length === 0 ? (
          <p>새로운 알림이 없습니다.</p>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              className={!notification.read_at ? "is-unread" : ""}
              type="button"
              onClick={() => onOpen(notification)}
            >
              <span className={`notification-kind notification-kind--${notification.kind}`} />
              <span>
                <b>{notificationCopy[notification.kind]}</b>
                <strong>{notification.comment.body}</strong>
                <small>
                  {commentAuthorName(notification.comment.author)} · {notification.comment.pathname} · {notification.comment.viewport_width} × {notification.comment.viewport_height} · {relativeTime(notification.created_at)}
                </small>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
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
          {authorName} <i>·</i>{" "}
          <strong className={`comment-list-item__status is-${comment.status}`}>
            {statusLabel[comment.status]}
          </strong>
        </small>
      </span>
    </button>
  );
}

function CommentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="comment-list-skeleton" aria-label="코멘트 목록을 불러오는 중" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div className="comment-list-skeleton__row" key={index}>
          <span className="comment-list-skeleton__avatar" />
          <span className="comment-list-skeleton__content">
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  );
}

function ScreenLoadingOverlay() {
  return (
    <div className="screen-loading-overlay" role="status" aria-live="polite">
      <span className="screen-loading-overlay__spinner" aria-hidden="true" />
      <strong>검수 화면을 불러오는 중이에요</strong>
      <p>선택한 화면과 의견을 준비하고 있어요.</p>
    </div>
  );
}

function QaListDrawer({
  comments,
  isLoading,
  status,
  onStatusChange,
  onClose,
  onSelect,
}: {
  comments: QaComment[];
  isLoading: boolean;
  status: "all" | QaStatus;
  onStatusChange: (status: "all" | QaStatus) => void;
  onClose: () => void;
  onSelect: (comment: QaComment) => void;
}) {
  const visibleComments =
    status === "all"
      ? comments
      : comments.filter((comment) => comment.status === status);
  const filters: Array<{ value: "all" | QaStatus; label: string }> = [
    { value: "all", label: "전체" },
    { value: "open", label: "열림" },
    { value: "in_progress", label: "진행 중" },
    { value: "review_requested", label: "검토 요청" },
    { value: "done", label: "완료" },
  ];

  return (
    <div
      className="qa-list-drawer-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="qa-list-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="이 버전의 QA 목록"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="qa-list-drawer__header">
          <div>
            <span>이 버전의 전체 의견</span>
            <strong>QA 목록</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="QA 목록 닫기">
            <X />
          </button>
        </header>
        <div className="qa-list-drawer__summary">
          <span>
            전체 <b>{comments.length}</b>
          </span>
          <span>
            미완료 <b>{comments.filter((comment) => comment.status !== "done").length}</b>
          </span>
        </div>
        <div className="qa-list-drawer__filters" aria-label="상태별 보기">
          {filters.map((filter) => (
            <button
              key={filter.value}
              className={status === filter.value ? "is-selected" : ""}
              type="button"
              onClick={() => onStatusChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="qa-list-drawer__items">
          {isLoading ? (
            <p className="qa-list-drawer__empty">QA 목록을 불러오는 중입니다.</p>
          ) : visibleComments.length === 0 ? (
            <p className="qa-list-drawer__empty">
              {status === "all"
                ? "아직 남겨진 의견이 없습니다."
                : "이 상태의 의견이 없습니다."}
            </p>
          ) : (
            visibleComments.map((comment) => {
              const authorName = commentAuthorName(comment.author);
              return (
                <button
                  key={comment.id}
                  className="qa-list-drawer__item"
                  type="button"
                  onClick={() => onSelect(comment)}
                >
                  <span
                    className={`qa-list-drawer__priority qa-list-drawer__priority--${comment.priority}`}
                    aria-hidden="true"
                  />
                  <span className="qa-list-drawer__item-content">
                    <b>{comment.body}</b>
                    <small>
                      {authorName} · {comment.pathname} · {comment.viewport_width} × {comment.viewport_height}
                    </small>
                  </span>
                  <em className={`qa-list-drawer__status is-${comment.status}`}>
                    {statusLabel[comment.status]}
                  </em>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
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
  currentScroll,
  onClick,
  onHover,
  onLeave,
}: {
  comment: QaComment;
  number: number;
  zoom: number;
  viewport: { width: number; height: number };
  currentScroll: Point;
  onClick: () => void;
  onHover: (point: Omit<MarkerPreview, "comment">) => void;
  onLeave: () => void;
}) {
  const anchor = comment.normalized_anchor_json;
  const position = getCommentAnchorPosition({
    anchor,
    viewport,
    savedScroll: { x: comment.scroll_x, y: comment.scroll_y },
    currentScroll,
  });
  const authorName = commentAuthorName(comment.author);
  const markerX = position.x * zoom;
  const markerY = position.y * zoom;
  const area = getAreaGeometry(comment, viewport, zoom, currentScroll);
  const tooltipWidth = 300;
  const tooltipHeight = 104;
  const viewportWidth = viewport.width * zoom;
  const viewportHeight = viewport.height * zoom;

  if (
    markerX < -32 ||
    markerY < -32 ||
    markerX > viewportWidth + 32 ||
    markerY > viewportHeight + 32
  ) {
    return null;
  }

  const tooltipPoint = () => {
    if (area) {
      const centerX = Math.min(
        viewportWidth - tooltipWidth / 2 - 12,
        Math.max(tooltipWidth / 2 + 12, area.x + area.width / 2),
      );
      if (area.y + area.height + tooltipHeight + 20 <= viewportHeight) {
        return { x: centerX, y: area.y + area.height, placement: "bottom" as const };
      }
      if (area.y - tooltipHeight - 20 >= 0) {
        return { x: centerX, y: area.y, placement: "top" as const };
      }
    }
    return {
      x: markerX,
      y: markerY,
      placement:
        markerX > viewportWidth - tooltipWidth - 36 ? ("left" as const) : ("right" as const),
    };
  };
  return (
    <button
      className={`saved-pin saved-pin--${comment.status === "done" ? "done" : "open"}`}
      type="button"
      style={{ left: `${markerX}px`, top: `${markerY}px` }}
      onClick={onClick}
      onMouseEnter={() => onHover(tooltipPoint())}
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
      className={`marker-tooltip marker-tooltip--${preview.placement}`}
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
  currentScroll,
}: {
  comment: QaComment;
  zoom: number;
  viewport: { width: number; height: number };
  currentScroll: Point;
}) {
  const area = getAreaGeometry(comment, viewport, zoom, currentScroll);
  if (!area) return null;
  return (
    <div
      className="saved-area-preview"
      style={{
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
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
  deploymentSha,
  priority,
  setPriority,
  showReviewerTarget,
  reviewerTarget,
  reviewers,
  onReviewerTargetChange,
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
  deploymentSha: string;
  priority: QaComment["priority"];
  setPriority: (value: QaComment["priority"]) => void;
  showReviewerTarget: boolean;
  reviewerTarget: string;
  reviewers: Reviewer[];
  onReviewerTargetChange: (value: string) => void;
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
        <code>
          {draft.kind === "area" ? "선택 영역" : "핀 위치"} · {deploymentSha}
        </code>
      </header>
      <textarea
        autoFocus
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="이 위치에 대한 피드백을 입력하세요."
        required
      />
      {showReviewerTarget && (
        <label className="composer-reviewer">
          <span>수정 후 검토 요청</span>
          <select
            value={reviewerTarget}
            onChange={(event) => onReviewerTargetChange(event.target.value)}
            aria-label="검토 요청 대상"
          >
            <option value="none">요청 없음</option>
            {reviewers.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.displayName}
              </option>
            ))}
            {reviewers.length > 1 && <option value="all">전체</option>}
          </select>
        </label>
      )}
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

function eventLabel(event: QaComment["events"][number]) {
  if (event.kind === "review_requested") return "수정 완료 후 검토 요청";
  if (event.kind === "confirmed") return "확인 완료";
  if (event.kind === "reopened") return "다시 수정 요청";
  if (event.to_status === "in_progress") return "진행 중으로 변경";
  return "상태 변경";
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
  onDelete,
  onEditedBodyChange,
  onEditedPriorityChange,
  canRequestReview,
  reviewDeployments,
  reviewTargetDeploymentId,
  onReviewTargetDeploymentChange,
  canConfirm,
  onStartWork,
  onRequestReview,
  onOpenUpdatedScreen,
  onConfirm,
  onReopen,
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
  onDelete: () => void;
  onEditedBodyChange: (value: string) => void;
  onEditedPriorityChange: (value: QaComment["priority"]) => void;
  canRequestReview: boolean;
  reviewDeployments: DeploymentInfo[];
  reviewTargetDeploymentId: string;
  onReviewTargetDeploymentChange: (value: string) => void;
  canConfirm: boolean;
  onStartWork: () => void;
  onRequestReview: () => void;
  onOpenUpdatedScreen: () => void;
  onConfirm: () => void;
  onReopen: (note: string) => void;
}) {
  const [isReopenFormOpen, setIsReopenFormOpen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setIsReopenFormOpen(false);
    setReopenNote("");
    setIsDeleteConfirmOpen(false);
  }, [comment?.id, comment?.status]);
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
          <div className="comment-owner-actions">
            <button
              className="comment-edit-button"
              type="button"
              onClick={onStartEdit}
            >
              <PencilSimple /> 내 의견 수정
            </button>
            {!isDeleteConfirmOpen ? (
              <button
                className="comment-delete-button"
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                삭제
              </button>
            ) : (
              <span className="comment-delete-confirm">
                <b>삭제할까요?</b>
                <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isTransitioning}>취소</button>
                <button className="delete" type="button" onClick={onDelete} disabled={isTransitioning}>
                  {isTransitioning ? "삭제 중…" : "삭제하기"}
                </button>
              </span>
            )}
          </div>
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
      <section className="comment-activity">
        <SectionTitle label="작업 기록" count={`${comment.events.length + 1}`} />
        <ol>
          <li>
            <b>{authorName}</b>
            <span>의견 작성</span>
            <time>{relativeTime(comment.created_at)}</time>
          </li>
          {comment.events.map((event) => (
            <li key={event.id}>
              <b>{commentAuthorName(event.actor, "팀원")}</b>
              <span>{eventLabel(event)}</span>
              <time>{relativeTime(event.created_at)}</time>
              {event.payload_json?.note && <small>{event.payload_json.note}</small>}
            </li>
          ))}
        </ol>
      </section>
      <div className="thread-actions">
        {comment.status === "open" && canRequestReview && (
          <button className="advance" type="button" disabled={isTransitioning} onClick={onStartWork}>
            {isTransitioning ? "처리 중…" : "작업 시작"}
          </button>
        )}
        {comment.status === "in_progress" && canRequestReview && (
          <div className="review-target-picker">
            <label htmlFor="review-target-deployment">
              디자이너에게 보여줄 수정된 화면
            </label>
            <select
              id="review-target-deployment"
              value={reviewTargetDeploymentId}
              onChange={(event) =>
                onReviewTargetDeploymentChange(event.target.value)
              }
            >
              <option value="">수정된 화면 선택</option>
              {reviewDeployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>
                  {getDeploymentLabel(deployment)} · {deployment.git_sha.slice(0, 7)} · {deployment.deployed_at ? relativeTime(deployment.deployed_at) : "등록 시각 없음"}
                </option>
              ))}
            </select>
            <button
              className="advance"
              type="button"
              disabled={isTransitioning || !reviewTargetDeploymentId}
              onClick={onRequestReview}
            >
              {isTransitioning ? "처리 중…" : "수정 완료 · 검토 요청"}
            </button>
          </div>
        )}
        {comment.status === "review_requested" && canConfirm && !isReopenFormOpen && (
          <>
            <p className="review-request-hint">수정이 반영되었어요. 실제 화면을 확인해 주세요.</p>
            {comment.reviewDeployment && (
              <button
                className="review-open-updated"
                type="button"
                onClick={onOpenUpdatedScreen}
              >
                수정된 화면 확인하기
              </button>
            )}
            <button className="advance" type="button" disabled={isTransitioning} onClick={onConfirm}>
              {isTransitioning ? "처리 중…" : "확인 완료"}
            </button>
            <button className="reopen" type="button" disabled={isTransitioning} onClick={() => setIsReopenFormOpen(true)}>다시 수정 요청</button>
          </>
        )}
        {(comment.status === "done" && canConfirm) && !isReopenFormOpen && (
          <button className="reopen" type="button" disabled={isTransitioning} onClick={() => setIsReopenFormOpen(true)}>다시 수정 요청</button>
        )}
        {isReopenFormOpen && (
          <div className="reopen-form">
            <label htmlFor="reopen-note">다시 확인이 필요한 이유</label>
            <textarea id="reopen-note" value={reopenNote} onChange={(event) => setReopenNote(event.target.value)} placeholder="예: 모바일 400px 화면에서는 메뉴 간격이 여전히 좁아요." />
            <div>
              <button type="button" onClick={() => { setIsReopenFormOpen(false); setReopenNote(""); }} disabled={isTransitioning}>취소</button>
              <button className="advance" type="button" onClick={() => onReopen(reopenNote.trim())} disabled={isTransitioning || !reopenNote.trim()}>{isTransitioning ? "처리 중…" : "다시 수정 요청"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
