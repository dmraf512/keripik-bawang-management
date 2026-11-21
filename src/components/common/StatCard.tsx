import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  helperText?: string;
  emphasis?: 'default' | 'positive' | 'negative' | 'accent';
  isDemo?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  helperText,
  emphasis = 'default',
  isDemo = false,
}) => {
  const valueColorClass =
    emphasis === 'positive'
      ? 'text-[#1E6B43]'
      : emphasis === 'negative'
      ? 'text-[#B4382A]'
      : emphasis === 'accent'
      ? 'text-[#8C6518]'
      : 'text-[#2B1B12]';

  return (
    <div className="bg-white border border-[#E5D9C8] rounded-xl p-5 shadow-2xs transition-colors">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[13px] font-medium text-[#6F574A] truncate">
          {label}
        </span>
        {isDemo && (
          <span className="text-[11px] font-medium text-[#9A6F1C] shrink-0">
            DEMO
          </span>
        )}
      </div>
      <div
        className={`text-xl xl:text-2xl font-display font-semibold tabular-nums tracking-tight ${valueColorClass}`}
      >
        {value}
      </div>
      {helperText && (
        <p className="mt-1.5 text-xs text-[#8A7163] truncate">{helperText}</p>
      )}
    </div>
  );
};
