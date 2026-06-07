import { describe, expect, it } from "@effect/vitest";
import {
  BearerConnectionProfile,
  BearerConnectionTarget,
  type EnvironmentCatalogReadModel,
} from "@t3tools/client-runtime";
import { EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";

import {
  projectMobileWorkspaceEnvironment,
  projectMobileWorkspaceState,
} from "./mobileWorkspaceModel";
import type { MobileEnvironmentPresentation } from "./useMobileEnvironments";

const ENVIRONMENT_ID = EnvironmentId.make("environment-1");

function environment(
  phase: MobileEnvironmentPresentation["connection"]["phase"],
): MobileEnvironmentPresentation {
  const connectionId = `bearer:${ENVIRONMENT_ID}`;
  return {
    environmentId: ENVIRONMENT_ID,
    label: "Julius's MacBook Pro",
    displayUrl: "https://environment.example.test",
    relayManaged: false,
    entry: {
      target: new BearerConnectionTarget({
        environmentId: ENVIRONMENT_ID,
        label: "Julius's MacBook Pro",
        connectionId,
      }),
      profile: Option.some(
        new BearerConnectionProfile({
          connectionId,
          environmentId: ENVIRONMENT_ID,
          label: "Julius's MacBook Pro",
          httpBaseUrl: "https://environment.example.test",
          wsBaseUrl: "wss://environment.example.test",
        }),
      ),
    },
    connection: {
      phase,
      error: phase === "error" ? "Connection failed." : null,
      traceId: phase === "error" ? "trace-1" : null,
    },
    serverConfig: null,
  };
}

const EMPTY_READ_MODEL: EnvironmentCatalogReadModel = {
  projects: [],
  threads: [],
  snapshotByEnvironmentId: new Map(),
  shellStatusByEnvironmentId: new Map(),
  shellErrorByEnvironmentId: new Map(),
  serverConfigByEnvironmentId: new Map(),
  latestSnapshotUpdatedAt: null,
  hasCachedData: false,
  hasLiveData: false,
  hasRemoteActivity: false,
};

describe("mobile workspace projection", () => {
  it("preserves explicit offline state without presenting it as a connection error", () => {
    const projected = projectMobileWorkspaceEnvironment(environment("offline"));

    expect(projected.connectionState).toBe("disconnected");
    expect(projected.connectionPhase).toBe("offline");
    expect(projected.connectionError).toBeNull();
  });

  it("reports offline before stale connected presentations", () => {
    const environments = [projectMobileWorkspaceEnvironment(environment("connected"))];
    const state = projectMobileWorkspaceState({
      isReady: true,
      networkStatus: "offline",
      environments,
      readModel: EMPTY_READ_MODEL,
    });

    expect(state.connectionState).toBe("disconnected");
    expect(state.networkStatus).toBe("offline");
    expect(state.hasReadyEnvironment).toBe(true);
  });

  it("projects reconnecting environments dynamically from active phases", () => {
    const environments = [
      projectMobileWorkspaceEnvironment(environment("reconnecting")),
      projectMobileWorkspaceEnvironment({
        ...environment("connected"),
        environmentId: EnvironmentId.make("environment-2"),
      }),
    ];
    const state = projectMobileWorkspaceState({
      isReady: true,
      networkStatus: "online",
      environments,
      readModel: EMPTY_READ_MODEL,
    });

    expect(state.connectingEnvironments).toHaveLength(1);
    expect(state.connectingEnvironments[0]?.connectionPhase).toBe("reconnecting");
  });
});
