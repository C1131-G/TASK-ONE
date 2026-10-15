import type { BugListItemSchema } from "@/src/server/work/bug-management";

type Sla = NonNullable<(typeof BugListItemSchema.Type)["sla"]>;
type SlaClock = Sla["firstResponse"];
type SlaState = SlaClock["state"];

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// Business minutes as "2d 4h", "3h 20m" or "45m". Days only from 24 hours up.
export const formatBusinessMinutes = (minutes: number): string => {
  const total = Math.max(0, Math.round(Math.abs(minutes)));
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const mins = total % MINUTES_PER_HOUR;
  if (hours >= HOURS_PER_DAY) {
    const days = Math.floor(hours / HOURS_PER_DAY);
    const restHours = hours % HOURS_PER_DAY;
    return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
};

export interface SlaChipModel {
  readonly clock: "firstResponse" | "resolution";
  readonly label: string;
  readonly sentence: string;
  readonly state: SlaState;
}

const OPEN_STATES = new Set<SlaState>(["ok", "warning", "breached"]);

// The first-response clock while it is open, otherwise the resolution clock.
// Done clocks (met/missed) are not shown on cards, so they give null.
export const slaChipModel = (sla: Sla | null): SlaChipModel | null => {
  if (!sla) {
    return null;
  }
  const clock: SlaChipModel["clock"] = OPEN_STATES.has(sla.firstResponse.state)
    ? "firstResponse"
    : "resolution";
  const { minutesLeft, state } = sla[clock];
  const noun = clock === "firstResponse" ? "response" : "resolution";
  const verb = clock === "firstResponse" ? "Respond in" : "Resolve in";
  if (state === "paused") {
    return {
      clock,
      label: "Paused",
      sentence: `The ${noun} clock is paused while waiting on the client`,
      state,
    };
  }
  if (!OPEN_STATES.has(state) || minutesLeft === null) {
    return null;
  }
  if (state === "breached" || minutesLeft < 0) {
    const text = formatBusinessMinutes(minutesLeft);
    return {
      clock,
      label: `Overdue ${text}`,
      sentence: `The ${noun} target is overdue by ${text} of business time`,
      state: "breached",
    };
  }
  const text = formatBusinessMinutes(minutesLeft);
  return {
    clock,
    label: `${verb} ${text}`,
    sentence: `${verb} ${text} of business time to meet the ${noun} target`,
    state,
  };
};

const dueFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
});

// "Met", "Missed", "Due Oct 15, 3:20 PM (3h 20m left)", "Breached ...", "Paused".
export const slaClockText = (clock: SlaClock): string => {
  const due = dueFormatter.format(new Date(clock.dueAt));
  const left = clock.minutesLeft;
  switch (clock.state) {
    case "met": {
      return `Met (was due ${due})`;
    }
    case "missed": {
      return `Missed (was due ${due})`;
    }
    case "paused": {
      return `Paused while waiting on the client (due ${due})`;
    }
    case "breached": {
      return left === null
        ? `Breached (was due ${due})`
        : `Breached, ${formatBusinessMinutes(left)} overdue (was due ${due})`;
    }
    default: {
      return left === null
        ? `Due ${due}`
        : `Due ${due} (${formatBusinessMinutes(left)} left${clock.state === "warning" ? ", running low" : ""})`;
    }
  }
};
