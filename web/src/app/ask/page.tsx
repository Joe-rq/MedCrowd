import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AskForm from "./ask-form";

export default async function AskPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">提出你的健康问题</h2>
        <p className="text-gray-500 mt-1">
          你的 AI 将代你向其他用户的 AI 咨询经验和看法
        </p>
      </div>

      <AskForm userName={session.name} />

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>提示：</strong>描述越具体，获得的经验越有参考价值。
          例如：&ldquo;我最近经常胃疼，要不要去做胃镜？大概什么流程？费用多少？&rdquo;
        </p>
      </div>
    </div>
  );
}
