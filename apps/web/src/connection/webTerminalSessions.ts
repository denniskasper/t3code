import {
  combineTerminalSessionState,
  EMPTY_TERMINAL_BUFFER_STATE,
  EMPTY_TERMINAL_SESSION_STATE,
  type KnownTerminalSession,
  type TerminalSessionState,
} from "@t3tools/client-runtime";
import { ThreadId, type EnvironmentId, type TerminalAttachInput } from "@t3tools/contracts";
import { useCallback, useMemo } from "react";

import {
  useWebActions,
  useWebTerminalAttach,
  useWebTerminalMetadata,
} from "./useWebEnvironmentData";

export function useWebAttachedTerminalSession(input: {
  readonly environmentId: EnvironmentId | null;
  readonly terminal: TerminalAttachInput | null;
}): TerminalSessionState {
  const attach = useWebTerminalAttach(
    input.environmentId !== null && input.terminal !== null
      ? {
          environmentId: input.environmentId,
          input: input.terminal,
        }
      : null,
  );
  const metadata = useWebTerminalMetadata(input.environmentId);

  return useMemo(() => {
    if (input.environmentId === null || input.terminal === null) {
      return EMPTY_TERMINAL_SESSION_STATE;
    }
    const summary =
      metadata.data?.find(
        (terminal) =>
          terminal.threadId === input.terminal?.threadId &&
          terminal.terminalId === input.terminal?.terminalId,
      ) ?? null;
    const state = combineTerminalSessionState(summary, attach.data ?? EMPTY_TERMINAL_BUFFER_STATE);
    return attach.error === null ? state : { ...state, error: attach.error, status: "error" };
  }, [attach.data, attach.error, input.environmentId, input.terminal, metadata.data]);
}

export function useWebKnownTerminalSessions(input: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}): ReadonlyArray<KnownTerminalSession> {
  const metadata = useWebTerminalMetadata(input.environmentId);
  return useMemo(() => {
    if (input.environmentId === null) {
      return [];
    }
    return (metadata.data ?? [])
      .filter((summary) => input.threadId === null || summary.threadId === input.threadId)
      .map((summary) => ({
        target: {
          environmentId: input.environmentId!,
          threadId: ThreadId.make(summary.threadId),
          terminalId: summary.terminalId,
        },
        state: combineTerminalSessionState(summary, EMPTY_TERMINAL_BUFFER_STATE),
      }))
      .sort((left, right) =>
        left.target.terminalId.localeCompare(right.target.terminalId, undefined, {
          numeric: true,
        }),
      );
  }, [input.environmentId, input.threadId, metadata.data]);
}

export function useWebThreadRunningTerminalIds(input: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
}): ReadonlyArray<string> {
  return useWebKnownTerminalSessions(input)
    .filter((session) => session.state.status === "running")
    .map((session) => session.target.terminalId);
}

export function useWebTerminalController(input: {
  readonly environmentId: EnvironmentId;
  readonly terminal: TerminalAttachInput;
}) {
  const actions = useWebActions();
  const session = useWebAttachedTerminalSession(input);
  const { environmentId, terminal } = input;

  const write = useCallback(
    (data: string) =>
      actions.terminal.write({
        environmentId,
        input: {
          threadId: terminal.threadId,
          terminalId: terminal.terminalId,
          data,
        },
      }),
    [actions.terminal, environmentId, terminal.terminalId, terminal.threadId],
  );
  const resize = useCallback(
    (cols: number, rows: number) =>
      actions.terminal.resize({
        environmentId,
        input: {
          threadId: terminal.threadId,
          terminalId: terminal.terminalId,
          cols,
          rows,
        },
      }),
    [actions.terminal, environmentId, terminal.terminalId, terminal.threadId],
  );
  const clear = useCallback(
    () =>
      actions.terminal.clear({
        environmentId,
        input: {
          threadId: terminal.threadId,
          terminalId: terminal.terminalId,
        },
      }),
    [actions.terminal, environmentId, terminal.terminalId, terminal.threadId],
  );
  const restart = useCallback(() => {
    if (terminal.cwd === undefined || terminal.cols === undefined || terminal.rows === undefined) {
      return Promise.reject(
        new Error("Terminal restart requires the working directory and dimensions."),
      );
    }
    return actions.terminal.restart({
      environmentId,
      input: {
        threadId: terminal.threadId,
        terminalId: terminal.terminalId,
        cwd: terminal.cwd,
        cols: terminal.cols,
        rows: terminal.rows,
        ...(terminal.worktreePath !== undefined ? { worktreePath: terminal.worktreePath } : {}),
        ...(terminal.env !== undefined ? { env: terminal.env } : {}),
      },
    });
  }, [actions.terminal, environmentId, terminal]);
  const close = useCallback(
    (options?: { readonly deleteHistory?: boolean }) =>
      actions.terminal.close({
        environmentId,
        input: {
          threadId: terminal.threadId,
          terminalId: terminal.terminalId,
          ...(options?.deleteHistory ? { deleteHistory: true } : {}),
        },
      }),
    [actions.terminal, environmentId, terminal.terminalId, terminal.threadId],
  );

  return {
    session,
    write,
    resize,
    clear,
    restart,
    close,
  };
}
