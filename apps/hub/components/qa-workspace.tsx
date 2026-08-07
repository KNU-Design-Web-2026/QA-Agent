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
  MapPin,
  Minus,
  PencilSimple,
  Plus,
  RectangleDashed,
  SignOut,
  SquaresFour,
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
  annotations: Array<{ id: string; kind: string; geometry_json: Record<string, unknown> }>;
};
type DeploymentInfo = { id: string; immutable_url: string; production_alias: string | null; git_sha: string; git_ref: string | null; provider_deployment_id: string; deployed_at: string | null; created_at: string };

const routes = [
  ["/", 6],
  ["/about", 2],
  ["/works", 7],
  ["/designer", 3],
  ["/archive", 1],
] as const;

const statusLabel: Record<QaStatus, string> = { open: "열림", in_progress: "진행 중", review_requested: "검토 요청", done: "완료" };
const typeLabel: Record<QaComment["type"], string> = { visual: "시각", interaction: "인터랙션", content: "콘텐츠", design_reference: "디자인 기준" };
const priorityLabel: Record<QaComment["priority"], string> = { low: "Low", medium: "Medium", high: "High", blocker: "Blocker" };
const nextStatus: Record<QaStatus, QaStatus> = { open: "in_progress", in_progress: "review_requested", review_requested: "done", done: "open" };

export function QaWorkspace({ deploymentUrl }: { deploymentUrl: string | null }) {
  const accessSession = useQaAccessSession();
  const [tool, setTool] = useState<Tool>("browse");
  const [selectedViewport, setSelectedViewport] = useState(() => {
    if (typeof window === "undefined") return 2;
    const width = Number(new URLSearchParams(window.location.search).get("viewport"));
    const index = viewports.findIndex((viewport) => viewport.width === width);
    return index === -1 ? 2 : index;
  });
  const [route, setRoute] = useState(() => typeof window === "undefined" ? "/" : new URLSearchParams(window.location.search).get("route") ?? "/");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [commentType, setCommentType] = useState<QaComment["type"]>("interaction");
  const [priority, setPriority] = useState<QaComment["priority"]>("high");
  const [comparePosition, setComparePosition] = useState(62);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [comments, setComments] = useState<QaComment[]>([]);
  const [authoredComments, setAuthoredComments] = useState<QaComment[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [isRegisteringDeployment, setIsRegisteringDeployment] = useState(false);
  const [deploymentForm, setDeploymentForm] = useState({ immutableUrl: "", providerDeploymentId: "", gitSha: "", gitRef: "main" });
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<Draft | null>(null);
  const currentViewport = viewports[selectedViewport] ?? { width: 1020, height: 1370 };
  const zoom = Math.min(0.68, 920 / currentViewport.width);
  const projectSlug = process.env.NEXT_PUBLIC_QA_PROJECT_SLUG ?? "knud-exhibition";
  const fallbackDeploymentUrl = (deploymentUrl ?? "http://localhost:3000").replace(/\/$/, "");
  const selectedDeployment = deployments.find((item) => item.id === selectedDeploymentId) ?? null;
  const actualUrl = selectedDeployment?.immutable_url ?? fallbackDeploymentUrl;
  const isCommentMode = tool === "pin" || tool === "area" || commentOpen;
  const selectedComment = comments.find((comment) => comment.id === selectedCommentId) ?? comments[0] ?? null;

  const loadDeployments = useCallback(async () => {
    setDeploymentsError(null);
    try {
      const response = await fetch(`/api/deployments?${new URLSearchParams({ projectSlug })}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "배포 버전 목록을 불러오지 못했습니다.");
      const nextDeployments = result.deployments ?? [];
      setDeployments(nextDeployments);
      setSelectedDeploymentId(result.activeDeploymentId ?? nextDeployments[0]?.id ?? null);
    } catch (error) {
      setDeploymentsError(error instanceof Error ? error.message : "배포 버전 목록을 불러오지 못했습니다.");
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
      const params = new URLSearchParams({ projectSlug, deploymentUrl: actualUrl, pathname: route });
      const response = await fetch(`/api/comments?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "코멘트 목록을 불러오지 못했습니다.");
      setComments(result.comments ?? []);
      setSelectedCommentId((current) => (result.comments?.some((comment: QaComment) => comment.id === current) ? current : result.comments?.[0]?.id ?? null));
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "코멘트 목록을 불러오지 못했습니다.");
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
      const params = new URLSearchParams({ projectSlug, deploymentUrl: actualUrl, scope: "authored" });
      const response = await fetch(`/api/comments?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "내 코멘트를 불러오지 못했습니다.");
      setAuthoredComments(result.comments ?? []);
    } catch {
      setAuthoredComments([]);
    }
  }, [actualUrl, projectSlug, selectedDeployment]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTool("browse");
        setCommentOpen(false);
        setDraft(null);
        draftRef.current = null;
        setIsSelecting(false);
      }
      if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey) setTool("pin");
      if (event.key.toLowerCase() === "o" && !event.metaKey && !event.ctrlKey) setComingSoon("Figma 기준 연결 및 비교 기능은 추가 구현 중입니다.");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { void loadDeployments(); }, [loadDeployments]);
  useEffect(() => { void loadComments(); }, [loadComments]);
  useEffect(() => { void loadAuthoredComments(); }, [loadAuthoredComments]);

  useEffect(() => {
    const commentId = new URLSearchParams(window.location.search).get("comment");
    if (commentId && comments.some((comment) => comment.id === commentId)) setSelectedCommentId(commentId);
  }, [comments]);

  const pointerToCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(currentViewport.width, (event.clientX - rect.left) / zoom)),
      y: Math.max(0, Math.min(currentViewport.height, (event.clientY - rect.top) / zoom)),
    };
  };

  const selectTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCommentMode || commentOpen || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    const nextDraft = { start: point, end: point, kind: tool === "area" ? "area" : "pin" } as Draft;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsSelecting(false);
    setCommentOpen(true);
  };

  const cancelTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsSelecting(false);
  };

  const scaleLabel = `${Math.round(zoom * 100)}%`;
  const deploymentLabel = selectedDeployment?.git_sha ? selectedDeployment.git_sha.slice(0, 7) : "버전 미선택";
  const deployedLabel = selectedDeployment?.deployed_at ? relativeTime(selectedDeployment.deployed_at) : "배포 시각 없음";

  async function saveComment() {
    if (!draft || !message.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const normalizedAnchor = {
        space: "viewport-normalized",
        x: draft.start.x / currentViewport.width,
        y: draft.start.y / currentViewport.height,
        width: Math.abs(draft.end.x - draft.start.x) / currentViewport.width,
        height: Math.abs(draft.end.y - draft.start.y) / currentViewport.height,
      };
      const response = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug, deploymentUrl: actualUrl, body: message.trim(), pathname: route, viewportWidth: currentViewport.width, viewportHeight: currentViewport.height, deviceScaleFactor: window.devicePixelRatio, zoom, kind: draft.kind, anchor: normalizedAnchor, type: commentType, priority }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "코멘트를 저장하지 못했습니다.");
      setMessage("");
      setCommentOpen(false);
      setTool("browse");
      setDraft(null);
      draftRef.current = null;
      await loadComments();
      await loadAuthoredComments();
      setSelectedCommentId(result.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "코멘트를 저장하지 못했습니다.");
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
      const response = await fetch("/api/deployments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug, ...deploymentForm }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "배포 버전을 등록하지 못했습니다.");
      await loadDeployments();
      setDeploymentForm({ immutableUrl: "", providerDeploymentId: "", gitSha: "", gitRef: "main" });
      setIsDeploymentModalOpen(false);
    } catch (error) {
      setDeploymentsError(error instanceof Error ? error.message : "배포 버전을 등록하지 못했습니다.");
    } finally {
      setIsRegisteringDeployment(false);
    }
  }

  async function activateDeployment(deploymentId: string) {
    setDeploymentsError(null);
    try {
      const response = await fetch("/api/deployments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectSlug, deploymentId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "QA 기준 버전을 변경하지 못했습니다.");
      setSelectedDeploymentId(result.activeDeploymentId);
    } catch (error) {
      setDeploymentsError(error instanceof Error ? error.message : "QA 기준 버전을 변경하지 못했습니다.");
    }
  }

  async function updateCommentStatus(nextStatus: QaStatus) {
    if (!selectedComment) return;
    setIsTransitioning(true);
    try {
      const response = await fetch("/api/comments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ commentId: selectedComment.id, nextStatus }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "상태를 변경하지 못했습니다.");
      await loadComments();
      await loadAuthoredComments();
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "상태를 변경하지 못했습니다.");
    } finally {
      setIsTransitioning(false);
    }
  }

  const openComment = (comment: QaComment) => { setRoute(comment.pathname); setSelectedCommentId(comment.id); };

  return (
    <main className="qa-app">
      <header className="qa-toolbar">
        <div className="toolbar-tools">
          <img className="toolbar-logo" src="/assets/ignite-mark-white.png" alt="KNUD Design QA" width={260} height={145} />
          <ToolButton active={tool === "browse"} title="탐색 · V" onClick={() => setTool("browse")}><Cursor /></ToolButton>
          <ToolButton active={tool === "pin"} title="핀 코멘트 · C" onClick={() => setTool("pin")}><MapPin /></ToolButton>
          <ToolButton active={tool === "area"} title="영역 코멘트 · R" onClick={() => setTool("area")}><RectangleDashed /></ToolButton>
          <ToolButton active={false} title="화살표 · A" onClick={() => setComingSoon("화살표 주석은 다음 작업에서 추가됩니다.")}><ArrowSquareOut /></ToolButton>
          <ToolButton active={false} title="드로잉 · P" onClick={() => setComingSoon("드로잉 주석은 다음 작업에서 추가됩니다.")}><PencilSimple /></ToolButton>
          <span className="toolbar-divider" />
          <ToolButton active={false} title="비교 오버레이 · O" onClick={() => setComingSoon("Figma 기준 연결 및 비교 기능은 추가 구현 중입니다.")}><SquaresFour /></ToolButton>
        </div>
        <div className="project-name"><strong>KNUD 2026 Exhibition</strong><span>/</span>{accessSession?.role === "admin" ? <label className="deploy-select"><i /><select value={selectedDeploymentId ?? ""} onChange={(event) => void activateDeployment(event.target.value)} aria-label="QA 기준 배포 버전"><option value="">배포 버전 선택</option>{deployments.map((item) => <option key={item.id} value={item.id}>{item.git_sha.slice(0, 7)} · {item.deployed_at ? relativeTime(item.deployed_at) : "배포 시각 없음"}</option>)}</select><code>{deploymentLabel}</code><small>{deployedLabel}</small></label> : <span className="deploy-select"><i />QA 기준 <code>{deploymentLabel}</code><small>{deployedLabel}</small></span>}</div>
        <div className="toolbar-actions">
          {accessSession?.role === "admin" && <button className="register-deployment-button" type="button" onClick={() => setIsDeploymentModalOpen(true)}>새 버전 등록</button>}
          <span className="user-profile" title={accessSession?.email}><b>{accessSession?.displayName ?? "사용자"}</b></span>
          <button className="logout-button" type="button" onClick={() => void signOut()} disabled={isSigningOut} title="로그아웃" aria-label="로그아웃"><SignOut />{isSigningOut ? "나가는 중" : "로그아웃"}</button>
        </div>
      </header>
      {comingSoon && <div className="tool-modal-backdrop"><section className="tool-notice" role="dialog" aria-modal="true" aria-labelledby="tool-notice-title"><span className="tool-notice__eyebrow">KNUD DESIGN QA HUB</span><h2 id="tool-notice-title">추가 구현 중입니다</h2><p>{comingSoon}</p><button type="button" onClick={() => setComingSoon(null)}>확인</button></section></div>}
      {isDeploymentModalOpen && <div className="tool-modal-backdrop"><form className="deployment-modal" onSubmit={registerDeployment}><span className="tool-notice__eyebrow">DEPLOYMENT RECORD</span><h2>새 배포 버전 등록</h2><p>Vercel 배포 상세에서 고유 URL, Deployment ID, Git SHA를 복사해 입력하세요.</p><label>고유 Deployment URL<input type="url" value={deploymentForm.immutableUrl} onChange={(event) => setDeploymentForm({ ...deploymentForm, immutableUrl: event.target.value })} placeholder="https://…vercel.app" required autoFocus /></label><label>Vercel Deployment ID<input value={deploymentForm.providerDeploymentId} onChange={(event) => setDeploymentForm({ ...deploymentForm, providerDeploymentId: event.target.value })} placeholder="dpl_…" required /></label><label>Git SHA<input value={deploymentForm.gitSha} onChange={(event) => setDeploymentForm({ ...deploymentForm, gitSha: event.target.value })} placeholder="전체 SHA 또는 앞 7자리" minLength={7} required /></label><label>Git Branch<input value={deploymentForm.gitRef} onChange={(event) => setDeploymentForm({ ...deploymentForm, gitRef: event.target.value })} required /></label>{deploymentsError && <div className="deployment-modal__error">{deploymentsError}</div>}<footer><button type="button" className="cancel" onClick={() => setIsDeploymentModalOpen(false)}>취소</button><button type="submit" className="save" disabled={isRegisteringDeployment}>{isRegisteringDeployment ? "등록 중…" : "버전 등록"}</button></footer></form></div>}

      <section className="qa-layout">
        <aside className="left-panel">
          <div className="panel-heading"><strong>검수 설정</strong><small>현재 화면</small></div>
          <SectionTitle label="페이지 경로" count="5" />
          <div className="tree-list">
            {routes.map(([path, count]) => <button key={path} className={`tree-row ${route === path ? "selected" : ""}`} onClick={() => setRoute(path)}><CornersOut /><code>{path}</code><b>{count}</b></button>)}
          </div>
          <div className="panel-rule" />
          <SectionTitle label="검수 뷰포트" />
          <div className="tree-list">
            {viewports.map((item, index) => <button key={item.width} className={`tree-row viewport-row ${selectedViewport === index ? "selected" : ""}`} onClick={() => setSelectedViewport(index)}><span className="viewport-icon" /><code>{item.width} × {item.height}</code>{selectedViewport === index && <b>주 화면</b>}</button>)}
          </div>
          <div className="panel-rule" />
          <SectionTitle label="이 라우트의 주석" count={String(comments.length)} />
          <div className="annotation-tree">
            {comments.map((comment, index) => <button key={comment.id} className={selectedComment?.id === comment.id ? "selected" : ""} onClick={() => setSelectedCommentId(comment.id)}><PinBadge number={index + 1} tone={comment.priority === "blocker" ? "red" : "yellow"} /><code>{comment.element_qa_id ?? "선택한 위치"}</code></button>)}
            {!isLoadingComments && !comments.length && <p className="empty-comments">이 경로에는 아직 코멘트가 없습니다.</p>}
          </div>
          <div className="panel-rule" />
          <SectionTitle label="내가 작성한 코멘트" count={String(authoredComments.length)} />
          <div className="annotation-tree authored-comments">
            {authoredComments.map((comment, index) => <button key={comment.id} className={selectedComment?.id === comment.id ? "selected" : ""} onClick={() => openComment(comment)}><PinBadge number={index + 1} tone={comment.status === "done" ? "gray" : comment.priority === "blocker" ? "red" : "yellow"} /><span><b>{comment.body}</b><code>{comment.pathname} · {statusLabel[comment.status]}</code></span></button>)}
            {!authoredComments.length && <p className="empty-comments">이 버전에서 작성한 코멘트가 없습니다.</p>}
          </div>
        </aside>

        <section className="qa-canvas">
          <div className="frame-workspace">
            <article className="live-stage" style={{ width: Math.round(currentViewport.width * zoom) }}>
              <header className="frame-caption"><span><code>{currentViewport.width} × {currentViewport.height}</code> 태블릿 · 주 검수 화면</span><span><code>{scaleLabel}</code> · scrollY 0</span></header>
              <div className="live-frame">
                <div className="browser-bar"><button aria-label="뒤로"><CaretLeft /></button><button aria-label="새로고침"><span className="reload">↻</span></button><div className="address"><i /> <code>knud-2026.vercel.app</code><strong>{route}</strong></div><span className="live-badge"><i />실제 배포본</span></div>
                {isCommentMode && <div className="mode-banner"><span><MapPin /> 코멘트 모드 — 사이트 위를 클릭하거나 영역을 드래그하세요</span><button onClick={() => { setTool("browse"); setCommentOpen(false); setDraft(null); draftRef.current = null; setIsSelecting(false); setSaveError(null); }}><kbd>Esc</kbd> 종료</button></div>}
                <div className="viewport-clip" style={{ width: Math.round(currentViewport.width * zoom), height: isCommentMode ? 674 : 704 }}>
                  <div className="scaled-viewport" style={{ width: currentViewport.width, height: currentViewport.height, transform: `scale(${zoom})` }}>
                    <iframe title="KNUD production deployment" src={`${actualUrl}${route}`} scrolling="yes" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" />
                  </div>
                  {tool === "compare" && <CompareOverlay position={comparePosition} onChange={setComparePosition} />}
                  {isCommentMode && <div className="comment-mask" style={{ pointerEvents: commentOpen ? "none" : "auto" }} onPointerDown={selectTarget} onPointerMove={updateTarget} onPointerUp={finishTarget} onPointerCancel={cancelTarget} />}
                  {draft && <Selection draft={draft} zoom={zoom} viewport={currentViewport} />}
                  {comments.map((comment, index) => <SavedAnnotation key={comment.id} comment={comment} number={index + 1} zoom={zoom} viewport={currentViewport} onClick={() => setSelectedCommentId(comment.id)} />)}
                  {commentOpen && draft && <CommentComposer message={message} setMessage={setMessage} saveError={saveError} isSaving={isSaving} draft={draft} zoom={zoom} viewport={currentViewport} canvasHeight={674} type={commentType} priority={priority} setType={setCommentType} setPriority={setPriority} onCancel={() => { setCommentOpen(false); setDraft(null); draftRef.current = null; setTool("browse"); setSaveError(null); }} onSave={saveComment} />}
                </div>
              </div>
              <p className="frame-hint">탐색 모드에서 프레임 안을 스크롤하며 실제 사이트를 확인하세요. <strong>코멘트를 남기려면</strong> <kbd>C</kbd> 또는 아래 주석 버튼</p>
            </article>
          </div>
          <nav className="mode-switch"><button className={tool === "browse" ? "active" : ""} onClick={() => setTool("browse")}><Cursor />탐색</button><button className={isCommentMode ? "active" : ""} onClick={() => setTool("pin")}><MapPin />코멘트 <kbd>C</kbd></button><button onClick={() => setComingSoon("Figma 기준 연결 및 비교 기능은 추가 구현 중입니다.")}><SquaresFour />비교</button></nav>
        </section>

        <aside className="right-panel">
          <div className="panel-heading"><strong>선택한 코멘트</strong><small>상세 · 재현 · 상태</small></div>
          <CommentInspector comment={selectedComment} isLoading={isLoadingComments} error={commentsError} isTransitioning={isTransitioning} canComplete={accessSession?.role === "admin"} onTransition={() => void updateCommentStatus(nextStatus[selectedComment?.status ?? "open"])} onComplete={() => void updateCommentStatus("done")} />
        </aside>
      </section>
    </main>
  );
}

function ToolButton({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) { return <button aria-label={title} title={title} className={`tool-button ${active ? "active" : ""}`} onClick={onClick}>{children}</button>; }
function relativeTime(value: string) { const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000)); if (minutes < 1) return "방금 전"; if (minutes < 60) return `${minutes}분 전`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}시간 전`; return `${Math.round(hours / 24)}일 전`; }
function SectionTitle({ label, count }: { label: string; count?: string }) { return <div className="section-title"><span>{label}</span>{count && <small>{count}</small>}</div>; }
function PinBadge({ number, tone, className = "" }: { number: number; tone: string; className?: string }) { return <span className={`pin-badge ${tone} ${className}`}><MapPin weight="fill" /> <b>{number}</b></span>; }

function Selection({ draft, zoom, viewport }: { draft: Draft; zoom: number; viewport: { width: number; height: number } }) {
  const left = Math.min(draft.start.x, draft.end.x); const top = Math.min(draft.start.y, draft.end.y);
  const width = draft.kind === "pin" ? 38 : Math.max(24, Math.abs(draft.end.x - draft.start.x)); const height = draft.kind === "pin" ? 38 : Math.max(24, Math.abs(draft.end.y - draft.start.y));
  const pinLeft = draft.kind === "pin" ? Math.max(0, Math.min(viewport.width - width, left - width / 2)) : left;
  const pinTop = draft.kind === "pin" ? Math.max(0, Math.min(viewport.height - height, top - height / 2)) : top;
  return <div className="selection" style={{ left: pinLeft * zoom, top: pinTop * zoom, width: width * zoom, height: height * zoom }}><i /><i /><i /><i /><span>{draft.kind === "pin" ? "핀 위치" : "선택 영역"} · {Math.round(width)} × {Math.round(height)}</span></div>;
}

function SavedAnnotation({ comment, number, zoom, viewport, onClick }: { comment: QaComment; number: number; zoom: number; viewport: { width: number; height: number }; onClick: () => void }) {
  const anchor = comment.normalized_anchor_json;
  const x = typeof anchor.x === "number" ? anchor.x : 0;
  const y = typeof anchor.y === "number" ? anchor.y : 0;
  return <button className="saved-pin" type="button" style={{ left: `${x * viewport.width * zoom}px`, top: `${y * viewport.height * zoom}px` }} onClick={onClick} aria-label={`코멘트 ${number} 열기`}><PinBadge number={number} tone={comment.priority === "blocker" ? "red" : "yellow"} /></button>;
}

function CommentComposer({ message, setMessage, saveError, isSaving, draft, zoom, viewport, canvasHeight, type, priority, setType, setPriority, onCancel, onSave }: { message: string; setMessage: (value: string) => void; saveError: string | null; isSaving: boolean; draft: Draft; zoom: number; viewport: { width: number; height: number }; canvasHeight: number; type: QaComment["type"]; priority: QaComment["priority"]; setType: (value: QaComment["type"]) => void; setPriority: (value: QaComment["priority"]) => void; onCancel: () => void; onSave: () => Promise<void> }) {
  const left = Math.min(viewport.width * zoom - 314, Math.max(10, draft.end.x * zoom + 14));
  const top = Math.min(canvasHeight - 254, Math.max(10, draft.end.y * zoom + 14));
  return <form className="comment-composer" style={{ left, top }} onSubmit={(event) => { event.preventDefault(); void onSave(); }}><header><span className="avatar yellow">QA</span><strong>여기에 코멘트 남기기</strong><code>{draft.kind === "area" ? "선택 영역" : "핀 위치"}</code></header><textarea autoFocus value={message} onChange={(event) => setMessage(event.target.value)} placeholder="이 위치에 대한 피드백을 입력하세요." required /><div className="composer-actions"><label className="select-pill"><i /><select value={priority} onChange={(event) => setPriority(event.target.value as QaComment["priority"])} aria-label="우선순위">{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="select-pill"><select value={type} onChange={(event) => setType(event.target.value as QaComment["type"])} aria-label="유형">{Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span /><button type="button" className="cancel" onClick={onCancel}>취소</button><button className="save" disabled={isSaving}>{isSaving ? "저장 중…" : "저장"} <code>⌘↵</code></button></div>{saveError && <p className="composer-error">{saveError}</p>}<footer>뷰포트 · 경로 · 좌표 · 배포본 자동 저장</footer></form>;
}

function CompareOverlay({ position, onChange }: { position: number; onChange: (value: number) => void }) { return <div className="compare-overlay"><div className="reference-layer" style={{ width: `${position}%` }}><span>FIGMA 기준</span></div><div className="live-layer"><span>LIVE 구현</span></div><input aria-label="비교 분할 위치" type="range" min="40" max="90" value={position} onChange={(event) => onChange(Number(event.target.value))} /></div>; }

function CommentInspector({ comment, isLoading, error, isTransitioning, canComplete, onTransition, onComplete }: { comment: QaComment | null; isLoading: boolean; error: string | null; isTransitioning: boolean; canComplete: boolean; onTransition: () => void; onComplete: () => void }) {
  if (isLoading) return <div className="inspector-empty">코멘트를 불러오는 중…</div>;
  if (error) return <div className="inspector-empty">{error}</div>;
  if (!comment) return <div className="inspector-empty">이 경로에는 아직 코멘트가 없습니다.<br />핀 또는 영역 도구로 첫 코멘트를 남겨보세요.</div>;
  const next = nextStatus[comment.status];
  const authorName = comment.author?.display_name ?? comment.author?.email ?? "알 수 없음";
  const query = new URLSearchParams({ comment: comment.id, route: comment.pathname, viewport: String(comment.viewport_width) });
  return <div className="comment-inspector"><section className="thread"><div className="thread-meta"><PinBadge number={1} tone={comment.status === "done" ? "gray" : comment.priority === "blocker" ? "red" : "yellow"} /><b className="priority">{priorityLabel[comment.priority]}</b><b className="type">{typeLabel[comment.type]}</b><b className="status">{statusLabel[comment.status]}</b></div><div className="author"><span className="avatar yellow">{authorName.slice(0, 2)}</span><strong>{authorName}</strong><time>{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(comment.created_at))}</time></div><p>{comment.body}</p></section><section className="reproduction"><SectionTitle label="재현 정보" />{[["anchor", comment.element_qa_id ?? "선택 좌표"], ["뷰포트", `${comment.viewport_width} × ${comment.viewport_height}`], ["경로", `${comment.pathname}${comment.query_string}`], ["scroll", `${comment.scroll_x}, ${comment.scroll_y}`], ["확대", `${Math.round(comment.zoom * 100)}%`]].map(([label, value]) => <p key={label}><span>{label}</span><code>{value}</code></p>)}<button type="button" onClick={() => window.open(`${window.location.origin}/?${query}`, "_blank")}><ArrowSquareOut /> 이 코멘트 검수 화면 열기</button></section>{canComplete && <div className="thread-actions">{comment.status !== "done" && <button className="advance" type="button" disabled={isTransitioning} onClick={onComplete}>{isTransitioning ? "처리 중…" : "완료 처리"}</button>}{comment.status === "done" && <button className="reopen" type="button" disabled={isTransitioning} onClick={onTransition}>{isTransitioning ? "처리 중…" : "재오픈"}</button>}</div>}</div>;
}
