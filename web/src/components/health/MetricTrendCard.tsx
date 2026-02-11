"use client";

import type { MetricTrend } from "@/lib/health-report/types";

interface MetricTrendCardProps {
  trend: MetricTrend;
}

function TrendArrow({ direction }: { direction: string }) {
  const arrows: Record<string, string> = {
    up: "↑",
    down: "↓",
    stable: "→",
    insufficient_data: "—",
  };
  const colors: Record<string, string> = {
    up: "text-amber-600",
    down: "text-emerald-600",
    stable: "text-gray-500",
    insufficient_data: "text-gray-400",
  };
  return (
    <span className={`text-lg font-bold ${colors[direction] || colors.insufficient_data}`}>
      {arrows[direction] || "—"}
    </span>
  );
}

function TrendBadge({ direction, percentage }: { direction: string; percentage: number }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    up: { bg: "bg-amber-100", text: "text-amber-800", label: "上升" },
    down: { bg: "bg-emerald-100", text: "text-emerald-800", label: "下降" },
    stable: { bg: "bg-gray-100", text: "text-gray-700", label: "稳定" },
    insufficient_data: { bg: "bg-gray-50", text: "text-gray-500", label: "数据不足" },
  };
  const config = configs[direction] || configs.insufficient_data;
  const percentText = direction === "insufficient_data" ? "" : ` ${Math.abs(percentage).toFixed(1)}%`;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
      {percentText}
    </span>
  );
}

export function MetricTrendCard({ trend }: MetricTrendCardProps) {
  const { metricLabel, unit, currentWeek, previousWeek, trend: trendInfo, baseline } = trend;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">{metricLabel}</h4>
        <TrendArrow direction={trendInfo.direction} />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">
            {currentWeek.avg.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500">{unit}</span>
        </div>

        <div className="flex items-center gap-2">
          <TrendBadge direction={trendInfo.direction} percentage={trendInfo.percentageChange} />
          {previousWeek && (
            <span className="text-xs text-gray-500">
              上周: {previousWeek.avg.toFixed(1)} {unit}
            </span>
          )}
        </div>

        {baseline && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">个人基线</span>
              <span className="text-gray-700">{baseline.value.toFixed(1)} {unit}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-500">对比基线</span>
              <span
                className={`font-medium ${
                  baseline.comparison === "within"
                    ? "text-emerald-600"
                    : baseline.comparison === "above"
                    ? "text-amber-600"
                    : "text-blue-600"
                }`}
              >
                {baseline.comparison === "within"
                  ? "在范围内"
                  : baseline.comparison === "above"
                  ? "高于基线"
                  : "低于基线"}
              </span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>本周记录</span>
            <span>{currentWeek.count} 天</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
            <span>波动范围</span>
            <span>
              {currentWeek.min.toFixed(1)} - {currentWeek.max.toFixed(1)} {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
