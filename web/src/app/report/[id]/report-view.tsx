"use client";

import { useState, useEffect } from "react";
import {
  emitWeeklyReportOpened,
  emitReportShared,
} from "@/lib/analytics/health-events";

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

export default function ReportView({
  consultation,
  responses,
  shareBaseUrl,
  userId,
}: {
  consultation: Consultation;
  responses: AgentResponse[];
  shareBaseUrl: string;
  userId: string;
}) {
  const [copied, setCopied] = useState(false);
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

  if (!summary) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">😔</div>
        <h2 className="text-xl font-bold text-gray-900">暂无法生成报告</h2>
        <p className="text-gray-500 mt-2">
          当前平台上的 Agent 较少，未能收集到足够的经验反馈。
          <br />
          随着更多用户加入，咨询效果会越来越好。
        </p>
        <a
          href="/ask"
          className="mt-4 inline-block text-emerald-600 hover:underline"
        >
          重新提问
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">众议报告</h2>
        <p className="text-gray-500 mt-1">
          共咨询 {summary.totalAgentsQueried || consultation.agentCount} 个 AI，
          {validResponses.length} 个有效回复
          {summary.noExperienceCount
            ? `，${summary.noExperienceCount} 个无相关经历`
            : ""}
        </p>
        {isPartial && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            结果不完整：有效回复数不足，报告仅供参考。
          </div>
        )}
      </div>

      {/* Original question */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">你的问题</p>
        <p className="text-gray-900">{consultation.question}</p>
      </div>

      {/* Consensus */}
      {summary.consensus && summary.consensus.length > 0 && (
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
          <h3 className="font-bold text-emerald-800 mb-3">共识观点</h3>
          <ul className="space-y-2">
            {summary.consensus.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold text-sm mt-0.5">
                  {c.agentCount}/{c.totalAgents}
                </span>
                <span className="text-gray-800">{c.point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Divergence */}
      {summary.divergence && summary.divergence.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="font-bold text-blue-800 mb-3">分歧观点</h3>
          <ul className="space-y-2">
            {summary.divergence.map((d, i) => (
              <li key={i} className="text-gray-800">
                <span className="text-blue-600">{d.pointA}</span>
                {" vs "}
                <span className="text-blue-600">{d.pointB}</span>
                <span className="text-sm text-gray-500 ml-2">({d.splitRatio})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preparation checklist */}
      {summary.preparation && summary.preparation.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800 mb-3">就医准备清单</h3>
          <ul className="space-y-1.5">
            {summary.preparation.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-700">
                <span className="text-gray-400">&#9744;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Need doctor confirm */}
      {summary.needDoctorConfirm && summary.needDoctorConfirm.length > 0 && (
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <h3 className="font-bold text-orange-800 mb-3">需医生确认</h3>
          <ul className="space-y-1.5">
            {summary.needDoctorConfirm.map((item, i) => (
              <li key={i} className="text-gray-700">
                &#8226; {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cost range */}
      {summary.costRange && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800 mb-2">费用参考</h3>
          <p className="text-gray-700">
            ¥{summary.costRange.min} - ¥{summary.costRange.max}
            {summary.costRange.note && (
              <span className="text-sm text-gray-500 ml-2">
                ({summary.costRange.note})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Individual agent responses */}
      {summary.agentResponses && summary.agentResponses.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-800 mb-3">各 Agent 回复详情</h3>
          <div className="space-y-3">
            {summary.agentResponses.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <p className="text-xs text-gray-400 mb-2">
                  Agent #{i + 1}（匿名）
                </p>
                <p className="text-gray-700 text-sm">{r.summary}</p>
                {r.keyPoints.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.keyPoints.map((kp, j) => (
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
