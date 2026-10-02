interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

export default function StatCard({ title, value, icon, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        {icon ? (
          <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center text-2xl`}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
