import Card from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { LayoutGrid, CheckCircle2, Timer, Activity } from 'lucide-react';
import { memo } from 'react';

type KPIStatTone = 'primary' | 'success' | 'secondary' | 'accent' | 'danger';

interface KPIStatCardProps {
  label: string;
  value: string | number;
  meta: string;
  tone: KPIStatTone;
  trend?: string; // Ej: "+ 12%"
}

const iconMap: Record<KPIStatTone, React.ElementType> = {
  primary: LayoutGrid,
  success: CheckCircle2,
  secondary: Timer,
  accent: Activity,
  danger: Activity, // Fallback
};

const iconColorMap: Record<KPIStatTone, string> = {
  primary: 'text-[#1e3a5f]',
  success: 'text-[#059669]',
  secondary: 'text-[#0284c7]',
  accent: 'text-[#d97706]',
  danger: 'text-[#dc2626]',
};

const iconBgMap: Record<KPIStatTone, string> = {
  primary: 'bg-[#e8eef5]',
  success: 'bg-[#d1fae5]',
  secondary: 'bg-[#e0f2fe]',
  accent: 'bg-[#fef3c7]',
  danger: 'bg-[#fee2e2]',
};

const KPIStatCard = ({ label, value, meta, tone }: KPIStatCardProps) => {
  const Icon = iconMap[tone];
  const iconColor = iconColorMap[tone];
  const iconBg = iconBgMap[tone];

  return (
    <Card className="p-6 shadow-sm border-gray-100 relative overflow-hidden">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg, iconColor)}>
            <Icon size={20} />
          </div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        </div>

        <div className="space-y-1">
          <h2 className="text-[32px] font-extrabold text-gray-900 tracking-tight leading-none">
            {value}
          </h2>
          <p className="text-[13px] text-gray-500 font-medium">{meta}</p>
        </div>
      </div>
    </Card>
  );
}

export default memo(KPIStatCard);
