"use client";

import {
  ArrowLeft,
  CaretRight,
  Check,
  Copy,
  DownloadSimple,
  Export,
  FileCode,
  FunnelSimple,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type QaStatus = "open" | "in_progress" | "review_requested" | "done";
type NormalizedAnchor = { x?: number; y?: number; width?: number; height?: number };
type HistoryComment = {
  id: string;
  body: string;
  priority: "low" | "medium" | "high" | "blocker";
  status: QaStatus;
  pathname: string;
  viewport_width: number;
  viewport_height: number;
  scroll_x: number;
  scroll_y: number;
  element_qa_id: string | null;
  normalized_anchor_json: NormalizedAnchor;
  created_at: string;
  deployment_id: string;
  deployment: { id: string; immutable_url: string; git_sha: string; deployed_at: string | null } | null;
  author: { display_name: string | null; email: string } | null;
};

const statusLabel: Record<QaStatus, string> = { open: "열림", in_progress: "진행 중", review_requested: "검토 요청", done: "완료" };
const priorityLabel: Record<HistoryComment["priority"], string> = { low: "Low", medium: "Medium", high: "High", blocker: "Blocker" };

function authorName(author: HistoryComment["author"]) {
  const name = author?.display_name?.trim() || author?.email.split("@")[0] || "익명";
  return /^[가-힣]{3}$/.test(name) ? name.slice(1) : name;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function commentRect(comment: HistoryComment) {
  const anchor = comment.normalized_anchor_json ?? {};
  const x = Math.max(0, Math.min(1, Number(anchor.x) || 0));
  const y = Math.max(0, Math.min(1, Number(anchor.y) || 0));
  const width = Math.max(0, Math.min(1 - x, Number(anchor.width) || 0));
  const height = Math.max(0, Math.min(1 - y, Number(anchor.height) || 0));
  return { x, y, width, height, kind: width > 0 && height > 0 ? "area" : "pin" as const };
}

function reproductionUrl(comment: HistoryComment) {
  const params = new URLSearchParams({ comment: comment.id, deployment: comment.deployment_id, route: comment.pathname, viewport: String(comment.viewport_width) });
  return `${window.location.origin}/?${params}`;
}

function locationSvg(comment: HistoryComment, index: number) {
  const target = commentRect(comment);
  const width = 420;
  const height = Math.round((comment.viewport_height / comment.viewport_width) * width);
  const x = Math.round(target.x * width);
  const y = Math.round(target.y * height);
  const rectWidth = Math.max(10, Math.round(target.width * width));
  const rectHeight = Math.max(10, Math.round(target.height * height));
  const isArea = target.kind === "area";
  const author = authorName(comment.author);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="QA-${index} 위치 안내"><rect width="${width}" height="${height}" fill="#F3F2EF"/><path d="M0 0H${width}V${height}H0Z" fill="none" stroke="#C9C9C4" stroke-width="2"/>${isArea ? `<rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="4" fill="#FCD51955" stroke="#111111" stroke-width="2"/>` : `<circle cx="${x}" cy="${y}" r="14" fill="#647397" stroke="#fff" stroke-width="3"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="10" font-weight="700">${author}</text>`}<rect x="12" y="12" width="${isArea ? 36 : 40}" height="22" rx="11" fill="#111"/><text x="${isArea ? 30 : 32}" y="27" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="10" font-weight="700">QA-${index}</text><text x="12" y="${height - 14}" fill="#555550" font-family="monospace" font-size="10">${comment.viewport_width} × ${comment.viewport_height}</text></svg>`;
}

function exportPayload(comments: HistoryComment[]) {
  return comments.map((comment, index) => {
    const target = commentRect(comment);
    return {
      id: comment.id,
      label: `QA-${String(index + 1).padStart(3, "0")}`,
      status: comment.status,
      priority: comment.priority,
      authorName: authorName(comment.author),
      body: comment.body,
      reproduction: { qaUrl: reproductionUrl(comment), deploymentUrl: comment.deployment?.immutable_url ?? null, gitSha: comment.deployment?.git_sha ?? null, pathname: comment.pathname, viewport: { width: comment.viewport_width, height: comment.viewport_height }, scroll: { x: comment.scroll_x, y: comment.scroll_y } },
      target: { kind: target.kind, dataQaId: comment.element_qa_id, cssRect: { x: Math.round(target.x * comment.viewport_width), y: Math.round(target.y * comment.viewport_height), width: Math.round(target.width * comment.viewport_width), height: Math.round(target.height * comment.viewport_height) }, normalizedRect: target },
      visualGuide: { fileName: `QA-${String(index + 1).padStart(3, "0")}-location.svg`, svg: locationSvg(comment, index + 1) },
    };
  });
}

function exportMarkdown(comments: HistoryComment[]) {
  const items = exportPayload(comments);
  return `# KNUD Design QA 수정 요청\n\n- 생성 시각: ${new Date().toLocaleString("ko-KR")}\n- 의견 수: ${items.length}\n- 원칙: 수정 후 자동 완료하지 말고 검토 요청 상태로 남깁니다.\n\n${items.map((item) => `## ${item.label} — ${item.body.slice(0, 42)}\n\n- 우선순위: ${priorityLabel[item.priority]}\n- 작성자: ${item.authorName}\n- 상태: ${statusLabel[item.status]}\n\n### 의견\n${item.body}\n\n### 재현 조건\n- 배포 버전: \`${item.reproduction.gitSha?.slice(0, 7) ?? "등록 정보 없음"}\`\n- 배포 주소: ${item.reproduction.deploymentUrl ?? "등록 정보 없음"}\n- 페이지: \`${item.reproduction.pathname}\`\n- 화면 크기: ${item.reproduction.viewport.width} × ${item.reproduction.viewport.height}\n- 스크롤: x ${item.reproduction.scroll.x}, y ${item.reproduction.scroll.y}\n\n### 수정 위치\n- 표시 방식: ${item.target.kind === "area" ? "영역 선택" : "핀"}\n- 픽셀 좌표: x ${item.target.cssRect.x}, y ${item.target.cssRect.y}, width ${item.target.cssRect.width}, height ${item.target.cssRect.height}\n- 화면 비율: x ${Math.round(item.target.normalizedRect.x * 100)}%, y ${Math.round(item.target.normalizedRect.y * 100)}%, width ${Math.round(item.target.normalizedRect.width * 100)}%, height ${Math.round(item.target.normalizedRect.height * 100)}%\n${item.target.dataQaId ? `- 대상 식별자: \`${item.target.dataQaId}\`\n` : ""}- 위치 안내: \`${item.visualGuide.fileName}\`\n\n### QA 재현 링크\n${item.reproduction.qaUrl}\n`).join("\n---\n\n")}`;
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function QaHistory() {
  const projectSlug = process.env.NEXT_PUBLIC_QA_PROJECT_SLUG ?? "knud-exhibition";
  const [comments, setComments] = useState<HistoryComment[]>([]);
  const [status, setStatus] = useState<"all" | QaStatus>("all");
  const [deploymentId, setDeploymentId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"markdown" | "json">("markdown");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const response = await fetch(`/api/qa-history?${new URLSearchParams({ projectSlug })}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "QA 기록을 불러오지 못했습니다.");
      setComments(result.comments ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "QA 기록을 불러오지 못했습니다."); setComments([]);
    } finally { setIsLoading(false); }
  }, [projectSlug]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const deployments = useMemo(() => [...new Map(comments.filter((comment) => comment.deployment).map((comment) => [comment.deployment_id, comment.deployment!])).values()], [comments]);
  const visibleComments = comments.filter((comment) => (status === "all" || comment.status === status) && (deploymentId === "all" || comment.deployment_id === deploymentId));
  const selectedComments = comments.filter((comment) => selectedIds.includes(comment.id));
  const isAllVisibleSelected = visibleComments.length > 0 && visibleComments.every((comment) => selectedIds.includes(comment.id));
  const payload = selectedComments.length ? exportPayload(selectedComments) : [];
  const markdown = selectedComments.length ? exportMarkdown(selectedComments) : "";

  const toggleComment = (id: string) =>
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= 5 ? current : [...current, id];
    });
  const toggleAllVisible = () => setSelectedIds((current) => isAllVisibleSelected ? current.filter((id) => !visibleComments.some((comment) => comment.id === id)) : [...new Set([...current, ...visibleComments.map((comment) => comment.id)])].slice(0, 5));
  const openComment = (comment: HistoryComment) => {
    const params = new URLSearchParams({ comment: comment.id, deployment: comment.deployment_id, route: comment.pathname, viewport: String(comment.viewport_width) });
    window.location.assign(`/?${params}`);
  };
  const copyExport = async () => {
    const content = exportFormat === "markdown" ? markdown : JSON.stringify({ exportedAt: new Date().toISOString(), comments: payload }, null, 2);
    await navigator.clipboard.writeText(content);
    setCopyStatus("클립보드에 복사했습니다.");
  };
  const downloadExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (exportFormat === "markdown") downloadFile(`knud-qa-export-${stamp}.md`, markdown, "text/markdown;charset=utf-8");
    else downloadFile(`knud-qa-export-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), comments: payload }, null, 2), "application/json;charset=utf-8");
    payload.forEach((item) => downloadFile(item.visualGuide.fileName, item.visualGuide.svg, "image/svg+xml;charset=utf-8"));
    setCopyStatus("내보내기 파일과 위치 안내 SVG를 다운로드했습니다.");
  };

  return <main className="qa-history-page">
    <header className="qa-history-header"><button type="button" onClick={() => window.location.assign("/")}><ArrowLeft /> 검수 화면으로</button><span>KNUD DESIGN QA HUB</span></header>
    <section className="qa-history-content">
      <div className="qa-history-title"><div><p>검수 기록</p><h1>전체 QA 목록</h1><span>남겨진 모든 의견을 버전별로 보관하고 다시 확인할 수 있습니다.</span></div><div className="qa-history-count"><small>전체 의견</small><strong>{comments.length}</strong></div></div>
      <div className="qa-history-filters"><span><FunnelSimple /> 보기</span><select value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} aria-label="버전별 보기"><option value="all">모든 버전</option>{deployments.map((deployment) => <option key={deployment.id} value={deployment.id}>{deployment.git_sha.slice(0, 7)} · {deployment.deployed_at ? relativeTime(deployment.deployed_at) : "등록 시각 없음"}</option>)}</select><div className="qa-history-statuses" aria-label="상태별 보기">{(["all", "open", "in_progress", "review_requested", "done"] as const).map((value) => <button key={value} type="button" className={status === value ? "is-selected" : ""} onClick={() => setStatus(value)}>{value === "all" ? "전체" : statusLabel[value]}</button>)}</div></div>
      {!isLoading && !error && visibleComments.length > 0 && <div className="qa-export-bar"><label><input type="checkbox" checked={isAllVisibleSelected} onChange={toggleAllVisible} /> <span>현재 목록 전체 선택</span></label><span>{selectedIds.length}개 선택됨 <small>최대 5개</small></span><button type="button" disabled={selectedIds.length === 0} onClick={() => { setCopyStatus(null); setIsExportOpen(true); }}><Export /> 수정 Agent용 내보내기</button></div>}
      <div className="qa-history-list">
        {isLoading && <p className="qa-history-empty">검수 기록을 불러오는 중입니다.</p>}
        {!isLoading && error && <p className="qa-history-empty is-error">{error}</p>}
        {!isLoading && !error && visibleComments.length === 0 && <p className="qa-history-empty">조건에 맞는 검수 의견이 없습니다.</p>}
        {!isLoading && !error && visibleComments.map((comment) => <div className={`qa-history-row ${selectedIds.includes(comment.id) ? "is-selected" : ""}`} key={comment.id}><label className="qa-history-row__check"><input type="checkbox" checked={selectedIds.includes(comment.id)} onChange={() => toggleComment(comment.id)} aria-label={`${comment.body} 선택`} /></label><button className="qa-history-item" type="button" onClick={() => openComment(comment)}><span className={`qa-history-item__priority is-${comment.priority}`} aria-label={`우선순위 ${priorityLabel[comment.priority]}`} /><span className="qa-history-item__main"><b>{comment.body}</b><small>{authorName(comment.author)} · {comment.pathname} · {comment.viewport_width} × {comment.viewport_height} · {relativeTime(comment.created_at)}</small></span><span className="qa-history-item__version"><code>{comment.deployment?.git_sha.slice(0, 7) ?? "등록된 버전 없음"}</code><em className={`is-${comment.status}`}>{statusLabel[comment.status]}</em></span><CaretRight aria-hidden="true" /></button></div>)}
      </div>
    </section>
    {isExportOpen && <div className="qa-export-modal-backdrop" role="presentation" onMouseDown={() => setIsExportOpen(false)}><section className="qa-export-modal" role="dialog" aria-modal="true" aria-label="수정 Agent용 의견 내보내기" onMouseDown={(event) => event.stopPropagation()}><header><div><span>수정 Agent용 작업 묶음</span><h2>{selectedComments.length}개 의견 내보내기</h2></div><button type="button" onClick={() => setIsExportOpen(false)} aria-label="내보내기 창 닫기"><X /></button></header><p>버전·화면 크기·위치·재현 링크와 SVG 위치 안내를 함께 전달합니다. 수정 후에는 자동 완료하지 말고 검토 요청으로 남겨 주세요.</p><div className="qa-export-modal__formats"><button type="button" className={exportFormat === "markdown" ? "is-selected" : ""} onClick={() => setExportFormat("markdown")}><Copy /> Agent용 Markdown<small>바로 붙여 넣기</small></button><button type="button" className={exportFormat === "json" ? "is-selected" : ""} onClick={() => setExportFormat("json")}><FileCode /> JSON<small>자동 연결용</small></button></div><div className="qa-export-modal__items">{selectedComments.map((comment, index) => <div key={comment.id}><b>QA-{String(index + 1).padStart(3, "0")}</b><span>{comment.body}</span></div>)}</div>{copyStatus && <p className="qa-export-modal__notice">{copyStatus}</p>}<footer><button type="button" onClick={() => void copyExport()}><Copy /> 복사</button><button className="primary" type="button" onClick={downloadExport}><DownloadSimple /> 다운로드</button></footer></section></div>}
  </main>;
}
