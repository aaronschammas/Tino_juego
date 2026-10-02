interface CircularChartProps {
  percentage: number;
  color?: string;
  size?: number;
}

export default function CircularChart({
  percentage,
  color = 'var(--color-success-700)',
  size = 120,
}: CircularChartProps) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-ink-200)"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-[var(--color-ink-900)]">{percentage}%</span>
      </div>
    </div>
  );
}
