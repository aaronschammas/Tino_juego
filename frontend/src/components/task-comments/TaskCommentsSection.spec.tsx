import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TaskCommentsSection from "./TaskCommentsSection";
import { useTaskComments } from "@/hooks/useTaskComments";

jest.mock("@/hooks/useTaskComments");
const hook = useTaskComments as jest.Mock;
const base = {
  comments: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  retry: jest.fn(),
  loadOlder: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe("TaskCommentsSection", () => {
  beforeEach(() => hook.mockReturnValue({ ...base }));
  it("loads only when the detail section mounts for its selected task", () => {
    render(<TaskCommentsSection projectId="p1" taskId="t1" />);
    expect(hook).toHaveBeenCalledWith("p1", "t1");
  });
  it("renders loading, empty, and retry states", () => {
    hook.mockReturnValue({ ...base, loading: true });
    const { rerender } = render(
      <TaskCommentsSection projectId="p" taskId="t" />,
    );
    expect(screen.getByText(/Cargando comentarios/)).toBeInTheDocument();
    hook.mockReturnValue({ ...base });
    rerender(<TaskCommentsSection projectId="p" taskId="t" />);
    expect(screen.getByText(/Todavía no hay/)).toBeInTheDocument();
    const retry = jest.fn();
    hook.mockReturnValue({ ...base, error: "Falló", retry });
    rerender(<TaskCommentsSection projectId="p" taskId="t" />);
    fireEvent.click(screen.getByText("Reintentar"));
    expect(retry).toHaveBeenCalled();
  });
  it("publishes valid text and prevents blank content", async () => {
    const create = jest.fn().mockResolvedValue(true);
    hook.mockReturnValue({ ...base, create });
    render(<TaskCommentsSection projectId="p" taskId="t" />);
    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nuevo comentario"), {
      target: { value: "avance" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("avance"));
  });
  it("renders deleted and missing-author comments safely", () => {
    hook.mockReturnValue({
      ...base,
      comments: [
        {
          id: "1",
          content: null,
          taskId: "t",
          author: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
          deletedAt: "2026-01-02",
          isEdited: false,
          canEdit: false,
          canDelete: false,
        },
        {
          id: "2",
          content: "<script>alert(1)</script>",
          taskId: "t",
          author: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
          deletedAt: null,
          isEdited: false,
          canEdit: false,
          canDelete: false,
        },
      ],
    });
    render(<TaskCommentsSection projectId="p" taskId="t" />);
    expect(screen.getByText("Comentario eliminado")).toBeInTheDocument();
    expect(screen.getByText("Usuario eliminado")).toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
  it("shows actions only according to API permissions and confirms deletion", async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(window, "confirm").mockReturnValue(true);
    hook.mockReturnValue({
      ...base,
      remove,
      comments: [
        {
          id: "1",
          content: "x",
          taskId: "t",
          author: { id: "u", name: "A", lastname: "B", displayName: "A B" },
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
          deletedAt: null,
          isEdited: true,
          canEdit: true,
          canDelete: true,
        },
      ],
    });
    render(<TaskCommentsSection projectId="p" taskId="t" />);
    expect(screen.getByText(/Editado/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Eliminar"));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("1"));
  });
});
