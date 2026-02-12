"use client";

import { useState, useEffect } from "react";

interface FeedbackData {
  vote: "helpful" | "not_helpful";
  comment?: string;
}

export default function FeedbackWidget({
  consultationId,
}: {
  consultationId: string;
}) {
  const [existing, setExisting] = useState<FeedbackData | null>(null);
  const [vote, setVote] = useState<"helpful" | "not_helpful" | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/consultation/${consultationId}/feedback`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.vote) {
          setExisting(data);
          setVote(data.vote);
          setSubmitted(true);
        }
      })
      .finally(() => setLoading(false));
  }, [consultationId]);

  async function handleSubmit() {
    if (!vote || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/consultation/${consultationId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote, comment: comment || undefined }),
        }
      );
      if (res.ok) {
        setSubmitted(true);
        setExisting({ vote, comment: comment || undefined });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-600 mb-3">
        {submitted ? "感谢反馈" : "这份报告对你有帮助吗？"}
      </p>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => !submitted && setVote("helpful")}
          disabled={submitted}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            vote === "helpful"
              ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
              : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
          } ${submitted ? "cursor-default" : "cursor-pointer"}`}
        >
          👍 有帮助
        </button>
        <button
          onClick={() => !submitted && setVote("not_helpful")}
          disabled={submitted}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            vote === "not_helpful"
              ? "bg-red-100 text-red-700 border border-red-300"
              : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
          } ${submitted ? "cursor-default" : "cursor-pointer"}`}
        >
          👎 没帮助
        </button>
      </div>
      {!submitted && vote && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="补充说明（可选）"
            maxLength={500}
            rows={2}
            className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 placeholder-gray-400 resize-none mb-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交反馈"}
          </button>
        </>
      )}
      {submitted && existing?.comment && (
        <p className="text-xs text-gray-400 mt-1">
          你的留言：{existing.comment}
        </p>
      )}
    </div>
  );
}
