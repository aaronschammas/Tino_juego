import { render, screen } from '@testing-library/react';
import ActivityHeatmap from './ActivityHeatmap';
import { DashboardHeatmapResponse } from '@/types/analytics';

const data: DashboardHeatmapResponse = {
  range: { from: '2026-06-01T03:00:00.000Z', to: '2026-07-01T03:00:00.000Z' },
  timezone: 'America/Argentina/Buenos_Aires',
  groupBy: 'hourOfWeek',
  totals: { minutes: 90, entries: 2, users: 2, projects: 1 },
  cells: [{
    dayOfWeek: 1,
    hour: 14,
    minutes: 90,
    entries: 2,
    users: 2,
    projects: 1,
    outsideBusinessHours: false,
    intensity: 0.8,
  }],
  normalization: { method: 'p95', maxMinutes: 100 },
};

describe('ActivityHeatmap v2', () => {
  it('renders backend-aggregated cells and richer tooltip data', () => {
    render(<ActivityHeatmap data={data} />);
    expect(screen.getByText('Mapa de actividad')).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText(/registrados/i)).toBeInTheDocument();
    
    // Busca el tooltip estructurado
    expect(screen.getByText('Lunes 14:00 — 1h 30m')).toBeInTheDocument();
    expect(screen.getByText('2 usuarios · 2 registros')).toBeInTheDocument();
  });

  it('renders safely with null or empty data', () => {
    render(<ActivityHeatmap data={null} />);
    expect(screen.getByText('0m')).toBeInTheDocument();
    expect(screen.getByText(/registrados/i)).toBeInTheDocument();
    expect(screen.getByText('Dom')).toBeInTheDocument();
    expect(screen.getByText('23h')).toBeInTheDocument();
  });
});
