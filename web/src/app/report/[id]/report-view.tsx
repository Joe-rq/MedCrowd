"use client";

import { useState, useEffect } from "react";
import {
  emitWeeklyReportOpened,
  emitReportShared,
} from "@/lib/analytics/health-events";
import FeedbackWidget from "@/components/feedback-widget";

interface Consultation {
  id: string;
  question: string;
  status: string;
  agentCount: number;
  summary: {
    consensus?: { point: string; agentCount: number; totalAgents: number }[];
    divergence?: { pointA: string; pointB: string; splitRatio: string }[];
    preparation?: string[];
    needDoctorConfirm?: string[];
    costRange?: { min: number; max: number; note: string };
    riskWarning?: string;
    agentResponses?: { agentId: string; summary: string; keyPoints: string[] }[];
    noExperienceCount?: number;
    totalAgentsQueried?: number;
  } | null;
}

interface AgentResponse {
  id: string;
  rawResponse: string;
  isValid: boolean;
  invalidReason?: string;
  latencyMs: number;
}

const POLL_INTERVAL = 2000;
const PENDING_STATUSES = ["PENDING", "CONSULTING"];

const PROGRESS_MESSAGES = [
  "正在分诊分析...",
  "正在咨询其他 AI...",
  "正在验证回复质量...",
  "正在生成报告...",
];

export default function ReportView({
  consultation: initialConsultation,
  responses: initialResponses,
  shareBaseUrl,
  userId,
}: {
  consultation: Consultation;
  responses: AgentResponse[];
  shareBaseUrl: string;
  userId: string;
}) {
  const [consultation, setConsultation] = useState(initialConsultation);
  const [responses, setResponses] = useState(initialResponses);
  const [copied, setCopied] = useState(false);
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0]);

  const isPolling = PENDING_STATUSES.includes(consultation.status);

  // SSE streaming with polling fallback
  useEffect(() => {
    if (!isPolling) return;

    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function startPolling() {
      if (cancelled || pollInterval) return;
      pollInterval = setInterval(async () => {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/consultation/${consultation.id}`);
          if (!res.ok) return;
          const data = await res.json();
          setConsultation(data.consultation);
          setResponses(data.responses);
        } catch {
          // Retry on next interval
        }
      }, POLL_INTERVAL);
    }

    // Try SSE first
    try {
      eventSource = new EventSource(`/api/consultation/${consultation.id}/stream`);

      eventSource.addEventListener("agent:query_start", () => {
        setProgressMessage("正在咨询其他 AI...");
      });

      eventSource.addEventListener("agent:response", (e) => {
        try {
          const data = JSON.parse(e.data);
          setProgressMessage(`已收到 Agent 回复 (${data.latencyMs}ms)...`);
        } catch {
          setProgressMessage("正在收集回复...");
        }
      });

      eventSource.addEventListener("validation:complete", (e) => {
        try {
          const data = JSON.parse(e.data);
          setProgressMessage(`已验证 ${data.validCount}/${data.totalCount} 个回复...`);
        } catch {
          setProgressMessage("正在验证回复质量...");
        }
      });

      eventSource.addEventListener("reaction:start", () => {
        setProgressMessage("正在进行互评讨论...");
      });

      eventSource.addEventListener("summary:ready", () => {
        setProgressMessage("报告已生成，正在加载...");
      });

      eventSource.addEventListener("done", async () => {
        // Fetch final data
        try {
          const res = await fetch(`/api/consultation/${consultation.id}`);
          if (res.ok) {
            const data = await res.json();
            setConsultation(data.consultation);
            setResponses(data.responses);
          }
        } catch {
          // Will show whatever state we have
        }
        eventSource?.close();
      });

      eventSource.onerror = () => {
        // SSE failed, fall back to polling
        eventSource?.close();
        eventSource = null;
        startPolling();
      };
    } catch {
      // SSE not supported, use polling
      startPolling();
    }

    return () => {
      cancelled = true;
      eventSource?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isPolling, consultation.id]);

  const summary = consultation.summary;
  const validResponses = responses.filter((r) => r.isValid);
  const isPartial = consultation.status === "PARTIAL" || (summary && validResponses.length < 3);

  useEffect(() => {
    if (summary) {
      emitWeeklyReportOpened({
        userId,
        reportId: `report_${consultation.id}`,
        hasAnomaly: false,
        consultationId: consultation.id,
      });
    }
  }, [userId, consultation.id, summary]);

  function handleShare() {
    const url = `${shareBaseUrl}/share/${consultation.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      emitReportShared({
        userId,
        reportId: `report_${consultation.id}`,
        shareChannel: "copy_link",
        consultationId: consultation.id,
      });
    });
  }

  // Waiting state — consultation is still running
  if (isPolling) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50">
          <svg
            className="animate-spin h-8 w-8 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-900">众议进行中</p>
        <p className="text-sm text-gray-500 animate-pulse">
          {progressMessage}
        </p>
        <p className="text-xs text-gray-400 mt-4">
          通常需要 15-30 秒，请耐心等待
        </p>
      </div>
    );
  }

  // Failed state
  if (consultation.status === "FAILED" && !summary) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          暂时无法获取咨询结果
        </h2>
        <p className="text-gray-500 mb-4">
          当前没有可用的 AI 代理，请稍后再试
        </p>
        <a
          href="/ask"
          className="text-emerald-600 hover:underline"
        >
          返回提问
        </a>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          暂时无法获取咨询结果
        </h2>
        <p className="text-gray-500 mb-4">
          当前没有可用的 AI 代理，请稍后再试
        </p>
        <a
          href="/ask"
          className="text-emerald-600 hover:underline"
        >
          返回提问
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Question */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">你的问题</p>
        <p className="text-gray-900">{consultation.question}</p>
      </div>

      {/* Status badge */}
      {isPartial && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          部分 AI 代理未能响应，以下结果基于{" "}
          {validResponses.length} 个有效回复生成
          {summary.noExperienceCount && summary.noExperienceCount > 0
            ? `（其中 ${summary.noExperienceCount} 个表示无相关经验）`
            : ""}
        </div>
      )}

      {/* Consensus */}
      {summary.consensus && summary.consensus.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            共识观点
          </h3>
          <div className="space-y-2">
            {summary.consensus.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">
                  {c.agentCount}/{c.totalAgents}
                </span>
                <p className="text-gray-700 text-sm">{c.point}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divergence */}
      {summary.divergence && summary.divergence.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            分歧观点
          </h3>
          <div className="space-y-3">
            {summary.divergence.map((d, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
                    {d.splitRatio}
                  </span>
                </div>
                <p className="text-gray-700">
                  观点A: {d.pointA}
                </p>
                <p className="text-gray-700">
                  观点B: {d.pointB}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preparation */}
      {summary.preparation && summary.preparation.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            就医准备建议
          </h3>
          <ul className="space-y-1.5">
            {summary.preparation.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-emerald-500">•</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Need doctor confirm */}
      {summary.needDoctorConfirm && summary.needDoctorConfirm.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h3 className="font-semibold text-amber-900 mb-3">
            建议咨询医生确认
          </h3>
          <ul className="space-y-1.5">
            {summary.needDoctorConfirm.map((item, i) => (
              <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                <span>⚠️</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cost range */}
      {summary.costRange && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            费用参考
          </h3>
          <p className="text-sm text-gray-700">
            约 ¥{summary.costRange.min} - ¥{summary.costRange.max}
            {summary.costRange.note && (
              <span className="text-gray-500 ml-2">
                ({summary.costRange.note})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Agent responses */}
      {summary.agentResponses && summary.agentResponses.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            各 AI 代理回复摘要
          </h3>
          <div className="space-y-3">
            {summary.agentResponses.map((agent, i) => (
              <div key={i} className="border-l-2 border-emerald-200 pl-3">
                <p className="text-sm text-gray-700">{agent.summary}</p>
                {agent.keyPoints.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {agent.keyPoints.map((kp, j) => (
                      <span
                        key={j}
                        className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5"
                      >
                        {kp.slice(0, 30)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk warning */}
      <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-sm text-red-800">
        {summary.riskWarning ||
          "以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议、诊断或治疗方案。健康问题请务必咨询专业医疗机构和医生。"}
      </div>

      {/* Feedback */}
      <FeedbackWidget consultationId={consultation.id} />

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleShare}
          className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 px-4 rounded-lg font-medium transition-colors text-center"
        >
          {copied ? "链接已复制" : "分享报告"}
        </button>
        <a
          href="/ask"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors text-center"
        >
          继续提问
        </a>
      </div>
    </div>
  );
}
