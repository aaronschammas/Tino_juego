import React, { memo, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { DashboardHeatmapResponse } from '@/types/analytics';

interface Props {
  data: DashboardHeatmapResponse | null;
  className?: string;
}

const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);

const formatMinutes = (minutes: number) => {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
};

const ActivityHeatmap = ({ data, className = '' }: Props) => {
  const cells = useMemo(
    () => new Map((data?.cells ?? []).map((cell) => [`${cell.dayOfWeek}:${cell.hour}`, cell])),
    [data?.cells],
  );

  const totalTimeStr = useMemo(() => {
    return formatMinutes(data?.totals.minutes ?? 0);
  }, [data?.totals.minutes]);

  return (
    <Card className={`p-6 shadow-sm border-gray-100 flex flex-col overflow-hidden ${className}`}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-[16px] font-bold text-gray-900">Mapa de actividad</h3>
          <p className="text-[13px] text-gray-500 font-medium">
            Distribución del tiempo registrado por día y hora · <span className="font-bold text-slate-700">{totalTimeStr}</span> registrados
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Menos</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((opacity) => (
              <div
                key={opacity}
                className="w-3.5 h-3.5 rounded-md border border-slate-100"
                style={{ backgroundColor: opacity === 0 ? '#f8fafc' : `rgba(30, 58, 95, ${opacity})` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Más</span>
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 overflow-hidden">
        <div className="w-full pr-2">
          <div className="flex mb-2 ml-12">
            {HOURS.map((hour) => (
              <div key={hour} className="flex-1 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">{hour}h</div>
            ))}
          </div>
          <div className="space-y-1.5">
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center">
                <div className="w-12 text-xs font-bold text-slate-500 uppercase tracking-wider">{day}</div>
                <div className="flex flex-1 gap-1.5">
                  {HOURS.map((hour) => {
                    const cell = cells.get(`${dayIndex}:${hour}`);
                    const minutes = cell?.minutes ?? 0;
                    const formattedCellTime = formatMinutes(minutes);
                    const tooltipAlign = hour <= 2 ? 'left' : hour >= 21 ? 'right' : 'center';
                    return (
                      <div
                        key={`${day}-${hour}`}
                        className="flex-1 aspect-square rounded-[4px] border border-slate-100/50 relative group cursor-pointer transition-all hover:scale-105"
                        style={{
                          backgroundColor: cell
                            ? `rgba(30, 58, 95, ${Math.max(0.15, cell.intensity)})`
                            : '#f8fafc',
                        }}
                      >
                        <div
                          className={`absolute opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] p-2.5 rounded-xl z-20 -top-12 whitespace-nowrap pointer-events-none transition-opacity shadow-md border border-slate-800 ${
                            tooltipAlign === 'left'
                              ? 'left-0'
                              : tooltipAlign === 'right'
                                ? 'right-0'
                                : 'left-1/2 -translate-x-1/2'
                          }`}
                        >
                          <p className="font-bold mb-0.5">{DAYS_FULL[dayIndex]} {hour}:00 — {formattedCellTime}</p>
                          <p className="text-slate-300 font-medium">
                            {cell?.users ?? 0} {cell?.users === 1 ? 'usuario' : 'usuarios'} · {cell?.entries ?? 0} {cell?.entries === 1 ? 'registro' : 'registros'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default memo(ActivityHeatmap);
