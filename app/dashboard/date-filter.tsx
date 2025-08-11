'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export function DateFilter({ currentStart, currentEnd }: { currentStart?: string; currentEnd?: string }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(currentStart || '');
  const [endDate, setEndDate] = useState(currentEnd || '');
  const [selectedMonth, setSelectedMonth] = useState('');

  const handleApplyFilter = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedMonth(value);
    
    if (value) {
      const [year, month] = value.split('-');
      const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
      const lastDay = new Date(parseInt(year), parseInt(month), 0);
      
      const params = new URLSearchParams();
      params.set('start', firstDay.toISOString().split('T')[0]);
      params.set('end', lastDay.toISOString().split('T')[0]);
      router.push(`/dashboard?${params.toString()}`);
    }
  };

  const handleReset = () => {
    router.push('/dashboard');
  };

  // Generate last 12 months for dropdown
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Filter by Date</CardTitle>
        <CardDescription>View funnel performance for specific time periods</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Quick Month Select */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Quick Select Month</label>
            <select 
              value={selectedMonth}
              onChange={handleMonthSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
            >
              <option value="">Select a month...</option>
              {months.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilter}
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}