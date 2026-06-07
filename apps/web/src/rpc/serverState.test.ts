import {
  DEFAULT_SERVER_SETTINGS,
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProjectId,
  ThreadId,
  type ServerConfig,
  type ServerProvider,
} from "@t3tools/contracts";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  applyServerConfigEvent,
  emitWelcome,
  getServerConfig,
  getServerKeybindings,
  onProvidersUpdated,
  onServerConfigUpdated,
  onWelcome,
  resetServerStateForTests,
  setServerConfigSnapshot,
} from "./serverState";

const defaultProviders: ReadonlyArray<ServerProvider> = [
  {
    instanceId: ProviderInstanceId.make("codex"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: "0.116.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
  },
];

const baseEnvironment = {
  environmentId: EnvironmentId.make("environment-local"),
  label: "Local environment",
  platform: {
    os: "darwin" as const,
    arch: "arm64" as const,
  },
  serverVersion: "0.0.0-test",
  capabilities: {
    repositoryIdentity: true,
  },
};

const baseServerConfig: ServerConfig = {
  environment: baseEnvironment,
  auth: {
    policy: "loopback-browser",
    bootstrapMethods: ["one-time-token"],
    sessionMethods: ["browser-session-cookie", "bearer-access-token"],
    sessionCookieName: "t3_session",
  },
  cwd: "/tmp/workspace",
  keybindingsConfigPath: "/tmp/workspace/.config/keybindings.json",
  keybindings: [],
  issues: [],
  providers: defaultProviders,
  availableEditors: ["cursor"],
  observability: {
    logsDirectoryPath: "/tmp/workspace/.config/logs",
    localTracingEnabled: true,
    otlpTracesEnabled: false,
    otlpMetricsEnabled: false,
  },
  settings: DEFAULT_SERVER_SETTINGS,
};

beforeEach(() => {
  resetServerStateForTests();
});

afterEach(() => {
  resetServerStateForTests();
});

describe("serverState", () => {
  it("uses default keybindings before a server config snapshot is available", () => {
    expect(getServerConfig()).toBeNull();
    expect(getServerKeybindings()).toEqual(DEFAULT_RESOLVED_KEYBINDINGS);
  });

  it("projects a server config snapshot and replays it to late subscribers", () => {
    setServerConfigSnapshot(baseServerConfig);

    expect(getServerConfig()).toEqual(baseServerConfig);

    const listener = vi.fn();
    const unsubscribe = onServerConfigUpdated(listener);
    expect(listener).toHaveBeenCalledWith(
      {
        issues: [],
        providers: defaultProviders,
        settings: DEFAULT_SERVER_SETTINGS,
      },
      "snapshot",
    );
    unsubscribe();
  });

  it("projects welcome events and replays the latest value", () => {
    const payload = {
      environment: baseEnvironment,
      cwd: "/tmp/workspace",
      projectName: "t3-code",
      bootstrapProjectId: ProjectId.make("project-1"),
      bootstrapThreadId: ThreadId.make("thread-1"),
    };

    emitWelcome(payload);

    const listener = vi.fn();
    const unsubscribe = onWelcome(listener);
    expect(listener).toHaveBeenCalledWith(payload);
    unsubscribe();
  });

  it("merges provider, settings, and keybinding events into the projected config", () => {
    setServerConfigSnapshot(baseServerConfig);
    const configListener = vi.fn();
    const providersListener = vi.fn();
    const unsubscribeConfig = onServerConfigUpdated(configListener);
    const unsubscribeProviders = onProvidersUpdated(providersListener);

    const nextProviders: ReadonlyArray<ServerProvider> = [
      {
        ...defaultProviders[0]!,
        status: "warning",
        checkedAt: "2026-01-02T00:00:00.000Z",
        message: "rate limited",
      },
    ];
    const nextKeybindings = [
      {
        command: "commandPalette.toggle",
        shortcut: {
          key: "p",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          modKey: true,
        },
      },
    ] as const;

    applyServerConfigEvent({
      version: 1,
      type: "keybindingsUpdated",
      payload: {
        keybindings: nextKeybindings,
        issues: [{ kind: "keybindings.malformed-config", message: "bad json" }],
      },
    });
    applyServerConfigEvent({
      version: 1,
      type: "providerStatuses",
      payload: {
        providers: nextProviders,
      },
    });
    applyServerConfigEvent({
      version: 1,
      type: "settingsUpdated",
      payload: {
        settings: {
          ...DEFAULT_SERVER_SETTINGS,
          enableAssistantStreaming: true,
        },
      },
    });

    expect(getServerConfig()).toEqual({
      ...baseServerConfig,
      keybindings: nextKeybindings,
      issues: [{ kind: "keybindings.malformed-config", message: "bad json" }],
      providers: nextProviders,
      settings: {
        ...DEFAULT_SERVER_SETTINGS,
        enableAssistantStreaming: true,
      },
    });
    expect(providersListener).toHaveBeenLastCalledWith({ providers: nextProviders });
    expect(configListener).toHaveBeenLastCalledWith(
      {
        issues: [{ kind: "keybindings.malformed-config", message: "bad json" }],
        providers: nextProviders,
        settings: {
          ...DEFAULT_SERVER_SETTINGS,
          enableAssistantStreaming: true,
        },
      },
      "settingsUpdated",
    );

    unsubscribeProviders();
    unsubscribeConfig();
  });
});
