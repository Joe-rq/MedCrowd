import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { checkConsent } from "@/lib/db";
import ManualEntryForm from "./manual-entry-form";

const DEVICES = [
  { name: "Apple Health", icon: "🍎", available: false },
  { name: "Google Fit", icon: "💪", available: false },
  { name: "Withings", icon: "⌚", available: false },
  { name: "手动录入", icon: "✏️", available: true },
] as const;

export default async function HealthPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const consent = await checkConsent(session.userId);
  const hasConsent = consent.allowed;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">健康数据</h1>

      {/* 授权状态 */}
      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">数据授权</h2>
        {hasConsent ? (
          <p className="text-sm text-emerald-700 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            已授权 — 健康数据同步已开启
          </p>
        ) : (
          <div className="text-sm text-amber-700">
            <p>尚未授权健康数据同步。</p>
            <Link
              href="/settings/health-consent"
              className="inline-block mt-2 text-emerald-700 underline hover:text-emerald-900"
            >
              前往授权设置
            </Link>
          </div>
        )}
      </section>

      {/* 设备连接 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">设备连接</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEVICES.map((d) => (
            <div
              key={d.name}
              className={`rounded-lg border p-4 text-center ${
                d.available
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <div className="text-2xl mb-1">{d.icon}</div>
              <div className="text-sm font-medium text-gray-800">{d.name}</div>
              <div className="text-xs mt-1 text-gray-500">
                {d.available ? "可用" : "即将支持"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 手动录入 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">手动录入</h2>
        <ManualEntryForm hasConsent={hasConsent} />
      </section>
    </div>
  );
}
