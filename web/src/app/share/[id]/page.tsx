import { getConsultation } from "@/lib/db";
import Link from "next/link";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consultation = await getConsultation(id);

  if (!consultation || !consultation.summary) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">报告不存在或已过期</h2>
        <Link href="/" className="text-emerald-600 hover:underline mt-2 inline-block">
          了解 MedCrowd
        </Link>
      </div>
    );
  }

  const summary = consultation.summary as {
    consensus?: { point: string; agentCount: number; totalAgents: number }[];
    preparation?: string[];
    riskWarning?: string;
    totalAgentsQueried?: number;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">MedCrowd 众议报告</h1>
        <p className="text-gray-500 mt-1">
          共 {summary.totalAgentsQueried || 0} 个 AI 参与了经验交流
        </p>
      </div>

      {/* Only show consensus and preparation (no raw responses) */}
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

      {/* CTA */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-600 mb-4">
          想看完整报告？登录 MedCrowd 查看所有 Agent 的详细回复。
        </p>
        <a
          href="/api/auth/login"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-6 rounded-lg font-medium transition-colors"
        >
          使用 SecondMe 登录
        </a>
      </div>

      {/* Disclaimer */}
      <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-sm text-red-800">
        {summary.riskWarning ||
          "以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议。"}
      </div>
    </div>
  );
}
