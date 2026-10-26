"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function SorteioEventSelector({ 
  events, 
  currentEventId 
}: { 
  events: { id: number; name: string }[]; 
  currentEventId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select 
      value={currentEventId} 
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("event", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="cursor-pointer bg-transparent font-semibold text-ink-text focus:outline-none"
    >
      {events.map((e) => (
        <option key={e.id} value={e.id} className="text-text">
          {e.name}
        </option>
      ))}
    </select>
  );
}
