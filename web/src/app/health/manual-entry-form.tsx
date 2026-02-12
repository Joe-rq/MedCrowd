"use client";

import { useState } from "react";

const METRICS = [
  { value: "weight", label: "体重", unit: "kg" },
  { value: "bmi", label: "BMI", unit: "" },
  { value: "sleep", label: "睡眠时长", unit: "h" },
  { value: "heartRate", label: "心率", unit: "bpm" },
  { value: "hrv", label: "HRV", unit: "ms" },
] as const;

type MetricValue = (typeof METRICS)[number]["value"];

export default function ManualEntryForm({ hasConsent }: { hasConsent: boolean }) {
  const [metricType, setMetricType] = useState<MetricValue>("weight");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const selected = METRICS.find((m) => m.value === metricType)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/health/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricType,
          source: "manual_entry",
          data: { value: Number(value), unit: selected.unit },
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatus("success");
        setMessage("录入成功");
        setValue("");
      } else {
        setStatus("error");
        setMessage(json.error || "录入失败");
      }
    } catch {
      setStatus("error");
      setMessage("网络错误，请重试");
    }
  }

  if (!hasConsent) {
    return (
      <p className="text-sm text-gray-500 border rounded-lg p-4">
        请先完成健康数据授权后再录入数据。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4">
      <div className="flex gap-3">
        <select
          value={metricType}
          onChange={(e) => {
            setMetricType(e.target.value as MetricValue);
            setStatus("idle");
          }}
          className="border rounded px-3 py-2 text-sm bg-white"
        >
          {METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}{m.unit ? ` (${m.unit})` : ""}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="number"
            step="any"
            min="0"
            value={value}
            onChange={(e) => { setValue(e.target.value); setStatus("idle"); }}
            placeholder="输入数值"
            className="border rounded px-3 py-2 text-sm w-full"
            required
          />
          {selected.unit && (
            <span className="text-sm text-gray-500 shrink-0">{selected.unit}</span>
          )}
        </div>

        <button
          type="submit"
          disabled={status === "loading" || !value}
          className="bg-emerald-600 text-white text-sm px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {status === "loading" ? "提交中…" : "提交"}
        </button>
      </div>

      {status === "success" && (
        <p className="text-sm text-emerald-600">{message}</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600">{message}</p>
      )}
    </form>
  );
}
