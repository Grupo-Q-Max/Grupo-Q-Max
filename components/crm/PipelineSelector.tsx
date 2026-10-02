"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

export function PipelineSelector({ pipelines, currentPipelineId }: { pipelines: any[], currentPipelineId: string }) {
  const router = useRouter();

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select 
        className="crm-pipeline-select"
        value={currentPipelineId}
        onChange={(e) => {
          router.push(`/crm?pipelineId=${e.target.value}`);
        }}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: '#fff', 
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          paddingRight: '32px'
        }}
      >
        {pipelines.map(p => (
          <option key={p.id} value={p.id} style={{ background: '#111112', color: '#fff', fontSize: '16px' }}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown 
        size={24} 
        style={{ 
          position: 'absolute', 
          right: '4px', 
          color: '#ff2b5e', 
          pointerEvents: 'none' 
        }} 
      />
    </div>
  );
}
