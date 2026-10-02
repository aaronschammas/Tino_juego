import { act, renderHook, waitFor } from "@testing-library/react";
import { useTaskComments } from "./useTaskComments";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
jest.mock("@/lib/api");
jest.mock("./useAuth", () => ({ useAuth: () => ({ activeOrganization: { id: 'org-1' } }) }));
const page = { items: [], nextCursor: null };

describe("useTaskComments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiGet as jest.Mock).mockResolvedValue(page);
  });
  it("fetches on mount using project and task isolation", async () => {
    renderHook(() => useTaskComments("p1", "subtask-1"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/projects/p1/tasks/subtask-1/comments",
      ),
    );
  });
  it("adds a published comment immediately", async () => {
    const item = { id: "c1" };
    (apiPost as jest.Mock).mockResolvedValue(item);
    const { result } = renderHook(() => useTaskComments("p", "t"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.create(" hello ")).toBe(true);
    });
    expect(apiPost).toHaveBeenCalledWith("/projects/p/tasks/t/comments", {
      content: "hello",
    });
    expect(result.current.comments).toEqual([item]);
  });
  it("blocks invalid and duplicate submissions", async () => {
    let resolve!: (value: { id: string }) => void;
    (apiPost as jest.Mock).mockReturnValue(
      new Promise<{ id: string }>((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useTaskComments("p", "t"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.create("   ")).toBe(false);
      expect(await result.current.create("x".repeat(2001))).toBe(false);
    });
    let first: Promise<boolean>;
    act(() => {
      first = result.current.create("ok");
    });
    await act(async () => {
      expect(await result.current.create("again")).toBe(false);
      resolve({ id: "1" });
      await first!;
    });
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
  it("reports a failed comment without adding it", async () => {
    (apiPost as jest.Mock).mockRejectedValue(new Error('No se pudo comentar'));
    const { result } = renderHook(() => useTaskComments('p', 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.create('hola')).toBe(false); });
    expect(result.current.comments).toEqual([]);
    expect(result.current.error).toBe('No se pudo comentar');
  });
  it("updates and deletes in place", async () => {
    const original = { id: "c1", content: "old" };
    (apiGet as jest.Mock).mockResolvedValue({
      items: [original],
      nextCursor: null,
    });
    (apiPatch as jest.Mock).mockResolvedValue({ id: "c1", content: "new" });
    (apiDelete as jest.Mock).mockResolvedValue({
      id: "c1",
      content: null,
      deletedAt: "now",
    });
    const { result } = renderHook(() => useTaskComments("p", "t"));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(() => result.current.update("c1", " new "));
    expect(result.current.comments[0].content).toBe("new");
    await act(() => result.current.remove("c1"));
    expect(result.current.comments[0].content).toBeNull();
  });
  it("prepends older pages", async () => {
    (apiGet as jest.Mock)
      .mockResolvedValueOnce({ items: [{ id: "new" }], nextCursor: "cursor" })
      .mockResolvedValueOnce({ items: [{ id: "old" }], nextCursor: null });
    const { result } = renderHook(() => useTaskComments("p", "t"));
    await waitFor(() => expect(result.current.nextCursor).toBe("cursor"));
    await act(() => result.current.loadOlder());
    expect(result.current.comments.map((x) => x.id)).toEqual(["old", "new"]);
  });
});
