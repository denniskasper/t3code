import { useCallback } from "react";

import {
  type ModelSelection,
  type ProviderInteractionMode,
  type RuntimeMode,
} from "@t3tools/contracts";

import { useMobileActions } from "../connection/useMobileEnvironmentData";
import { useThreadSelection } from "./use-thread-selection";

export function useSelectedThreadCommands(input: {
  readonly refreshSelectedThreadGitStatus: (options?: {
    readonly quiet?: boolean;
    readonly cwd?: string | null;
  }) => Promise<unknown>;
}) {
  const actions = useMobileActions();
  const { refreshSelectedThreadGitStatus } = input;
  const { selectedThread } = useThreadSelection();

  const onRefresh = useCallback(async () => {
    if (selectedThread) {
      await refreshSelectedThreadGitStatus({ quiet: true });
    }
  }, [refreshSelectedThreadGitStatus, selectedThread]);

  const onUpdateThreadModelSelection = useCallback(
    async (modelSelection: ModelSelection) => {
      if (!selectedThread) {
        return;
      }

      await actions.threads.updateMetadata({
        environmentId: selectedThread.environmentId,
        input: {
          threadId: selectedThread.id,
          modelSelection,
        },
      });
    },
    [actions.threads, selectedThread],
  );

  const onUpdateThreadRuntimeMode = useCallback(
    async (runtimeMode: RuntimeMode) => {
      if (!selectedThread) {
        return;
      }

      await actions.threads.setRuntimeMode({
        environmentId: selectedThread.environmentId,
        input: {
          threadId: selectedThread.id,
          runtimeMode,
        },
      });
    },
    [actions.threads, selectedThread],
  );

  const onUpdateThreadInteractionMode = useCallback(
    async (interactionMode: ProviderInteractionMode) => {
      if (!selectedThread) {
        return;
      }

      await actions.threads.setInteractionMode({
        environmentId: selectedThread.environmentId,
        input: {
          threadId: selectedThread.id,
          interactionMode,
        },
      });
    },
    [actions.threads, selectedThread],
  );

  const onStopThread = useCallback(async () => {
    if (!selectedThread) {
      return;
    }

    if (
      selectedThread.session?.status !== "running" &&
      selectedThread.session?.status !== "starting"
    ) {
      return;
    }

    await actions.threads.interruptTurn({
      environmentId: selectedThread.environmentId,
      input: {
        threadId: selectedThread.id,
        ...(selectedThread.session?.activeTurnId
          ? { turnId: selectedThread.session.activeTurnId }
          : {}),
      },
    });
  }, [actions.threads, selectedThread]);

  const onRenameThread = useCallback(
    async (title: string) => {
      if (!selectedThread) {
        return;
      }

      const trimmed = title.trim();
      if (!trimmed || trimmed === selectedThread.title) {
        return;
      }

      await actions.threads.updateMetadata({
        environmentId: selectedThread.environmentId,
        input: {
          threadId: selectedThread.id,
          title: trimmed,
        },
      });
    },
    [actions.threads, selectedThread],
  );

  return {
    onRefresh,
    onUpdateThreadModelSelection,
    onUpdateThreadRuntimeMode,
    onUpdateThreadInteractionMode,
    onRenameThread,
    onStopThread,
  };
}
