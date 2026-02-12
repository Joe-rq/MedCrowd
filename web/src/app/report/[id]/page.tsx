import { getSession } from "@/lib/session";
import { getConsultation, getAgentResponses } from "@/lib/db";
import { buildShareUrl } from "@/lib/share-token";
import { redirect } from "next/navigation";
import ReportView from "./report-view";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const consultation = await getConsultation(id);

  if (!consultation || consultation.askerId !== session.userId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">咨询不存在</h2>
        <a href="/ask" className="text-emerald-600 hover:underline mt-2 inline-block">
          返回提问
        </a>
      </div>
    );
  }

  const responses = await getAgentResponses(id);

  return (
    <ReportView
      consultation={consultation}
      responses={responses}
      shareUrl={buildShareUrl(consultation.id)}
      userId={session.userId}
    />
  );
}
