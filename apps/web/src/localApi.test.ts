import type { ContextMenuItem, DesktopBridge } from "@t3tools/contracts";
import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const showContextMenuFallbackMock =
  vi.fn<
    <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>
  >();

vi.mock("./contextMenuFallback", () => ({
  showContextMenuFallback: showContextMenuFallbackMock,
}));

function createLocalStorageStub(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

function testWindow(): Window & typeof globalThis {
  return globalThis.window ?? (globalThis as unknown as Window & typeof globalThis);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  if (globalThis.window === undefined) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });
  }
  Reflect.deleteProperty(testWindow(), "desktopBridge");
  Reflect.deleteProperty(testWindow(), "nativeApi");
  Object.defineProperty(testWindow(), "localStorage", {
    configurable: true,
    value: createLocalStorageStub(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocalApi", () => {
  it("keeps backend operations unavailable in the browser facade", async () => {
    const { createLocalApi } = await import("./localApi");
    const api = createLocalApi();

    await expect(api.server.getConfig()).rejects.toThrow(
      "Local backend API is unavailable before a backend is paired.",
    );
    await expect(api.shell.openInEditor("/tmp", "cursor")).rejects.toThrow(
      "Local backend API is unavailable before a backend is paired.",
    );
  });

  it("uses the browser context-menu fallback without a desktop bridge", async () => {
    showContextMenuFallbackMock.mockResolvedValue("rename");
    const { createLocalApi } = await import("./localApi");
    const items = [{ id: "rename", label: "Rename" }] as const;

    await expect(createLocalApi().contextMenu.show(items, { x: 4, y: 5 })).resolves.toBe("rename");
    expect(showContextMenuFallbackMock).toHaveBeenCalledWith(items, { x: 4, y: 5 });
  });

  it("delegates host capabilities and persistence to the desktop bridge", async () => {
    const showContextMenu = vi.fn().mockResolvedValue("delete");
    const pickFolder = vi.fn().mockResolvedValue("/tmp/project");
    const getSavedEnvironmentSecret = vi.fn().mockResolvedValue("secret");
    const setSavedEnvironmentSecret = vi.fn().mockResolvedValue(true);
    const removeSavedEnvironmentSecret = vi.fn().mockResolvedValue(undefined);
    testWindow().desktopBridge = {
      showContextMenu,
      pickFolder,
      getSavedEnvironmentSecret,
      setSavedEnvironmentSecret,
      removeSavedEnvironmentSecret,
    } as unknown as DesktopBridge;

    const { createLocalApi } = await import("./localApi");
    const api = createLocalApi();
    const environmentId = EnvironmentId.make("environment-1");
    const items = [{ id: "delete", label: "Delete" }] as const;

    await expect(api.contextMenu.show(items)).resolves.toBe("delete");
    await expect(api.dialogs.pickFolder({ initialPath: "/tmp" })).resolves.toBe("/tmp/project");
    await expect(api.persistence.getSavedEnvironmentSecret(environmentId)).resolves.toBe("secret");
    await expect(api.persistence.setSavedEnvironmentSecret(environmentId, "next")).resolves.toBe(
      true,
    );
    await api.persistence.removeSavedEnvironmentSecret(environmentId);

    expect(showContextMenu).toHaveBeenCalledWith(items, undefined);
    expect(pickFolder).toHaveBeenCalledWith({ initialPath: "/tmp" });
    expect(getSavedEnvironmentSecret).toHaveBeenCalledWith(environmentId);
    expect(setSavedEnvironmentSecret).toHaveBeenCalledWith(environmentId, "next");
    expect(removeSavedEnvironmentSecret).toHaveBeenCalledWith(environmentId);
  });

  it("persists connection records and secrets in browser storage", async () => {
    const { createLocalApi } = await import("./localApi");
    const api = createLocalApi();
    const environmentId = EnvironmentId.make("environment-1");
    const records = [
      {
        environmentId,
        label: "Remote",
        httpBaseUrl: "https://remote.example.test",
        wsBaseUrl: "wss://remote.example.test",
        createdAt: "2026-06-06T00:00:00.000Z",
        lastConnectedAt: null,
      },
    ];

    await api.persistence.setSavedEnvironmentRegistry(records);
    await api.persistence.setSavedEnvironmentSecret(environmentId, "secret");

    await expect(api.persistence.getSavedEnvironmentRegistry()).resolves.toEqual(records);
    await expect(api.persistence.getSavedEnvironmentSecret(environmentId)).resolves.toBe("secret");

    await api.persistence.removeSavedEnvironmentSecret(environmentId);
    await expect(api.persistence.getSavedEnvironmentSecret(environmentId)).resolves.toBeNull();
  });

  it("prefers the native LocalApi when one is injected", async () => {
    const nativeApi = { dialogs: {} };
    testWindow().nativeApi = nativeApi as never;
    const { readLocalApi } = await import("./localApi");

    expect(readLocalApi()).toBe(nativeApi);
  });
});
