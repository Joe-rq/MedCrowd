"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const QUICK_QUESTIONS = [
  "胃疼应该挂什么科？做胃镜是什么流程？",
  "体检报告哪些指标偏高需要重视？",
  "腰疼是看骨科还是康复科？",
  "孩子反复咳嗽要不要去医院？",
];

export default function AskForm({ userName }: { userName: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState<{ message: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBlocked(null);

    const trimmed = question.trim();
    if (trimmed.length < 5) {
      setError("请输入至少 5 个字的问题");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = await res.json();

      if (data.blocked) {
        setBlocked({ message: data.message });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "请求失败");
        setLoading(false);
        return;
      }

      // Navigate to report page
      router.push(`/report/${data.consultationId}`);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        你好，{userName}。请描述你的健康问题：
      </p>

      {blocked && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 whitespace-pre-line">{blocked.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：我最近经常头疼，需要做什么检查吗？"
          className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
          maxLength={500}
          disabled={loading}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">{question.length}/500</span>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>

        <button
          type="submit"
          disabled={loading || question.trim().length < 5}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
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
              正在向其他 AI 咨询中...
            </span>
          ) : (
            "开始众议"
          )}
        </button>
      </form>

      <div className="mt-6">
        <p className="text-sm text-gray-500 mb-2">快捷问题：</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              disabled={loading}
              className="text-sm bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-full px-3 py-1.5 text-gray-700 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
