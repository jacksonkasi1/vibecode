// ** import types
import type { Artifact, Execution } from "@repo/db";
import type {
  FileChange,
  TimelineItem,
  TimelineItemDetail,
} from "./execution-utils";

// ** import core packages
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// ** import apis
import { getAgentTasks, getExecutionEvents } from "@/rest-api/executions";

// ** import utils
import { deriveTimelineData, deriveFileChanges } from "./execution-utils";

export type ExecutionData = {
  isRunning: boolean;
  timelineItems: TimelineItem[];
  changes: FileChange[];
  selectedChangePath: string | null;
  setSelectedChangePath: (path: string | null) => void;
  selectedTimelineId: string | null;
  setSelectedTimelineId: (id: string | null) => void;
  selectedChange: FileChange | null;
  selectedTimelineItem: TimelineItem | null;
  selectedTimelineDetail: TimelineItemDetail | null;
  execution: Execution | null;
  previousExecution: Execution | null;
};

export function useExecutionData({
  execution,
  previousExecution,
  artifacts,
  previousArtifacts,
}: {
  execution: Execution | null;
  previousExecution: Execution | null;
  artifacts: Artifact[];
  previousArtifacts: Artifact[];
}): ExecutionData {
  const isRunning =
    execution?.status === "running" || execution?.status === "queued";
  const { data: eventsRes } = useQuery({
    queryKey: ["execution-events", execution?.id],
    queryFn: () => getExecutionEvents(execution!.id),
    enabled: !!execution?.id,
    refetchInterval: isRunning ? 2000 : false,
    staleTime: isRunning ? 1000 : Number.POSITIVE_INFINITY,
  });
  const { data: tasksRes } = useQuery({
    queryKey: ["agent-tasks", execution?.id],
    queryFn: () => getAgentTasks(execution!.id),
    enabled: !!execution?.id,
    refetchInterval: isRunning ? 3000 : false,
    staleTime: isRunning ? 1000 : Number.POSITIVE_INFINITY,
  });

  const events = eventsRes?.data ?? [];
  const tasks = tasksRes?.data ?? [];
  const timelineData = useMemo(
    () => deriveTimelineData(events, tasks),
    [events, tasks],
  );
  const timelineItems = timelineData.items;
  const changes = useMemo(
    () =>
      artifacts.length > 0
        ? deriveFileChanges(artifacts, previousArtifacts)
        : [],
    [artifacts, previousArtifacts],
  );

  const [selectedChangePath, setSelectedChangePath] = useState<string | null>(
    null,
  );
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(
    null,
  );

  const selectedChange =
    changes.find((change) => change.path === selectedChangePath) ||
    changes[0] ||
    null;

  const selectedTimelineItem =
    timelineItems.find((item) => item.id === selectedTimelineId) ||
    timelineItems[timelineItems.length - 1] ||
    null;

  const selectedTimelineDetail = selectedTimelineItem
    ? timelineData.details[selectedTimelineItem.id] || null
    : null;

  return {
    isRunning,
    timelineItems,
    changes,
    selectedChangePath,
    setSelectedChangePath,
    selectedTimelineId,
    setSelectedTimelineId,
    selectedChange,
    selectedTimelineItem,
    selectedTimelineDetail,
    execution,
    previousExecution,
  };
}
