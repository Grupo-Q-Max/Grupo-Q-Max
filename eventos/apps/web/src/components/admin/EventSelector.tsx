"use client";

import {
  ChevronDown,
} from "lucide-react";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type EventItem = {
  id: number;
  name: string;
  status: string;
};

type Props = {
  events: EventItem[];
  currentEventId: number;
};

export default function EventSelector({
  events,
  currentEventId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(
    eventId: string,
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      );

    params.set(
      "event",
      eventId,
    );

    router.push(
      `${pathname}?${params.toString()}`,
    );
  }

  return (
    <label className="relative flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/[0.08]">
      <span className="sr-only">Evento</span>
      <select
        value={currentEventId}
        onChange={(event) => handleChange(event.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-6 text-white outline-none font-medium"
      >
        {events.map((event) => (
          <option value={event.id} key={event.id} className="bg-[#0E1628] text-white">
            {event.name}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 text-slate-400" />
    </label>
  );
}
