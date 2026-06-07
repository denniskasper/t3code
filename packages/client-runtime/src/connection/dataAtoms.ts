import { Atom } from "effect/unstable/reactivity";
import * as Stream from "effect/Stream";
import type { TerminalSummary } from "@t3tools/contracts";

import {
  createEnvironmentMutation,
  createEnvironmentQueryAtomFamily,
  createEnvironmentStreamMutation,
  createEnvironmentSubscriptionAtomFamily,
} from "./atoms.ts";
import type {
  ArchiveThreadInput,
  CreateProjectInput,
  CreateThreadInput,
  DeleteProjectInput,
  DeleteThreadInput,
  InterruptThreadTurnInput,
  RespondToThreadApprovalInput,
  RespondToThreadUserInputInput,
  RevertThreadCheckpointInput,
  SetThreadInteractionModeInput,
  SetThreadRuntimeModeInput,
  StartThreadTurnInput,
  StopThreadSessionInput,
  UnarchiveThreadInput,
  UpdateProjectInput,
  UpdateThreadMetadataInput,
} from "./commands.ts";
import type { EnvironmentRegistry } from "./registry.ts";
import type {
  EnvironmentCloudOperations,
  EnvironmentFilesystemOperations,
  EnvironmentGitOperations,
  EnvironmentOrchestrationOperations,
  EnvironmentProjectOperations,
  EnvironmentReviewOperations,
  EnvironmentServerOperations,
  EnvironmentShellOperations,
  EnvironmentSourceControlOperations,
  EnvironmentTerminalOperations,
  EnvironmentVcsOperations,
} from "./operations.ts";
import {
  applyTerminalAttachStreamEvent,
  applyTerminalMetadataStreamEvent,
  EMPTY_TERMINAL_BUFFER_STATE,
} from "../terminalSessionState.ts";
import { EMPTY_AUTH_ACCESS_SNAPSHOT, projectAuthAccessSnapshot } from "./authAccessSnapshot.ts";

type InputOf<Method> = Method extends (input: infer Input) => unknown ? Input : never;

export function createEnvironmentDataAtoms<R, ER>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, ER>,
) {
  const projectSearchEntriesAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:projects:search-entries",
    staleTimeMs: 15_000,
    execute: (operations, input: InputOf<EnvironmentProjectOperations["searchEntries"]>) =>
      operations.projects.searchEntries(input),
  });
  const filesystemBrowseAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:filesystem:browse",
    execute: (operations, input: InputOf<EnvironmentFilesystemOperations["browse"]>) =>
      operations.filesystem.browse(input),
  });
  const vcsListRefsAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:vcs:list-refs",
    staleTimeMs: 5_000,
    execute: (operations, input: InputOf<EnvironmentVcsOperations["listRefs"]>) =>
      operations.vcs.listRefs(input),
  });
  const vcsStatusAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:vcs:status",
    subscribe: (operations, input: InputOf<EnvironmentVcsOperations["status"]>) =>
      operations.vcs.status(input),
  });
  const reviewDiffPreviewAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:review:diff-preview",
    staleTimeMs: 5_000,
    execute: (operations, input: InputOf<EnvironmentReviewOperations["getDiffPreview"]>) =>
      operations.review.getDiffPreview(input),
  });
  const serverConfigAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:server:config",
    execute: (operations, _input: null) => operations.server.getConfig(),
  });
  const serverSettingsAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:server:settings",
    execute: (operations, _input: null) => operations.server.getSettings(),
  });
  const sourceControlDiscoveryAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:server:source-control-discovery",
    execute: (operations, _input: null) => operations.server.discoverSourceControl(),
  });
  const traceDiagnosticsAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:server:trace-diagnostics",
    execute: (operations, _input: null) => operations.server.getTraceDiagnostics(),
  });
  const processDiagnosticsAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:server:process-diagnostics",
    execute: (operations, _input: null) => operations.server.getProcessDiagnostics(),
  });
  const processResourceHistoryAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:server:process-resource-history",
    execute: (
      operations,
      input: InputOf<EnvironmentServerOperations["getProcessResourceHistory"]>,
    ) => operations.server.getProcessResourceHistory(input),
  });
  const relayClientStatusAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:cloud:relay-client-status",
    execute: (operations, _input: null) => operations.cloud.getRelayClientStatus(),
  });
  const sourceControlRepositoryAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:source-control:repository",
    execute: (operations, input: InputOf<EnvironmentSourceControlOperations["lookupRepository"]>) =>
      operations.sourceControl.lookupRepository(input),
  });
  const pullRequestResolutionAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:git:resolve-pull-request",
    execute: (operations, input: InputOf<EnvironmentGitOperations["resolvePullRequest"]>) =>
      operations.git.resolvePullRequest(input),
  });
  const turnDiffAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:orchestration:turn-diff",
    execute: (operations, input: InputOf<EnvironmentOrchestrationOperations["getTurnDiff"]>) =>
      operations.orchestration.getTurnDiff(input),
  });
  const fullThreadDiffAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:orchestration:full-thread-diff",
    execute: (
      operations,
      input: InputOf<EnvironmentOrchestrationOperations["getFullThreadDiff"]>,
    ) => operations.orchestration.getFullThreadDiff(input),
  });
  const archivedShellSnapshotAtom = createEnvironmentQueryAtomFamily(runtime, {
    label: "environment-data:orchestration:archived-shell-snapshot",
    execute: (operations, _input: null) => operations.orchestration.getArchivedShellSnapshot(),
  });
  const terminalAttachAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:terminal:attach",
    subscribe: (operations, input: InputOf<EnvironmentTerminalOperations["attach"]>) =>
      operations.terminal
        .attach(input)
        .pipe(Stream.scan(EMPTY_TERMINAL_BUFFER_STATE, applyTerminalAttachStreamEvent)),
  });
  const terminalEventsAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:terminal:events",
    subscribe: (operations, _input: null) => operations.terminal.events({}),
  });
  const terminalMetadataAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:terminal:metadata",
    subscribe: (operations, _input: null) =>
      operations.terminal
        .metadata({})
        .pipe(Stream.scan([] as ReadonlyArray<TerminalSummary>, applyTerminalMetadataStreamEvent)),
  });
  const serverConfigChangesAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:server:config-changes",
    subscribe: (operations, _input: null) => operations.server.configChanges({}),
  });
  const serverLifecycleChangesAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:server:lifecycle-changes",
    subscribe: (operations, _input: null) => operations.server.lifecycleChanges({}),
  });
  const authAccessChangesAtom = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:server:auth-access-changes",
    subscribe: (operations, _input: null) =>
      operations.server
        .authAccessChanges({})
        .pipe(Stream.mapAccum(() => EMPTY_AUTH_ACCESS_SNAPSHOT, projectAuthAccessSnapshot)),
  });

  const writeProjectFile = createEnvironmentMutation(runtime, {
    label: "environment-data:projects:write-file",
    execute: (operations, input: InputOf<EnvironmentProjectOperations["writeFile"]>) =>
      operations.projects.writeFile(input),
  });
  const openInEditor = createEnvironmentMutation(runtime, {
    label: "environment-data:shell:open-in-editor",
    execute: (operations, input: InputOf<EnvironmentShellOperations["openInEditor"]>) =>
      operations.shell.openInEditor(input),
  });
  const pull = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:pull",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["pull"]>) =>
      operations.vcs.pull(input),
  });
  const refreshVcsStatus = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:refresh-status",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["refreshStatus"]>) =>
      operations.vcs.refreshStatus(input),
  });
  const createWorktree = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:create-worktree",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["createWorktree"]>) =>
      operations.vcs.createWorktree(input),
  });
  const removeWorktree = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:remove-worktree",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["removeWorktree"]>) =>
      operations.vcs.removeWorktree(input),
  });
  const createRef = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:create-ref",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["createRef"]>) =>
      operations.vcs.createRef(input),
  });
  const switchRef = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:switch-ref",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["switchRef"]>) =>
      operations.vcs.switchRef(input),
  });
  const initRepository = createEnvironmentMutation(runtime, {
    label: "environment-data:vcs:init",
    execute: (operations, input: InputOf<EnvironmentVcsOperations["init"]>) =>
      operations.vcs.init(input),
  });
  const runStackedGitAction = createEnvironmentStreamMutation(runtime, {
    label: "environment-data:git:run-stacked-action",
    execute: (operations, input: InputOf<EnvironmentGitOperations["runStackedAction"]>) =>
      operations.git.runStackedAction(input),
  });
  const resolvePullRequest = createEnvironmentMutation(runtime, {
    label: "environment-data:git:resolve-pull-request",
    execute: (operations, input: InputOf<EnvironmentGitOperations["resolvePullRequest"]>) =>
      operations.git.resolvePullRequest(input),
  });
  const preparePullRequestThread = createEnvironmentMutation(runtime, {
    label: "environment-data:git:prepare-pull-request-thread",
    execute: (operations, input: InputOf<EnvironmentGitOperations["preparePullRequestThread"]>) =>
      operations.git.preparePullRequestThread(input),
  });
  const openTerminal = createEnvironmentMutation(runtime, {
    label: "environment-data:terminal:open",
    execute: (operations, input: InputOf<EnvironmentTerminalOperations["open"]>) =>
      operations.terminal.open(input),
  });
  const writeTerminal = createEnvironmentMutation(runtime, {
    label: "environment-data:terminal:write",
    execute: (operations, input: InputOf<EnvironmentTerminalOperations["write"]>) =>
      operations.terminal.write(input),
  });
  const resizeTerminal = createEnvironmentMutation(runtime, {
    label: "environment-data:terminal:resize",
    execute: (operations, input: InputOf<EnvironmentTerminalOperations["resize"]>) =>
      operations.terminal.resize(input),
  });
  const clearTerminal = createEnvironmentMutation(runtime, {
    label: "environment-data:terminal:clear",
    execute: (operations, input: InputOf<EnvironmentTerminalOperations["clear"]>) =>
      operations.terminal.clear(input),
  });
  const restartTerminal = createEnvironmentMutation(runtime, {
    label: "environment-data:terminal:restart",
    execute: (operations, input: InputOf<EnvironmentTerminalOperations["restart"]>) =>
      operations.terminal.restart(input),
  });
  const closeTerminal = createEnvironmentMutation(runtime, {
    label: "environment-data:terminal:close",
    execute: (operations, input: InputOf<EnvironmentTerminalOperations["close"]>) =>
      operations.terminal.close(input),
  });
  const refreshProviders = createEnvironmentMutation(runtime, {
    label: "environment-data:server:refresh-providers",
    execute: (operations, input: InputOf<EnvironmentServerOperations["refreshProviders"]>) =>
      operations.server.refreshProviders(input),
  });
  const updateProvider = createEnvironmentMutation(runtime, {
    label: "environment-data:server:update-provider",
    execute: (operations, input: InputOf<EnvironmentServerOperations["updateProvider"]>) =>
      operations.server.updateProvider(input),
  });
  const upsertKeybinding = createEnvironmentMutation(runtime, {
    label: "environment-data:server:upsert-keybinding",
    execute: (operations, input: InputOf<EnvironmentServerOperations["upsertKeybinding"]>) =>
      operations.server.upsertKeybinding(input),
  });
  const removeKeybinding = createEnvironmentMutation(runtime, {
    label: "environment-data:server:remove-keybinding",
    execute: (operations, input: InputOf<EnvironmentServerOperations["removeKeybinding"]>) =>
      operations.server.removeKeybinding(input),
  });
  const updateSettings = createEnvironmentMutation(runtime, {
    label: "environment-data:server:update-settings",
    execute: (operations, input: InputOf<EnvironmentServerOperations["updateSettings"]>) =>
      operations.server.updateSettings(input),
  });
  const signalProcess = createEnvironmentMutation(runtime, {
    label: "environment-data:server:signal-process",
    execute: (operations, input: InputOf<EnvironmentServerOperations["signalProcess"]>) =>
      operations.server.signalProcess(input),
  });
  const installRelayClient = createEnvironmentStreamMutation(runtime, {
    label: "environment-data:cloud:install-relay-client",
    execute: (operations, input: InputOf<EnvironmentCloudOperations["installRelayClient"]>) =>
      operations.cloud.installRelayClient(input),
  });
  const cloneRepository = createEnvironmentMutation(runtime, {
    label: "environment-data:source-control:clone-repository",
    execute: (operations, input: InputOf<EnvironmentSourceControlOperations["cloneRepository"]>) =>
      operations.sourceControl.cloneRepository(input),
  });
  const lookupRepository = createEnvironmentMutation(runtime, {
    label: "environment-data:source-control:lookup-repository",
    execute: (operations, input: InputOf<EnvironmentSourceControlOperations["lookupRepository"]>) =>
      operations.sourceControl.lookupRepository(input),
  });
  const publishRepository = createEnvironmentMutation(runtime, {
    label: "environment-data:source-control:publish-repository",
    execute: (
      operations,
      input: InputOf<EnvironmentSourceControlOperations["publishRepository"]>,
    ) => operations.sourceControl.publishRepository(input),
  });
  const createProject = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:project:create",
    execute: (_operations, input: CreateProjectInput, environmentRuntime) =>
      environmentRuntime.commands.projects.create(input),
  });
  const updateProject = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:project:update",
    execute: (_operations, input: UpdateProjectInput, environmentRuntime) =>
      environmentRuntime.commands.projects.update(input),
  });
  const deleteProject = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:project:delete",
    execute: (_operations, input: DeleteProjectInput, environmentRuntime) =>
      environmentRuntime.commands.projects.delete(input),
  });
  const createThread = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:create",
    execute: (_operations, input: CreateThreadInput, environmentRuntime) =>
      environmentRuntime.commands.threads.create(input),
  });
  const deleteThread = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:delete",
    execute: (_operations, input: DeleteThreadInput, environmentRuntime) =>
      environmentRuntime.commands.threads.delete(input),
  });
  const archiveThread = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:archive",
    execute: (_operations, input: ArchiveThreadInput, environmentRuntime) =>
      environmentRuntime.commands.threads.archive(input),
  });
  const unarchiveThread = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:unarchive",
    execute: (_operations, input: UnarchiveThreadInput, environmentRuntime) =>
      environmentRuntime.commands.threads.unarchive(input),
  });
  const updateThreadMetadata = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:update-metadata",
    execute: (_operations, input: UpdateThreadMetadataInput, environmentRuntime) =>
      environmentRuntime.commands.threads.updateMetadata(input),
  });
  const setThreadRuntimeMode = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:set-runtime-mode",
    execute: (_operations, input: SetThreadRuntimeModeInput, environmentRuntime) =>
      environmentRuntime.commands.threads.setRuntimeMode(input),
  });
  const setThreadInteractionMode = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:set-interaction-mode",
    execute: (_operations, input: SetThreadInteractionModeInput, environmentRuntime) =>
      environmentRuntime.commands.threads.setInteractionMode(input),
  });
  const startThreadTurn = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:start-turn",
    execute: (_operations, input: StartThreadTurnInput, environmentRuntime) =>
      environmentRuntime.commands.threads.startTurn(input),
  });
  const interruptThreadTurn = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:interrupt-turn",
    execute: (_operations, input: InterruptThreadTurnInput, environmentRuntime) =>
      environmentRuntime.commands.threads.interruptTurn(input),
  });
  const respondToThreadApproval = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:respond-to-approval",
    execute: (_operations, input: RespondToThreadApprovalInput, environmentRuntime) =>
      environmentRuntime.commands.threads.respondToApproval(input),
  });
  const respondToThreadUserInput = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:respond-to-user-input",
    execute: (_operations, input: RespondToThreadUserInputInput, environmentRuntime) =>
      environmentRuntime.commands.threads.respondToUserInput(input),
  });
  const revertThreadCheckpoint = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:revert-checkpoint",
    execute: (_operations, input: RevertThreadCheckpointInput, environmentRuntime) =>
      environmentRuntime.commands.threads.revertCheckpoint(input),
  });
  const stopThreadSession = createEnvironmentMutation(runtime, {
    label: "environment-data:commands:thread:stop-session",
    execute: (_operations, input: StopThreadSessionInput, environmentRuntime) =>
      environmentRuntime.commands.threads.stopSession(input),
  });
  const replayEvents = createEnvironmentMutation(runtime, {
    label: "environment-data:orchestration:replay-events",
    execute: (operations, input: InputOf<EnvironmentOrchestrationOperations["replayEvents"]>) =>
      operations.orchestration.replayEvents(input),
  });

  return {
    queries: {
      projectSearchEntriesAtom,
      filesystemBrowseAtom,
      vcsListRefsAtom,
      vcsStatusAtom,
      reviewDiffPreviewAtom,
      serverConfigAtom,
      serverSettingsAtom,
      sourceControlDiscoveryAtom,
      traceDiagnosticsAtom,
      processDiagnosticsAtom,
      processResourceHistoryAtom,
      relayClientStatusAtom,
      sourceControlRepositoryAtom,
      pullRequestResolutionAtom,
      turnDiffAtom,
      fullThreadDiffAtom,
      archivedShellSnapshotAtom,
      terminalAttachAtom,
      terminalEventsAtom,
      terminalMetadataAtom,
      serverConfigChangesAtom,
      serverLifecycleChangesAtom,
      authAccessChangesAtom,
    },
    mutations: {
      writeProjectFile,
      openInEditor,
      pull,
      refreshVcsStatus,
      createWorktree,
      removeWorktree,
      createRef,
      switchRef,
      initRepository,
      runStackedGitAction,
      resolvePullRequest,
      preparePullRequestThread,
      openTerminal,
      writeTerminal,
      resizeTerminal,
      clearTerminal,
      restartTerminal,
      closeTerminal,
      refreshProviders,
      updateProvider,
      upsertKeybinding,
      removeKeybinding,
      updateSettings,
      signalProcess,
      installRelayClient,
      cloneRepository,
      lookupRepository,
      publishRepository,
      createProject,
      updateProject,
      deleteProject,
      createThread,
      deleteThread,
      archiveThread,
      unarchiveThread,
      updateThreadMetadata,
      setThreadRuntimeMode,
      setThreadInteractionMode,
      startThreadTurn,
      interruptThreadTurn,
      respondToThreadApproval,
      respondToThreadUserInput,
      revertThreadCheckpoint,
      stopThreadSession,
      replayEvents,
    },
  };
}
