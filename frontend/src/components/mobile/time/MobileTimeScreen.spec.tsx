import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MobileTimeScreen from "./MobileTimeScreen";
import { useMobileTime } from "@/hooks/useMobileTime";

jest.mock("@/hooks/useMobileTime", () => ({ useMobileTime: jest.fn() }));

const base = {
  loading: false,
  isLoading: false,
  actionPending: false,
  activeTimer: null,
  isPaused: false,
  elapsedSeconds: 0,
  error: null,
  secondaryError: null,
  projects: [{ id: "p1", name: "Proyecto" }],
  tasks: [],
  projectId: "",
  taskId: "",
  summary: {
    todayMilliseconds: 0,
    weekMilliseconds: 0,
    timezone: "America/Argentina/Buenos_Aires",
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  setProjectId: jest.fn(),
  setTaskId: jest.fn(),
  start: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  stop: jest.fn(),
  retry: jest.fn(),
  loadMore: jest.fn(),
  refreshTimer: jest.fn(),
};

describe("MobileTimeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMobileTime as jest.Mock).mockReturnValue(base);
  });
  it("does not present zero as confirmed while loading", () => {
    (useMobileTime as jest.Mock).mockReturnValue({ ...base, loading: true });
    render(<MobileTimeScreen />);
    expect(screen.getByLabelText(/cargando registro/i)).toBeInTheDocument();
    expect(screen.queryByText("00:00:00")).not.toBeInTheDocument();
  });
  it("renders accessible selection and starts once per click", async () => {
    (useMobileTime as jest.Mock).mockReturnValue({ ...base, projectId: "p1" });
    render(<MobileTimeScreen />);
    expect(screen.getByRole("heading", { name: "Tiempo" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /iniciar/i }));
    expect(base.start).toHaveBeenCalledTimes(1);
  });
  it("shows a paused server timer and resume/stop controls", () => {
    (useMobileTime as jest.Mock).mockReturnValue({
      ...base,
      isPaused: true,
      activeTimer: { id: "e1", project: { name: "P" }, task: { title: "T" } },
    });
    render(<MobileTimeScreen />);
    expect(screen.getByText("Pausado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reanudar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /detener/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /horas confirmadas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/registros finalizados por el servidor/i),
    ).toBeInTheDocument();
  });
});
