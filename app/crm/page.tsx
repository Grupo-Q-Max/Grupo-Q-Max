import { CrmBoardPage } from "@/components/crm/CrmBoardPage";

export const dynamic = "force-dynamic";

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { pipelineId } = await searchParams;
  return <CrmBoardPage pipelineId={typeof pipelineId === "string" ? pipelineId : undefined} />;
}
