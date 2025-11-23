import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  amount: number;
  icon: LucideIcon;
  iconColor?: string;
  amountColor?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  amount, 
  icon: Icon, 
  iconColor = 'text-[#004f94]',
  amountColor = 'text-[#212529]'
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center transition-all hover:shadow-md hover:border-[#004f94] group">
      <div className="flex justify-center mb-4">
        <div className={`p-3 rounded-full bg-gray-50 group-hover:bg-opacity-100 transition-colors`}>
           <Icon size={32} className={iconColor} />
        </div>
      </div>
      <h3 className={`text-2xl font-bold mb-1 ${amountColor}`}>
        PKR {amount.toLocaleString()}
      </h3>
      <p className="text-[#6c757d] text-sm font-medium uppercase tracking-wide">{title}</p>
    </div>
  );
};