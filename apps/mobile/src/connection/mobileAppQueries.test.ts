import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";

import {
  buildMobileCheckpointDiffTargets,
  normalizeMobileComposerPathSearchQuery,
} from "./mobileAppQueryTargets";

describe("mobileAppQueries", () => {
  it("normalizes composer path search input", () => {
    expect(normalizeMobileComposerPathSearchQuery("  src/app  ")).toBe("src/app");
    expect(normalizeMobileComposerPathSearchQuery(null)).toBe("");
  });

  it("routes the first turn range through the full-thread diff query", () => {
    const environmentId = EnvironmentId.make("environment-a");
    const threadId = ThreadId.make("thread-a");

    expect(
      buildMobileCheckpointDiffTargets({
        environmentId,
        threadId,
        fromTurnCount: 0,
        toTurnCount: 4,
        ignoreWhitespace: true,
      }),
    ).toEqual({
      fullThread: {
        environmentId,
        input: {
          threadId,
          toTurnCount: 4,
          ignoreWhitespace: true,
        },
      },
      turn: null,
    });
  });

  it("routes later ranges through the incremental turn diff query", () => {
    const environmentId = EnvironmentId.make("environment-a");
    const threadId = ThreadId.make("thread-a");

    expect(
      buildMobileCheckpointDiffTargets({
        environmentId,
        threadId,
        fromTurnCount: 3,
        toTurnCount: 4,
        ignoreWhitespace: false,
      }),
    ).toEqual({
      fullThread: null,
      turn: {
        environmentId,
        input: {
          threadId,
          fromTurnCount: 3,
          toTurnCount: 4,
          ignoreWhitespace: false,
        },
      },
    });
  });
});
