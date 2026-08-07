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
  SquaresFour,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

const routes = [
  ["/", 6],
  ["/about", 2],
  ["/works", 7],
  ["/designer", 3],
  ["/archive", 1],
] as const;

const comments = [
  ["navigation-toggle", "yellow"],
  ["main-artwork / title", "red"],
  ["site-header / nav-works", "gray"],
] as const;

export function QaWorkspace({ deploymentUrl }: { deploymentUrl: string | null }) {
  const [tool, setTool] = useState<Tool>("browse");
  const [selectedViewport, setSelectedViewport] = useState(2);
  const [route, setRoute] = useState("/");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [comparePosition, setComparePosition] = useState(62);
  const [status, setStatus] = useState("열림");
  const canvasRef = useRef<HTMLDivElement>(null);
  const currentViewport = viewports[selectedViewport] ?? { width: 1020, height: 1370 };
  const zoom = Math.min(0.68, 920 / currentViewport.width);
  // Vercel aliases can be entered with or without a trailing slash. Keep the
  // stored deployment key canonical so it remains stable between sessions.
  const actualUrl = (deploymentUrl ?? "http://localhost:3000").replace(/\/$/, "");
  const projectSlug = process.env.NEXT_PUBLIC_QA_PROJECT_SLUG ?? "knud-exhibition";
  const isCommentMode = tool === "pin" || tool === "area" || commentOpen;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTool("browse");
        setCommentOpen(false);
        setDraft(null);
      }
      if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey) setTool("pin");
      if (event.key.toLowerCase() === "o" && !event.metaKey && !event.ctrlKey) setTool("compare");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pointerToCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };

  const selectTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCommentMode) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event);
    setDraft({ start: point, end: point, kind: tool === "area" ? "area" : "pin" });
  };

  const updateTarget = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft || draft.kind !== "area") return;
    setDraft({ ...draft, end: pointerToCanvas(event) });
  };

  const finishTarget = () => {
    if (!draft) return;
    setCommentOpen(true);
  };

  const scaleLabel = `${Math.round(zoom * 100)}%`;

  async function saveComment() {
    if (!draft || !message.trim()) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSaveError("Supabase 연결 설정을 찾을 수 없습니다.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const [{ data: auth }, { data: project, error: projectError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("projects").select("id").eq("slug", projectSlug).single(),
      ]);
      if (!auth.user) throw new Error("로그인 세션이 만료되었습니다.");
      if (projectError || !project) throw new Error("QA 프로젝트 설정을 찾을 수 없습니다.");
      const { data: deployment, error: deploymentError } = await supabase
        .from("deployments")
        .select("id")
        .eq("project_id", project.id)
        .eq("immutable_url", actualUrl)
        .single();
      if (deploymentError || !deployment) throw new Error("현재 배포본이 아직 QA 프로젝트에 등록되지 않았습니다.");

      const normalizedAnchor = {
        space: "viewport-normalized",
        x: draft.start.x / currentViewport.width,
        y: draft.start.y / currentViewport.height,
        width: Math.abs(draft.end.x - draft.start.x) / currentViewport.width,
        height: Math.abs(draft.end.y - draft.start.y) / currentViewport.height,
      };
      const { data: comment, error: commentError } = await supabase
        .from("qa_comments")
        .insert({
          project_id: project.id,
          deployment_id: deployment.id,
          author_id: auth.user.id,
          body: message.trim(),
          type: "interaction",
          priority: "high",
          pathname: route,
          query_string: "",
          viewport_width: currentViewport.width,
          viewport_height: currentViewport.height,
          device_scale_factor: window.devicePixelRatio,
          zoom,
          scroll_x: 0,
          scroll_y: 0,
          element_qa_id: "navigation-toggle",
          selector_hint_json: {},
          normalized_anchor_json: normalizedAnchor,
        })
        .select("id")
        .single();
      if (commentError || !comment) throw new Error("코멘트를 저장하지 못했습니다.");

      const { error: annotationError } = await supabase.from("annotations").insert({
        qa_comment_id: comment.id,
        kind: draft.kind === "area" ? "rect" : "pin",
        geometry_json: normalizedAnchor,
        style_json: { color: "yellow" },
      });
      if (annotationError) throw new Error("코멘트 위치를 저장하지 못했습니다.");
      setMessage("");
      setCommentOpen(false);
      setTool("browse");
      setDraft(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "코멘트를 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="qa-app">
      <header className="qa-toolbar">
        <div className="toolbar-tools">
          <span className="app-logo" aria-label="KNUD Design QA" />
          <ToolButton active={tool === "browse"} title="탐색 · V" onClick={() => setTool("browse")}><Cursor /></ToolButton>
          <ToolButton active={tool === "pin"} title="핀 코멘트 · C" onClick={() => setTool("pin")}><MapPin /></ToolButton>
          <ToolButton active={tool === "area"} title="영역 코멘트 · R" onClick={() => setTool("area")}><RectangleDashed /></ToolButton>
          <ToolButton active={tool === "arrow"} title="화살표 · A" onClick={() => setTool("arrow")}><ArrowSquareOut /></ToolButton>
          <ToolButton active={tool === "draw"} title="드로잉 · P" onClick={() => setTool("draw")}><PencilSimple /></ToolButton>
          <span className="toolbar-divider" />
          <ToolButton active={tool === "compare"} title="비교 오버레이 · O" onClick={() => setTool("compare")}><SquaresFour /></ToolButton>
        </div>
        <div className="project-name"><strong>KNUD 2026 Exhibition</strong><span>/</span><button className="deploy-select"><i />Production <code>9e74d1b</code><CaretDown /></button></div>
        <div className="toolbar-actions">
          <div className="presence"><span className="avatar yellow">JK</span><span className="avatar blue">DH</span><span className="avatar dark">MS</span></div>
          <button className="share-button">공유</button>
          <button className="zoom-button">{scaleLabel}<CaretDown /></button>
        </div>
      </header>

      <section className="qa-layout">
        <aside className="left-panel">
          <PanelTabs labels={["페이지", "주석", "기준"]} active={0} />
          <SectionTitle label="라우트" count="5" />
          <div className="tree-list">
            {routes.map(([path, count]) => <button key={path} className={`tree-row ${route === path ? "selected" : ""}`} onClick={() => setRoute(path)}><CornersOut /><code>{path}</code><b>{count}</b></button>)}
          </div>
          <div className="panel-rule" />
          <SectionTitle label="검수 뷰포트" />
          <div className="tree-list">
            {viewports.map((item, index) => <button key={item.width} className={`tree-row viewport-row ${selectedViewport === index ? "selected" : ""}`} onClick={() => setSelectedViewport(index)}><span className="viewport-icon" /><code>{item.width} × {item.height}</code>{selectedViewport === index && <b>주 화면</b>}</button>)}
          </div>
          <div className="panel-rule" />
          <SectionTitle label="이 라우트의 주석" />
          <div className="annotation-tree">
            {comments.map(([anchor, color], index) => <button key={anchor} className={index === 0 ? "selected" : ""}><PinBadge number={index + 1} tone={color} /><code>{anchor}</code></button>)}
          </div>
        </aside>

        <section className="qa-canvas">
          <div className="frame-workspace">
            <article className="live-stage" style={{ width: Math.round(currentViewport.width * zoom) }}>
              <header className="frame-caption"><span><code>{currentViewport.width} × {currentViewport.height}</code> 태블릿 · 주 검수 화면</span><span><code>{scaleLabel}</code> · scrollY 0</span></header>
              <div className="live-frame">
                <div className="browser-bar"><button aria-label="뒤로"><CaretLeft /></button><button aria-label="새로고침"><span className="reload">↻</span></button><div className="address"><i /> <code>knud-2026.vercel.app</code><strong>{route}</strong></div><span className="live-badge"><i />실제 배포본</span></div>
                {isCommentMode && <div className="mode-banner"><span><MapPin /> 코멘트 모드 — 사이트 위를 클릭하거나 영역을 드래그하세요</span><button onClick={() => { setTool("browse"); setCommentOpen(false); setDraft(null); setSaveError(null); }}><kbd>Esc</kbd> 종료</button></div>}
                <div className="viewport-clip" style={{ width: Math.round(currentViewport.width * zoom), height: isCommentMode ? 674 : 704 }}>
                  <div className="scaled-viewport" style={{ width: currentViewport.width, height: currentViewport.height, transform: `scale(${zoom})` }}>
                    <iframe title="KNUD production deployment" src={`${actualUrl}${route}`} sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" />
                  </div>
                  {tool === "compare" && <CompareOverlay position={comparePosition} onChange={setComparePosition} />}
                  {isCommentMode && <div className="comment-mask" onPointerDown={selectTarget} onPointerMove={updateTarget} onPointerUp={finishTarget} />}
                  {draft && <Selection draft={draft} />}
                  {!isCommentMode && <><div className="hover-target"><span>hero-cta-primary · 124×40</span></div><PinBadge number={1} tone="yellow" className="frame-pin" /></>}
                  {commentOpen && draft && <CommentComposer message={message} setMessage={setMessage} saveError={saveError} isSaving={isSaving} onCancel={() => { setCommentOpen(false); setDraft(null); setTool("browse"); setSaveError(null); }} onSave={saveComment} />}
                </div>
              </div>
              <p className="frame-hint">실제 사이트를 그대로 클릭·hover하며 확인하세요. <strong>코멘트를 남기려면</strong> <kbd>C</kbd> 또는 아래 주석 버튼</p>
            </article>
          </div>
          <nav className="mode-switch"><button className={tool === "browse" ? "active" : ""} onClick={() => setTool("browse")}><Cursor />탐색</button><button className={isCommentMode ? "active" : ""} onClick={() => setTool("pin")}><MapPin />코멘트 <kbd>C</kbd></button><button className={tool === "compare" ? "active" : ""} onClick={() => setTool("compare")}><SquaresFour />비교</button></nav>
        </section>

        <aside className="right-panel">
          <PanelTabs labels={["코멘트", "속성", "활동"]} active={0} />
          {tool === "compare" ? <CompareInspector /> : <CommentInspector status={status} setStatus={setStatus} />}
        </aside>
      </section>
    </main>
  );
}

function ToolButton({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) { return <button aria-label={title} title={title} className={`tool-button ${active ? "active" : ""}`} onClick={onClick}>{children}</button>; }
function PanelTabs({ labels, active }: { labels: string[]; active: number }) { return <div className="panel-tabs">{labels.map((label, index) => <button key={label} className={active === index ? "active" : ""}>{label}</button>)}</div>; }
function SectionTitle({ label, count }: { label: string; count?: string }) { return <div className="section-title"><span>{label}</span>{count && <small>{count}</small>}</div>; }
function PinBadge({ number, tone, className = "" }: { number: number; tone: string; className?: string }) { return <span className={`pin-badge ${tone} ${className}`}><MapPin weight="fill" /> <b>{number}</b></span>; }

function Selection({ draft }: { draft: Draft }) {
  const left = Math.min(draft.start.x, draft.end.x); const top = Math.min(draft.start.y, draft.end.y);
  const width = draft.kind === "pin" ? 38 : Math.max(24, Math.abs(draft.end.x - draft.start.x)); const height = draft.kind === "pin" ? 38 : Math.max(24, Math.abs(draft.end.y - draft.start.y));
  return <div className="selection" style={{ left, top, width, height }}><i /><i /><i /><i /><span>navigation-toggle · {Math.round(width)} × {Math.round(height)}</span></div>;
}

function CommentComposer({ message, setMessage, saveError, isSaving, onCancel, onSave }: { message: string; setMessage: (value: string) => void; saveError: string | null; isSaving: boolean; onCancel: () => void; onSave: () => Promise<void> }) {
  return <form className="comment-composer" onSubmit={(event) => { event.preventDefault(); void onSave(); }}><header><span className="avatar yellow">JK</span><strong>여기에 코멘트 남기기</strong><code>navigation-toggle</code></header><textarea autoFocus value={message} onChange={(event) => setMessage(event.target.value)} placeholder="이 요소에 대한 피드백을 입력하세요." required /><div className="composer-actions"><button type="button" className="select-pill"><i />High<CaretDown /></button><button type="button" className="select-pill">인터랙션<CaretDown /></button><button type="button" className="assignee">@</button><span /><button type="button" className="cancel" onClick={onCancel}>취소</button><button className="save" disabled={isSaving}>{isSaving ? "저장 중…" : "저장"} <code>⌘↵</code></button></div>{saveError && <p className="composer-error">{saveError}</p>}<footer>뷰포트 · 경로 · 좌표 · 배포본 자동 저장</footer></form>;
}

function CompareOverlay({ position, onChange }: { position: number; onChange: (value: number) => void }) { return <div className="compare-overlay"><div className="reference-layer" style={{ width: `${position}%` }}><span>FIGMA 기준</span></div><div className="live-layer"><span>LIVE 구현</span></div><input aria-label="비교 분할 위치" type="range" min="40" max="90" value={position} onChange={(event) => onChange(Number(event.target.value))} /></div>; }

function CompareInspector() { return <div className="compare-inspector"><div className="compare-tabs"><button>Live</button><button>Figma</button><button className="active">Overlay</button><button>Diff</button></div><label>불투명도 <input type="range" defaultValue="62" /><code>62%</code></label><div className="agent-card"><header><b>시각 차이 3건 감지</b><code>9e74d1b</code></header>{[["헤더 버튼 위치", "+2px · x축"], ["히어로 아트워크 상단 여백", "+8px · padding-top"], ["모바일 타이틀 줄바꿈", "기준 확인 필요"]].map(([title, delta], index) => <button key={title}><b>{index + 1}</b><span>{title}<code>{delta}</code></span></button>)}<footer><span>A</span> Agent 제안 — 사람 확인 필요</footer></div></div>; }

function CommentInspector({ status, setStatus }: { status: string; setStatus: (value: string) => void }) { const next = status === "열림" ? "진행 중으로 변경" : "검토 요청으로 변경"; return <div className="comment-inspector"><section className="thread"><div className="thread-meta"><PinBadge number={1} tone="yellow" /><b className="priority">High</b><b className="type">인터랙션</b><b className="status">{status}</b></div><div className="author"><span className="avatar yellow">JK</span><strong>김지수 <em>디자이너</em></strong><time>2분 전</time><button>•••</button></div><p>헤더 메뉴로 이동할 때 움직임이 어색해요. 버튼을 오른쪽으로 2px 옮겼으면 좋겠어요.</p><div className="evidence"><div><span>1</span></div><footer>작성 시점 캡처 <a>원본 열기</a></footer></div></section><section className="reproduction"><SectionTitle label="재현 정보" />{[["anchor", "navigation-toggle"], ["요소 사각형", "950, 19, 38, 38"], ["뷰포트", "1020 × 1370"], ["경로", "/"], ["scroll", "0, 0"], ["배포", "9e74d1b"]].map(([label, value]) => <p key={label}><span>{label}</span><code>{value}</code></p>)}<button><ArrowSquareOut /> 이 상태로 배포본 열기</button></section><div className="thread-actions"><button className="advance" onClick={() => setStatus(status === "열림" ? "진행 중" : "검토 요청")}>{next}</button><button>답글</button></div><section className="other-comments"><SectionTitle label="다른 코멘트" count="11" />{["히어로 타이틀이 600px에서 세 줄로 깨집니다.", "작품 카드 그리드 간격이 Figma와 8px 차이남", "ARCHIVE 메뉴 라벨을 아카이브로 변경."].map((text, index) => <button key={text}><PinBadge number={index + 2} tone={index === 0 ? "red" : "gray"} /><span>{text}<code>{index === 0 ? "/ · 600 · main-artwork" : "/works · 1350 · works-grid"}</code></span></button>)}</section></div>; }
