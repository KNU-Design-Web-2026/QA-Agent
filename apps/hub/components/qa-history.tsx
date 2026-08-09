"use client";

import { ArrowLeft, CaretRight, FunnelSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type QaStatus = "open" | "in_progress" | "review_requested" | "done";
type HistoryComment = {
  id: string;
  body: string;
  priority: "low" | "medium" | "high" | "blocker";
  status: QaStatus;
  pathname: string;
  viewport_width: number;
  viewport_height: number;
  created_at: string;
  deployment_id: string;
  deployment: { id: string; immutable_url: string; git_sha: string; deployed_at: string | null } | null;
  author: { display_name: string | null; email: string } | null;
};

const statusLabel: Record<QaStatus, string> = {
  open: "열림",
  in_progress: "진행 중",
  review_requested: "검토 요청",
  done: "완료",
};
const priorityLabel: Record<HistoryComment["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  blocker: "Blocker",
};

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

export function QaHistory() {
  const projectSlug = process.env.NEXT_PUBLIC_QA_PROJECT_SLUG ?? "knud-exhibition";
  const [comments, setComments] = useState<HistoryComment[]>([]);
  const [status, setStatus] = useState<"all" | QaStatus>("all");
  const [deploymentId, setDeploymentId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/qa-history?${new URLSearchParams({ projectSlug })}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "QA 기록을 불러오지 못했습니다.");
      setComments(result.comments ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "QA 기록을 불러오지 못했습니다.");
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const deployments = useMemo(
    () =>
      [...new Map(comments.filter((comment) => comment.deployment).map((comment) => [comment.deployment_id, comment.deployment!])).values()],
    [comments],
  );
  const visibleComments = comments.filter(
    (comment) =>
      (status === "all" || comment.status === status) &&
      (deploymentId === "all" || comment.deployment_id === deploymentId),
  );
  const openComment = (comment: HistoryComment) => {
    const params = new URLSearchParams({
      comment: comment.id,
      deployment: comment.deployment_id,
      route: comment.pathname,
      viewport: String(comment.viewport_width),
    });
    window.location.assign(`/?${params}`);
  };

  return (
    <main className="qa-history-page">
      <header className="qa-history-header">
        <button type="button" onClick={() => window.location.assign("/")}>
          <ArrowLeft /> 검수 화면으로
        </button>
        <span>KNUD DESIGN QA HUB</span>
      </header>
      <section className="qa-history-content">
        <div className="qa-history-title">
          <div>
            <p>검수 기록</p>
            <h1>전체 QA 목록</h1>
            <span>남겨진 모든 의견을 버전별로 보관하고 다시 확인할 수 있습니다.</span>
          </div>
          <div className="qa-history-count">
            <small>전체 의견</small>
            <strong>{comments.length}</strong>
          </div>
        </div>
        <div className="qa-history-filters">
          <span><FunnelSimple /> 보기</span>
          <select value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} aria-label="버전별 보기">
            <option value="all">모든 버전</option>
            {deployments.map((deployment) => (
              <option key={deployment.id} value={deployment.id}>
                {deployment.git_sha.slice(0, 7)} · {deployment.deployed_at ? relativeTime(deployment.deployed_at) : "등록 시각 없음"}
              </option>
            ))}
          </select>
          <div className="qa-history-statuses" aria-label="상태별 보기">
            {(["all", "open", "in_progress", "review_requested", "done"] as const).map((value) => (
              <button key={value} type="button" className={status === value ? "is-selected" : ""} onClick={() => setStatus(value)}>
                {value === "all" ? "전체" : statusLabel[value]}
              </button>
            ))}
          </div>
        </div>
        <div className="qa-history-list">
          {isLoading && <p className="qa-history-empty">검수 기록을 불러오는 중입니다.</p>}
          {!isLoading && error && <p className="qa-history-empty is-error">{error}</p>}
          {!isLoading && !error && visibleComments.length === 0 && <p className="qa-history-empty">조건에 맞는 검수 의견이 없습니다.</p>}
          {!isLoading && !error && visibleComments.map((comment) => (
            <button className="qa-history-item" type="button" key={comment.id} onClick={() => openComment(comment)}>
              <span className={`qa-history-item__priority is-${comment.priority}`} aria-label={`우선순위 ${priorityLabel[comment.priority]}`} />
              <span className="qa-history-item__main">
                <b>{comment.body}</b>
                <small>{authorName(comment.author)} · {comment.pathname} · {comment.viewport_width} × {comment.viewport_height} · {relativeTime(comment.created_at)}</small>
              </span>
              <span className="qa-history-item__version">
                <code>{comment.deployment?.git_sha.slice(0, 7) ?? "등록된 버전 없음"}</code>
                <em className={`is-${comment.status}`}>{statusLabel[comment.status]}</em>
              </span>
              <CaretRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
