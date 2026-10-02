import { CrmBoardPage } from "@/components/crm/CrmBoardPage";

export const dynamic = "force-dynamic";

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  try {
    const { pipelineId } = await searchParams;
    const pid = typeof pipelineId === "string" ? pipelineId : undefined;
    
    // Call the async Server Component as a function so we can catch its error!
    const content = await CrmBoardPage({ pipelineId: pid });
    return content;
  } catch (error) {
    return (
      <div style={{ padding: '50px', background: '#ffebee', color: '#c62828', fontFamily: 'sans-serif' }}>
        <h1>ERRO 500 FATAL (Capturado para Debug)</h1>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fff', padding: '20px', borderRadius: '8px' }}>
          {String(error)}
          {error instanceof Error ? '\n\nSTACK:\n' + error.stack : ''}
        </pre>
      </div>
    );
  }
}
