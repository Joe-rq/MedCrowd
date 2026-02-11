"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { WeeklyHealthReport, AnomalyContext, NextWeekAdvice, Milestone } from "@/lib/health-report/types";
import { MetricTrendCard } from "@/components/health/MetricTrendCard";
import { emitWeeklyReportOpened, emitHealthQuestionSubmitted } from "@/lib/analytics/health-events";

interface HealthReportViewProps {
  report: WeeklyHealthReport;
  userId: string;
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyContext }) {
  const severityStyles: Record<string, { bg: string; border: string; title: string; icon: string }> = {
    mild: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      title: "text-blue-800",
      icon: "ℹ️",
    },
    moderate: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      title: "text-amber-800",
      icon: "⚠️",
    },
    attention: {
      bg: "bg-orange-50",
      border: "border-orange-200",
      title: "text-orange-800",
      icon: "🔍",
    },
  };

  const style = severityStyles[anomaly.severity] || severityStyles.mild;

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{style.icon}</span>
        <div className="flex-1">
          <h4 className={`font-semibold ${style.title} mb-1`}>
            {anomaly.metricLabel} - 注意到变化
          </h4>
          <p className="text-gray-700 text-sm mb-2">{anomaly.observation}</p>

          {anomaly.possibleFactors.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">可能相关因素：</p>
              <div className="flex flex-wrap gap-1">
                {anomaly.possibleFactors.map((factor) => (
                  <span
                    key={factor}
                    className="text-xs bg-white bg-opacity-60 text-gray-600 px-2 py-0.5 rounded"
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className={`text-sm font-medium ${style.title}`}>{anomaly.suggestion}</p>
        </div>
      </div>
    </div>
  );
}

function AdviceCard({ advice }: { advice: NextWeekAdvice }) {
  const categoryIcons: Record<string, string> = {
    continuation: "🌟",
    adjustment: "🔄",
    attention: "👀",
  };

  const categoryLabels: Record<string, string> = {
    continuation: "继续保持",
    adjustment: "适当调整",
    attention: "需要关注",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{categoryIcons[advice.category]}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide"
          >{categoryLabels[advice.category]}</span>
      </div>
      <h4 className="font-semibold text-gray-900 mb-2">{advice.title}</h4>
      <p className="text-gray-600 text-sm mb-3">{advice.description}</p>
      <ul className="space-y-1">
        {advice.actionableSteps.map((step) => (
          <li key={step} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-emerald-500 mt-0.5">✓</span>
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  const icons: Record<string, string> = {
    streak: "🔥",
    improvement: "📈",
    consistency: "✨",
    first_record: "📝",
  };

  return (
    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-full px-4 py-2">
      <span className="text-lg">{icons[milestone.type]}</span>
      <div className="text-left">
        <p className="text-sm font-semibold text-emerald-800">{milestone.title}</p>
        <p className="text-xs text-emerald-600">{milestone.description}</p>
      </div>
    </div>
  );
}

function ConsultationHandoff({
  handoff,
  userId,
  reportId,
}: {
  handoff: NonNullable<WeeklyHealthReport["consultationHandoff"]>;
  userId: string;
  reportId: string;
}) {
  function handleConsultClick() {
    emitHealthQuestionSubmitted({
      userId,
      questionHash: `health_report_${reportId}`,
      questionLength: handoff.suggestedQuestion.length,
      category: "general",
    });
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
      <div className="flex items-start gap-4">
        <div className="text-3xl">💬</div>
        <div className="flex-1">
          <h3 className="font-bold text-indigo-900 mb-2">想和其他用户交流？</h3>
          <p className="text-indigo-700 text-sm mb-3">{handoff.reason}</p>

          <div className="bg-white bg-opacity-60 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">您可以这样提问：</p>
            <p className="text-gray-800 text-sm italic">&ldquo;{handoff.suggestedQuestion}&rdquo;</p>
          </div>

          <Link
            href={`/ask?prefill=${encodeURIComponent(handoff.suggestedQuestion)}`}
            onClick={handleConsultClick}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            发起咨询
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="箭头">
              <title>箭头</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HealthReportView({ report, userId }: HealthReportViewProps) {
  useEffect(() => {
    emitWeeklyReportOpened({
      userId,
      reportId: report.id,
      hasAnomaly: report.anomalies.length > 0,
    });
  }, [userId, report.id, report.anomalies.length]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {report.milestones.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {report.milestones.map((milestone) => (
            <MilestoneBadge key={`${milestone.type}-${milestone.title}`} milestone={milestone} />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">本周健康数据摘要</h2>
            <p className="text-gray-500 text-sm">
              {formatDate(report.weekRange.startDate)} - {formatDate(report.weekRange.endDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">生成时间</p>
            <p className="text-sm text-gray-600">{formatDate(report.generatedAt)}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed">{report.narrative.summary}</p>
          <p className="text-emerald-700 font-medium mt-2">{report.narrative.highlight}</p>
        </div>
      </div>

      {report.metrics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">指标趋势</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.metrics.map((metric) => (
              <MetricTrendCard key={metric.metricType} trend={metric} />
            ))}
          </div>
        </div>
      )}

      {report.anomalies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">变化提示</h3>
          <div className="space-y-3">
            {report.anomalies.map((anomaly) => (
              <AnomalyCard key={anomaly.id} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {report.consultationHandoff && (
        <ConsultationHandoff
          handoff={report.consultationHandoff}
          userId={userId}
          reportId={report.id}
        />
      )}

      {report.nextWeekAdvice.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">下周建议</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.nextWeekAdvice.map((advice) => (
              <AdviceCard key={`${advice.category}-${advice.title}`} advice={advice} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-sm text-amber-800 leading-relaxed">{report.narrative.disclaimer}</p>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Link
          href="/ask"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-lg font-medium text-center transition-colors"
        >
          发起咨询
        </Link>
        <Link
          href="/"
          className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 px-4 rounded-lg font-medium text-center transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
