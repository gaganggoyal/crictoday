import {
  BadgeCheck,
  Ban,
  Bell,
  CalendarClock,
  CircleOff,
  DoorOpen,
  Lock,
  Ticket,
} from "lucide-react";
import { ATTENDANCE_COPY } from "@/lib/domain/ticket-state";
import type { AttendanceState } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const icons = {
  OFFICIAL_LINK: Ticket,
  AUTHORISED_PARTNER: BadgeCheck,
  REQUEST_ALERT: Bell,
  FREE_ENTRY: DoorOpen,
  SOLD_OUT: Ban,
  PRIVATE_EVENT: Lock,
  CANCELLED: CircleOff,
  POSTPONED: CalendarClock,
} satisfies Record<AttendanceState, typeof Ticket>;

export function TicketBadge({ state, className }: { state: AttendanceState; className?: string }) {
  const Icon = icons[state];
  const copy = ATTENDANCE_COPY[state];
  return (
    <span
      data-state={state}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
        state === "OFFICIAL_LINK" && "border-[#176B43] bg-[#176B43] text-white",
        state === "AUTHORISED_PARTNER" && "border-[#176B43] text-[#176B43] dark:text-[#8EE0B0]",
        state === "REQUEST_ALERT" && "border-line bg-surface text-foreground",
        state === "FREE_ENTRY" && "border-[#176B43]/40 bg-[#176B43]/10 text-foreground",
        state === "SOLD_OUT" && "border-line bg-background text-muted line-through decoration-2",
        state === "PRIVATE_EVENT" && "border-line bg-background text-foreground",
        state === "CANCELLED" && "border-[#8C2F1B] bg-[#8C2F1B] text-white no-underline",
        state === "POSTPONED" && "border-[#8A5A12] bg-[#8A5A12] text-white",
        className,
      )}
    >
      <Icon aria-hidden="true" size={14} />
      {copy.label}
    </span>
  );
}
