'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DateFilterMinimal({ currentStart, currentEnd }: { currentStart?: string; currentEnd?: string }) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [startDate, setStartDate] = useState(currentStart || '');
  const [endDate, setEndDate] = useState(currentEnd || '');

  const handleApplyFilter = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.push(`/dashboard?${params.toString()}`);
    setIsExpanded(false);
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === 'all') {
      router.push('/dashboard');
      setIsExpanded(false);
      return;
    }
    
    if (value) {
      const [year, month] = value.split('-');
      const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
      const lastDay = new Date(parseInt(year), parseInt(month), 0);
      
      const params = new URLSearchParams();
      params.set('start', firstDay.toISOString().split('T')[0]);
      params.set('end', lastDay.toISOString().split('T')[0]);
      router.push(`/dashboard?${params.toString()}`);
      setIsExpanded(false);
    }
  };

  const handleReset = () => {
    router.push('/dashboard');
    setIsExpanded(false);
  };

  // Generate last 12 months for dropdown
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months.push({ value, label });
  }

  const hasFilter = currentStart || currentEnd;

  return (
    <div className="flex items-center gap-3 mb-2">
      {/* Quick month selector - always visible */}
      <select 
        onChange={handleMonthSelect}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
        defaultValue=""
      >
        <option value="">Filter by month...</option>
        <option value="all">All Time</option>
        {months.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {/* Custom date range toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        Custom Range
      </button>

      {/* Show active filter indicator */}
      {hasFilter && (
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <span>Filtered</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Expandable custom date range */}
      {isExpanded && (
        <div className="flex items-center gap-2 pl-2 border-l border-gray-300">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
          <button
            onClick={handleApplyFilter}
            className="px-3 py-1 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}