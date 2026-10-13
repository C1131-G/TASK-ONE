"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";

import { saveProjectMilestonesAction } from "@/app/actions/projects";
import type { MilestoneRecord } from "@/components/workspace/milestone-dates";
import { withMilestoneDate } from "@/components/workspace/milestone-dates";
import type { TimelineMilestoneLane } from "@/components/workspace/workspace-timeline-types";

// Moves a milestone to another day. Like a task move it shows at once, is sent
// with the project's version and rolls back if the server refuses it. Saving
// replaces the project's whole list, so moves for one project are queued and
// each is built from the list the previous move produced.
export const useMilestoneReschedule = (
  lanes: readonly TimelineMilestoneLane[]
) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const knownVersions = useRef(new Map<string, number>());
  const latestLists = useRef(new Map<string, readonly MilestoneRecord[]>());
  const inFlight = useRef(new Map<string, number>());
  const queue = useRef<Promise<void> | null>(null);
  const [optimisticLanes, applyMove] = useOptimistic(
    lanes,
    (
      current,
      move: {
        readonly dueDate: string;
        readonly milestoneId: string;
        readonly projectId: string;
      }
    ) =>
      current.map((lane) =>
        lane.projectId === move.projectId
          ? {
              ...lane,
              allMilestones: withMilestoneDate(
                lane.allMilestones,
                move.milestoneId,
                move.dueDate
              ),
            }
          : lane
      )
  );

  const send = async (
    lane: TimelineMilestoneLane,
    name: string,
    list: readonly MilestoneRecord[],
    dueDate: string
  ) => {
    const expectedVersion = Math.max(
      lane.version,
      knownVersions.current.get(lane.projectId) ?? 0
    );
    const result = await saveProjectMilestonesAction({
      expectedVersion,
      idempotencyKey: crypto.randomUUID(),
      milestones: list.map(({ completed, dueDate: due, id, name: label }) => ({
        completed,
        dueDate: due,
        id,
        name: label,
      })),
      projectId: lane.projectId,
    });
    if (!result.ok) {
      latestLists.current.delete(lane.projectId);
      setError(result.error.message);
      setAnnouncement(`${name} was not moved. ${result.error.message}`);
      return;
    }
    knownVersions.current.set(lane.projectId, result.data.version);
    setError(null);
    setAnnouncement(`${name} moved to ${dueDate}.`);
    router.refresh();
  };

  const sendAfter = async (
    previous: Promise<void>,
    lane: TimelineMilestoneLane,
    name: string,
    list: readonly MilestoneRecord[],
    dueDate: string
  ) => {
    try {
      await previous;
    } catch {
      // The earlier move reported its own failure; this one still goes out.
    }
    await send(lane, name, list, dueDate);
  };

  const move = (
    lane: TimelineMilestoneLane,
    milestone: MilestoneRecord,
    dueDate: string
  ) => {
    if (milestone.dueDate === dueDate) {
      return;
    }
    const base = latestLists.current.get(lane.projectId) ?? lane.allMilestones;
    const list = withMilestoneDate(base, milestone.id, dueDate);
    latestLists.current.set(lane.projectId, list);
    inFlight.current.set(
      lane.projectId,
      (inFlight.current.get(lane.projectId) ?? 0) + 1
    );
    startTransition(async () => {
      applyMove({
        dueDate,
        milestoneId: milestone.id,
        projectId: lane.projectId,
      });
      const run = sendAfter(
        queue.current ?? Promise.resolve(),
        lane,
        milestone.name,
        list,
        dueDate
      );
      queue.current = run;
      await run;
      const left = (inFlight.current.get(lane.projectId) ?? 1) - 1;
      inFlight.current.set(lane.projectId, left);
      if (left === 0) {
        latestLists.current.delete(lane.projectId);
      }
    });
  };

  return { announcement, error, lanes: optimisticLanes, move, pending };
};
