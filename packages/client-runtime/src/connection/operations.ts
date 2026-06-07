import {
  ORCHESTRATION_WS_METHODS,
  type AuthAccessStreamEvent,
  type ServerConfigStreamEvent,
  type ServerLifecycleStreamEvent,
  type TerminalAttachStreamEvent,
  type TerminalEvent,
  type TerminalMetadataStreamEvent,
  type VcsStatusResult,
  WS_METHODS,
} from "@t3tools/contracts";
import { applyGitStatusStreamEvent } from "@t3tools/shared/git";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import {
  type EnvironmentRpcFailure,
  type EnvironmentRpcInput,
  type EnvironmentRpcService,
  type EnvironmentRpcStreamFailure,
  type EnvironmentRpcStreamValue,
  type EnvironmentRpcSuccess,
  type EnvironmentRpcUnavailableError,
  type EnvironmentStreamCommandRpcTag,
  type EnvironmentSubscriptionRpcTag,
  type EnvironmentUnaryRpcTag,
} from "./runtime.ts";

export type EnvironmentRequest<TTag extends EnvironmentUnaryRpcTag> = (
  input: EnvironmentRpcInput<TTag>,
) => Effect.Effect<
  EnvironmentRpcSuccess<TTag>,
  EnvironmentRpcFailure<TTag> | EnvironmentRpcUnavailableError
>;

export type EnvironmentRequestWithoutInput<TTag extends EnvironmentUnaryRpcTag> =
  () => Effect.Effect<
    EnvironmentRpcSuccess<TTag>,
    EnvironmentRpcFailure<TTag> | EnvironmentRpcUnavailableError
  >;

export type EnvironmentStreamCommand<TTag extends EnvironmentStreamCommandRpcTag> = (
  input: EnvironmentRpcInput<TTag>,
) => Stream.Stream<
  EnvironmentRpcStreamValue<TTag>,
  EnvironmentRpcStreamFailure<TTag> | EnvironmentRpcUnavailableError
>;

export type EnvironmentSubscription<TTag extends EnvironmentSubscriptionRpcTag> = (
  input: EnvironmentRpcInput<TTag>,
) => Stream.Stream<EnvironmentRpcStreamValue<TTag>, EnvironmentRpcStreamFailure<TTag>>;

export interface EnvironmentProjectOperations {
  readonly searchEntries: EnvironmentRequest<typeof WS_METHODS.projectsSearchEntries>;
  readonly writeFile: EnvironmentRequest<typeof WS_METHODS.projectsWriteFile>;
}

export interface EnvironmentShellOperations {
  readonly openInEditor: EnvironmentRequest<typeof WS_METHODS.shellOpenInEditor>;
}

export interface EnvironmentFilesystemOperations {
  readonly browse: EnvironmentRequest<typeof WS_METHODS.filesystemBrowse>;
}

export interface EnvironmentVcsOperations {
  readonly pull: EnvironmentRequest<typeof WS_METHODS.vcsPull>;
  readonly refreshStatus: EnvironmentRequest<typeof WS_METHODS.vcsRefreshStatus>;
  readonly status: (
    input: EnvironmentRpcInput<typeof WS_METHODS.subscribeVcsStatus>,
  ) => Stream.Stream<
    VcsStatusResult,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.subscribeVcsStatus>
  >;
  readonly listRefs: EnvironmentRequest<typeof WS_METHODS.vcsListRefs>;
  readonly createWorktree: EnvironmentRequest<typeof WS_METHODS.vcsCreateWorktree>;
  readonly removeWorktree: EnvironmentRequest<typeof WS_METHODS.vcsRemoveWorktree>;
  readonly createRef: EnvironmentRequest<typeof WS_METHODS.vcsCreateRef>;
  readonly switchRef: EnvironmentRequest<typeof WS_METHODS.vcsSwitchRef>;
  readonly init: EnvironmentRequest<typeof WS_METHODS.vcsInit>;
}

export interface EnvironmentGitOperations {
  readonly runStackedAction: EnvironmentStreamCommand<typeof WS_METHODS.gitRunStackedAction>;
  readonly resolvePullRequest: EnvironmentRequest<typeof WS_METHODS.gitResolvePullRequest>;
  readonly preparePullRequestThread: EnvironmentRequest<
    typeof WS_METHODS.gitPreparePullRequestThread
  >;
}

export interface EnvironmentReviewOperations {
  readonly getDiffPreview: EnvironmentRequest<typeof WS_METHODS.reviewGetDiffPreview>;
}

export interface EnvironmentTerminalOperations {
  readonly open: EnvironmentRequest<typeof WS_METHODS.terminalOpen>;
  readonly attach: (
    input: EnvironmentRpcInput<typeof WS_METHODS.terminalAttach>,
  ) => Stream.Stream<
    TerminalAttachStreamEvent,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.terminalAttach>
  >;
  readonly write: EnvironmentRequest<typeof WS_METHODS.terminalWrite>;
  readonly resize: EnvironmentRequest<typeof WS_METHODS.terminalResize>;
  readonly clear: EnvironmentRequest<typeof WS_METHODS.terminalClear>;
  readonly restart: EnvironmentRequest<typeof WS_METHODS.terminalRestart>;
  readonly close: EnvironmentRequest<typeof WS_METHODS.terminalClose>;
  readonly events: (
    input: EnvironmentRpcInput<typeof WS_METHODS.subscribeTerminalEvents>,
  ) => Stream.Stream<
    TerminalEvent,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.subscribeTerminalEvents>
  >;
  readonly metadata: (
    input: EnvironmentRpcInput<typeof WS_METHODS.subscribeTerminalMetadata>,
  ) => Stream.Stream<
    TerminalMetadataStreamEvent,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.subscribeTerminalMetadata>
  >;
}

export interface EnvironmentServerOperations {
  readonly getConfig: EnvironmentRequestWithoutInput<typeof WS_METHODS.serverGetConfig>;
  readonly refreshProviders: EnvironmentRequest<typeof WS_METHODS.serverRefreshProviders>;
  readonly updateProvider: EnvironmentRequest<typeof WS_METHODS.serverUpdateProvider>;
  readonly upsertKeybinding: EnvironmentRequest<typeof WS_METHODS.serverUpsertKeybinding>;
  readonly removeKeybinding: EnvironmentRequest<typeof WS_METHODS.serverRemoveKeybinding>;
  readonly getSettings: EnvironmentRequestWithoutInput<typeof WS_METHODS.serverGetSettings>;
  readonly updateSettings: EnvironmentRequest<typeof WS_METHODS.serverUpdateSettings>;
  readonly discoverSourceControl: EnvironmentRequestWithoutInput<
    typeof WS_METHODS.serverDiscoverSourceControl
  >;
  readonly getTraceDiagnostics: EnvironmentRequestWithoutInput<
    typeof WS_METHODS.serverGetTraceDiagnostics
  >;
  readonly getProcessDiagnostics: EnvironmentRequestWithoutInput<
    typeof WS_METHODS.serverGetProcessDiagnostics
  >;
  readonly getProcessResourceHistory: EnvironmentRequest<
    typeof WS_METHODS.serverGetProcessResourceHistory
  >;
  readonly signalProcess: EnvironmentRequest<typeof WS_METHODS.serverSignalProcess>;
  readonly configChanges: (
    input: EnvironmentRpcInput<typeof WS_METHODS.subscribeServerConfig>,
  ) => Stream.Stream<
    ServerConfigStreamEvent,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.subscribeServerConfig>
  >;
  readonly lifecycleChanges: (
    input: EnvironmentRpcInput<typeof WS_METHODS.subscribeServerLifecycle>,
  ) => Stream.Stream<
    ServerLifecycleStreamEvent,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.subscribeServerLifecycle>
  >;
  readonly authAccessChanges: (
    input: EnvironmentRpcInput<typeof WS_METHODS.subscribeAuthAccess>,
  ) => Stream.Stream<
    AuthAccessStreamEvent,
    EnvironmentRpcStreamFailure<typeof WS_METHODS.subscribeAuthAccess>
  >;
}

export interface EnvironmentCloudOperations {
  readonly getRelayClientStatus: EnvironmentRequestWithoutInput<
    typeof WS_METHODS.cloudGetRelayClientStatus
  >;
  readonly installRelayClient: EnvironmentStreamCommand<typeof WS_METHODS.cloudInstallRelayClient>;
}

export interface EnvironmentSourceControlOperations {
  readonly lookupRepository: EnvironmentRequest<typeof WS_METHODS.sourceControlLookupRepository>;
  readonly cloneRepository: EnvironmentRequest<typeof WS_METHODS.sourceControlCloneRepository>;
  readonly publishRepository: EnvironmentRequest<typeof WS_METHODS.sourceControlPublishRepository>;
}

export interface EnvironmentOrchestrationOperations {
  readonly dispatchCommand: EnvironmentRequest<typeof ORCHESTRATION_WS_METHODS.dispatchCommand>;
  readonly getTurnDiff: EnvironmentRequest<typeof ORCHESTRATION_WS_METHODS.getTurnDiff>;
  readonly getFullThreadDiff: EnvironmentRequest<typeof ORCHESTRATION_WS_METHODS.getFullThreadDiff>;
  readonly replayEvents: EnvironmentRequest<typeof ORCHESTRATION_WS_METHODS.replayEvents>;
  readonly getArchivedShellSnapshot: EnvironmentRequestWithoutInput<
    typeof ORCHESTRATION_WS_METHODS.getArchivedShellSnapshot
  >;
}

export interface EnvironmentOperationsService {
  readonly projects: EnvironmentProjectOperations;
  readonly shell: EnvironmentShellOperations;
  readonly filesystem: EnvironmentFilesystemOperations;
  readonly vcs: EnvironmentVcsOperations;
  readonly git: EnvironmentGitOperations;
  readonly review: EnvironmentReviewOperations;
  readonly terminal: EnvironmentTerminalOperations;
  readonly server: EnvironmentServerOperations;
  readonly cloud: EnvironmentCloudOperations;
  readonly sourceControl: EnvironmentSourceControlOperations;
  readonly orchestration: EnvironmentOrchestrationOperations;
}

export class EnvironmentOperations extends Context.Service<
  EnvironmentOperations,
  EnvironmentOperationsService
>()("@t3tools/client-runtime/connection/operations/EnvironmentOperations") {}

function request<TTag extends EnvironmentUnaryRpcTag>(
  rpc: EnvironmentRpcService,
  spanName: string,
  tag: TTag,
): EnvironmentRequest<TTag> {
  return Effect.fn(spanName)(function* (input: EnvironmentRpcInput<TTag>) {
    return yield* rpc.request(tag, input);
  });
}

function requestWithoutInput<TTag extends EnvironmentUnaryRpcTag>(
  rpc: EnvironmentRpcService,
  spanName: string,
  tag: TTag,
): EnvironmentRequestWithoutInput<TTag> {
  return Effect.fn(spanName)(function* () {
    return yield* rpc.request(tag, {} as EnvironmentRpcInput<TTag>);
  });
}

function streamCommand<TTag extends EnvironmentStreamCommandRpcTag>(
  rpc: EnvironmentRpcService,
  spanName: string,
  tag: TTag,
): EnvironmentStreamCommand<TTag> {
  return (input) => rpc.runStream(tag, input).pipe(Stream.withSpan(spanName));
}

function subscription<TTag extends EnvironmentSubscriptionRpcTag>(
  rpc: EnvironmentRpcService,
  spanName: string,
  tag: TTag,
): EnvironmentSubscription<TTag> {
  return (input) => rpc.subscribe(tag, input).pipe(Stream.withSpan(spanName));
}

export const makeEnvironmentOperations = Effect.fn("EnvironmentOperations.make")((
  rpc: EnvironmentRpcService,
) => {
  const vcsStatus = (input: EnvironmentRpcInput<typeof WS_METHODS.subscribeVcsStatus>) =>
    rpc.subscribe(WS_METHODS.subscribeVcsStatus, input).pipe(
      Stream.mapAccum(
        () => null as VcsStatusResult | null,
        (current, event) => {
          const next = applyGitStatusStreamEvent(current, event);
          return [next, [next]] as const;
        },
      ),
      Stream.withSpan("EnvironmentVcs.status"),
    );

  return Effect.succeed(
    EnvironmentOperations.of({
      projects: {
        searchEntries: request(
          rpc,
          "EnvironmentProjects.searchEntries",
          WS_METHODS.projectsSearchEntries,
        ),
        writeFile: request(rpc, "EnvironmentProjects.writeFile", WS_METHODS.projectsWriteFile),
      },
      shell: {
        openInEditor: request(rpc, "EnvironmentShell.openInEditor", WS_METHODS.shellOpenInEditor),
      },
      filesystem: {
        browse: request(rpc, "EnvironmentFilesystem.browse", WS_METHODS.filesystemBrowse),
      },
      vcs: {
        pull: request(rpc, "EnvironmentVcs.pull", WS_METHODS.vcsPull),
        refreshStatus: request(rpc, "EnvironmentVcs.refreshStatus", WS_METHODS.vcsRefreshStatus),
        status: vcsStatus,
        listRefs: request(rpc, "EnvironmentVcs.listRefs", WS_METHODS.vcsListRefs),
        createWorktree: request(rpc, "EnvironmentVcs.createWorktree", WS_METHODS.vcsCreateWorktree),
        removeWorktree: request(rpc, "EnvironmentVcs.removeWorktree", WS_METHODS.vcsRemoveWorktree),
        createRef: request(rpc, "EnvironmentVcs.createRef", WS_METHODS.vcsCreateRef),
        switchRef: request(rpc, "EnvironmentVcs.switchRef", WS_METHODS.vcsSwitchRef),
        init: request(rpc, "EnvironmentVcs.init", WS_METHODS.vcsInit),
      },
      git: {
        runStackedAction: streamCommand(
          rpc,
          "EnvironmentGit.runStackedAction",
          WS_METHODS.gitRunStackedAction,
        ),
        resolvePullRequest: request(
          rpc,
          "EnvironmentGit.resolvePullRequest",
          WS_METHODS.gitResolvePullRequest,
        ),
        preparePullRequestThread: request(
          rpc,
          "EnvironmentGit.preparePullRequestThread",
          WS_METHODS.gitPreparePullRequestThread,
        ),
      },
      review: {
        getDiffPreview: request(
          rpc,
          "EnvironmentReview.getDiffPreview",
          WS_METHODS.reviewGetDiffPreview,
        ),
      },
      terminal: {
        open: request(rpc, "EnvironmentTerminal.open", WS_METHODS.terminalOpen),
        attach: subscription(rpc, "EnvironmentTerminal.attach", WS_METHODS.terminalAttach),
        write: request(rpc, "EnvironmentTerminal.write", WS_METHODS.terminalWrite),
        resize: request(rpc, "EnvironmentTerminal.resize", WS_METHODS.terminalResize),
        clear: request(rpc, "EnvironmentTerminal.clear", WS_METHODS.terminalClear),
        restart: request(rpc, "EnvironmentTerminal.restart", WS_METHODS.terminalRestart),
        close: request(rpc, "EnvironmentTerminal.close", WS_METHODS.terminalClose),
        events: subscription(rpc, "EnvironmentTerminal.events", WS_METHODS.subscribeTerminalEvents),
        metadata: subscription(
          rpc,
          "EnvironmentTerminal.metadata",
          WS_METHODS.subscribeTerminalMetadata,
        ),
      },
      server: {
        getConfig: requestWithoutInput(
          rpc,
          "EnvironmentServer.getConfig",
          WS_METHODS.serverGetConfig,
        ),
        refreshProviders: request(
          rpc,
          "EnvironmentServer.refreshProviders",
          WS_METHODS.serverRefreshProviders,
        ),
        updateProvider: request(
          rpc,
          "EnvironmentServer.updateProvider",
          WS_METHODS.serverUpdateProvider,
        ),
        upsertKeybinding: request(
          rpc,
          "EnvironmentServer.upsertKeybinding",
          WS_METHODS.serverUpsertKeybinding,
        ),
        removeKeybinding: request(
          rpc,
          "EnvironmentServer.removeKeybinding",
          WS_METHODS.serverRemoveKeybinding,
        ),
        getSettings: requestWithoutInput(
          rpc,
          "EnvironmentServer.getSettings",
          WS_METHODS.serverGetSettings,
        ),
        updateSettings: request(
          rpc,
          "EnvironmentServer.updateSettings",
          WS_METHODS.serverUpdateSettings,
        ),
        discoverSourceControl: requestWithoutInput(
          rpc,
          "EnvironmentServer.discoverSourceControl",
          WS_METHODS.serverDiscoverSourceControl,
        ),
        getTraceDiagnostics: requestWithoutInput(
          rpc,
          "EnvironmentServer.getTraceDiagnostics",
          WS_METHODS.serverGetTraceDiagnostics,
        ),
        getProcessDiagnostics: requestWithoutInput(
          rpc,
          "EnvironmentServer.getProcessDiagnostics",
          WS_METHODS.serverGetProcessDiagnostics,
        ),
        getProcessResourceHistory: request(
          rpc,
          "EnvironmentServer.getProcessResourceHistory",
          WS_METHODS.serverGetProcessResourceHistory,
        ),
        signalProcess: request(
          rpc,
          "EnvironmentServer.signalProcess",
          WS_METHODS.serverSignalProcess,
        ),
        configChanges: subscription(
          rpc,
          "EnvironmentServer.configChanges",
          WS_METHODS.subscribeServerConfig,
        ),
        lifecycleChanges: subscription(
          rpc,
          "EnvironmentServer.lifecycleChanges",
          WS_METHODS.subscribeServerLifecycle,
        ),
        authAccessChanges: subscription(
          rpc,
          "EnvironmentServer.authAccessChanges",
          WS_METHODS.subscribeAuthAccess,
        ),
      },
      cloud: {
        getRelayClientStatus: requestWithoutInput(
          rpc,
          "EnvironmentCloud.getRelayClientStatus",
          WS_METHODS.cloudGetRelayClientStatus,
        ),
        installRelayClient: streamCommand(
          rpc,
          "EnvironmentCloud.installRelayClient",
          WS_METHODS.cloudInstallRelayClient,
        ),
      },
      sourceControl: {
        lookupRepository: request(
          rpc,
          "EnvironmentSourceControl.lookupRepository",
          WS_METHODS.sourceControlLookupRepository,
        ),
        cloneRepository: request(
          rpc,
          "EnvironmentSourceControl.cloneRepository",
          WS_METHODS.sourceControlCloneRepository,
        ),
        publishRepository: request(
          rpc,
          "EnvironmentSourceControl.publishRepository",
          WS_METHODS.sourceControlPublishRepository,
        ),
      },
      orchestration: {
        dispatchCommand: request(
          rpc,
          "EnvironmentOrchestration.dispatchCommand",
          ORCHESTRATION_WS_METHODS.dispatchCommand,
        ),
        getTurnDiff: request(
          rpc,
          "EnvironmentOrchestration.getTurnDiff",
          ORCHESTRATION_WS_METHODS.getTurnDiff,
        ),
        getFullThreadDiff: request(
          rpc,
          "EnvironmentOrchestration.getFullThreadDiff",
          ORCHESTRATION_WS_METHODS.getFullThreadDiff,
        ),
        replayEvents: request(
          rpc,
          "EnvironmentOrchestration.replayEvents",
          ORCHESTRATION_WS_METHODS.replayEvents,
        ),
        getArchivedShellSnapshot: requestWithoutInput(
          rpc,
          "EnvironmentOrchestration.getArchivedShellSnapshot",
          ORCHESTRATION_WS_METHODS.getArchivedShellSnapshot,
        ),
      },
    }),
  );
});
