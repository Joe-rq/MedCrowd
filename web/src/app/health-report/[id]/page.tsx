import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { createHealthMetricsOps } from "@/lib/db/health-metrics";
import { createJsonAdapter } from "@/lib/db/json-adapter";
import { createKvAdapter } from "@/lib/db/kv-adapter";
import { generateWeeklyReport } from "@/lib/health-report/generator";
import { HealthReportView } from "./report-view";

function getAdapter() {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const USE_JSON_MODE = process.env.DB_MODE === "json" || !REDIS_URL;
  return USE_JSON_MODE ? createJsonAdapter() : createKvAdapter();
}

function getCurrentWeekId(): string {
  return getWeekId(Date.now());
}

function getWeekId(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

interface HealthReportPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}

export default async function HealthReportPage({ params, searchParams }: HealthReportPageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const { week } = await searchParams;

  if (id !== "current" && id !== "latest") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-gray-900">报告不存在</h2>
          <p className="text-gray-500 mt-2">无法找到指定的健康报告</p>
          <Link
            href="/"
            className="mt-4 inline-block text-emerald-600 hover:underline"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const adapter = getAdapter();
  const healthOps = createHealthMetricsOps(adapter);

  const targetWeek = week || getCurrentWeekId();

  const { report, error } = await generateWeeklyReport(healthOps, {
    userId: session.userId,
    weekId: targetWeek,
  });

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">📝</div>
          <h2 className="text-xl font-bold text-gray-900">暂无数据</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            {error || "本周没有足够的数据生成报告。开始记录您的健康数据吧！"}
          </p>
          <div className="mt-6 space-y-2">
            <p className="text-sm text-gray-600">支持的指标类型：</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["体重", "BMI", "睡眠", "心率", "HRV"].map((metric) => (
                <span
                  key={metric}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full"
                >
                  {metric}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/"
            className="mt-6 inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-emerald-600 hover:text-emerald-700">
            众医议
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/ask"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              发起咨询
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <HealthReportView report={report} userId={session.userId} />
      </main>
    </div>
  );
}
