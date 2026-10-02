import { act, renderHook, waitFor } from "@testing-library/react";
import { useMobileTime } from "./useMobileTime";
import { apiGet } from "@/lib/api";
import { useTimer } from "@/context/TimerContext";

jest.mock("@/lib/api", () => ({ apiGet: jest.fn() }));
jest.mock("@/context/TimerContext", () => ({ useTimer: jest.fn() }));

let auth = { user: { id: "u1" }, activeOrganization: { id: "org-a" } };
jest.mock("./useAuth", () => ({ useAuth: () => auth }));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const summary = (id = "a", page = 1) => ({
  todayMilliseconds: 1000,
  weekMilliseconds: 2000,
  timezone: "America/Argentina/Buenos_Aires",
  items: [
    {
      id,
      projectId: "p1",
      taskId: null,
      startTime: "2026-09-02T10:00:00Z",
      endTime: "2026-09-02T11:00:00Z",
      totalPausedMs: 0,
      project: { id: "p1", name: id },
      task: null,
    },
  ],
  page,
  pageSize: 10,
  total: 11,
  totalPages: 2,
});
const tasks = (items: Array<Record<string, unknown>>) => ({
  items,
  page: 1,
  pageSize: 50,
  total: items.length,
  totalPages: 1,
});

describe("useMobileTime", () => {
  let timer: Record<string, jest.Mock | boolean | null | number | string>;
  beforeEach(() => {
    jest.clearAllMocks();
    auth = { user: { id: "u1" }, activeOrganization: { id: "org-a" } };
    timer = {
      activeTimer: null,
      isPaused: false,
      isLoading: false,
      elapsedSeconds: 0,
      error: null,
      refreshTimer: jest.fn().mockResolvedValue(undefined),
      startTimer: jest.fn().mockResolvedValue(undefined),
      pauseTimer: jest.fn().mockResolvedValue(undefined),
      resumeTimer: jest.fn().mockResolvedValue(undefined),
      stopTimer: jest.fn().mockResolvedValue(undefined),
    };
    (useTimer as jest.Mock).mockImplementation(() => timer);
    (apiGet as jest.Mock).mockImplementation((url: string) =>
      url === "/projects"
        ? Promise.resolve([{ id: "p1", name: "A", isActive: true }])
        : Promise.resolve(summary()),
    );
  });

  it("loads projects, totals and history for organization A", async () => {
    const { result } = renderHook(() => useMobileTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projects[0].name).toBe("A");
    expect(result.current.summary.items[0].id).toBe("a");
  });

  it("clears private state immediately on organization change and logout", async () => {
    const { result } = renderHook(() => useMobileTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => window.dispatchEvent(new Event("organization:changed")));
    expect(result.current.projects).toEqual([]);
    expect(result.current.summary.items).toEqual([]);
    expect(result.current.projectId).toBe("");
    expect(result.current.taskId).toBe("");
    act(() => window.dispatchEvent(new Event("auth:cleared")));
    expect(result.current.summary.todayMilliseconds).toBe(0);
  });

  it("discards a late response from A after switching to B", async () => {
    const lateA =
      deferred<Array<{ id: string; name: string; isActive: boolean }>>();
    (apiGet as jest.Mock)
      .mockImplementationOnce(() => lateA.promise)
      .mockResolvedValueOnce(summary("a"))
      .mockResolvedValueOnce([{ id: "pb", name: "B", isActive: true }])
      .mockResolvedValueOnce(summary("b"));
    const { result, rerender } = renderHook(() => useMobileTime());
    auth = { ...auth, activeOrganization: { id: "org-b" } };
    act(() => window.dispatchEvent(new Event("organization:changed")));
    rerender();
    await waitFor(() => expect(result.current.projects[0]?.name).toBe("B"));
    await act(async () =>
      lateA.resolve([{ id: "pa", name: "A", isActive: true }]),
    );
    expect(result.current.projects[0].name).toBe("B");
  });

  it("keeps only C after a rapid A to B to C transition", async () => {
    const pending =
      deferred<Array<{ id: string; name: string; isActive: boolean }>>();
    (apiGet as jest.Mock).mockImplementation((url: string) =>
      url === "/projects" ? pending.promise : Promise.resolve(summary()),
    );
    const { result, rerender } = renderHook(() => useMobileTime());
    auth = { ...auth, activeOrganization: { id: "org-b" } };
    act(() => window.dispatchEvent(new Event("organization:changed")));
    rerender();
    auth = { ...auth, activeOrganization: { id: "org-c" } };
    act(() => window.dispatchEvent(new Event("organization:changed")));
    rerender();
    await act(async () =>
      pending.resolve([{ id: "pc", name: "C", isActive: true }]),
    );
    expect(
      result.current.projects.every(
        (project) => project.name !== "A" && project.name !== "B",
      ),
    ).toBe(true);
  });

  it("clears task selection and excludes DONE and parent tasks", async () => {
    (apiGet as jest.Mock).mockImplementation((url: string) =>
      url.startsWith("/tasks")
        ? Promise.resolve(
            tasks([
              { id: "ok", title: "OK", status: "TODO", hasSubTasks: false },
              { id: "done", title: "Done", status: "DONE", hasSubTasks: false },
              {
                id: "parent",
                title: "Parent",
                status: "TODO",
                hasSubTasks: true,
              },
            ]),
          )
        : url === "/projects"
          ? Promise.resolve([{ id: "p1", name: "A" }])
          : Promise.resolve(summary()),
    );
    const { result } = renderHook(() => useMobileTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.setProjectId("p1"));
    expect(result.current.tasks.map((task) => task.id)).toEqual(["ok"]);
    act(() => result.current.setTaskId("ok"));
    await act(async () => result.current.setProjectId(""));
    expect(result.current.taskId).toBe("");
    expect(result.current.tasks).toEqual([]);
  });

  it.each(["start", "pause", "resume", "stop"] as const)(
    "invalidates a pending %s after changing organization",
    async (operation) => {
      const mutation = deferred<void>();
      const method = `${operation}Timer`;
      (timer[method] as jest.Mock).mockReturnValue(mutation.promise);
      const { result } = renderHook(() => useMobileTime());
      await waitFor(() => expect(result.current.loading).toBe(false));
      if (operation === "start")
        await act(async () => result.current.setProjectId("p1"));
      let pending!: Promise<void>;
      act(() => {
        pending = result.current[operation]();
      });
      act(() => window.dispatchEvent(new Event("organization:changed")));
      await act(async () => mutation.resolve());
      await pending;
      expect(result.current.summary.items).toEqual([]);
    },
  );

  it("locks double taps synchronously and reconciles an ambiguous failure", async () => {
    const mutation = deferred<void>();
    (timer.pauseTimer as jest.Mock).mockReturnValue(mutation.promise);
    const { result } = renderHook(() => useMobileTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      void result.current.pause();
      void result.current.pause();
    });
    expect(timer.pauseTimer).toHaveBeenCalledTimes(1);
    await act(async () => mutation.reject(new Error("network")));
    await waitFor(() => expect(timer.refreshTimer).toHaveBeenCalled());
  });

  it("does not let a stale load-more page cross organization generations", async () => {
    const older = deferred<ReturnType<typeof summary>>();
    (apiGet as jest.Mock).mockImplementation((url: string) =>
      url.includes("page=2")
        ? older.promise
        : url === "/projects"
          ? Promise.resolve([{ id: "p1", name: "A" }])
          : Promise.resolve(summary("first")),
    );
    const { result } = renderHook(() => useMobileTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      void result.current.loadMore();
      window.dispatchEvent(new Event("organization:changed"));
    });
    await act(async () => older.resolve(summary("old", 2)));
    expect(result.current.summary.items).toEqual([]);
  });

  it("keeps timer state usable when summary loading fails", async () => {
    timer.activeTimer = { id: "active" } as never;
    (apiGet as jest.Mock).mockImplementation((url: string) =>
      url === "/projects"
        ? Promise.resolve([])
        : Promise.reject(new Error("history down")),
    );
    const { result } = renderHook(() => useMobileTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeTimer).toEqual({ id: "active" });
    expect(result.current.secondaryError).toBe("history down");
  });
});
