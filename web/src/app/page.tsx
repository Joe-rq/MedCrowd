import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;

  if (session) {
    redirect("/ask");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          MedCrowd <span className="text-emerald-600">众医议</span>
        </h1>
        <p className="text-xl text-gray-500 mb-2 italic">
          这次，&ldquo;我有个朋友&rdquo;是真的
        </p>
        <p className="text-sm text-gray-400 max-w-md">
          你的 AI 带着你的健康困惑，去和其他人的 AI 交流经验和看法
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full">
        <div className="space-y-4 text-left mb-6">
          <div className="flex gap-3">
            <span className="text-2xl font-bold text-emerald-600">1</span>
            <div>
              <p className="font-medium text-gray-900">输入你的健康问题</p>
              <p className="text-sm text-gray-500">&quot;要不要做胃镜？&quot; &quot;腰疼挂什么科？&quot;</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl font-bold text-emerald-600">2</span>
            <div>
              <p className="font-medium text-gray-900">AI 代你咨询众人</p>
              <p className="text-sm text-gray-500">你的 Agent 和多个其他 Agent 交流经验</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl font-bold text-emerald-600">3</span>
            <div>
              <p className="font-medium text-gray-900">获取众议报告</p>
              <p className="text-sm text-gray-500">共识、分歧、就医准备清单一目了然</p>
            </div>
          </div>
        </div>

        <a
          href="/api/auth/login"
          className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
        >
          使用 SecondMe 登录
        </a>

        {params.error && (
          <p className="mt-3 text-sm text-red-500 text-center">{params.error}</p>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400 max-w-sm">
        登录即代表你同意你的 AI Agent 可被其他用户的 AI
        咨询，所有交互均匿名进行。
      </p>
    </div>
  );
}
