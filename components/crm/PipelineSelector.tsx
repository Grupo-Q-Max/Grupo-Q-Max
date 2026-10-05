"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

export function PipelineSelector({ pipelines, currentPipelineId }: { pipelines: any[], currentPipelineId: string }) {
  const router = useRouter();

  return (
    <Select
      className="crm-pipeline-select"
      value={currentPipelineId}
      aria-label="Pipeline"
      onChange={(e) => {
        router.push(`/crm?pipelineId=${e.target.value}`);
      }}
    >
      {pipelines.map(p => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}
