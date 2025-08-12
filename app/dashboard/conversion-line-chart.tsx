'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthData {
  month: string;
  total: number;
  lead: number;
  booked: number;
  attended: number;
  bought: number;
}

export function ConversionLineChart({ monthlyData }: { monthlyData: MonthData[] }) {
  if (!monthlyData || monthlyData.length === 0) {
    return null;
  }

  // Calculate conversion rates for each month
  const chartData = monthlyData.map(data => ({
    month: data.month,
    leadToBooked: data.lead > 0 ? (data.booked / data.lead * 100) : 0,
    bookedToAttended: data.booked > 0 ? (data.attended / data.booked * 100) : 0,
    attendedToBought: data.attended > 0 ? (data.bought / data.attended * 100) : 0,
    overallConversion: data.lead > 0 ? (data.bought / data.lead * 100) : 0,
  }));

  // Find max value for scaling
  const maxRate = Math.max(
    ...chartData.flatMap(d => [d.leadToBooked, d.bookedToAttended, d.attendedToBought, d.overallConversion])
  );
  const scale = maxRate > 0 ? 100 / maxRate : 1;

  // Create SVG path for each metric
  const createPath = (data: number[]) => {
    if (data.length === 0) return '';
    const width = 100 / (data.length - 1);
    return data.map((value, i) => {
      const x = i * width;
      const y = 100 - (value * scale);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const leadToBookedPath = createPath(chartData.map(d => d.leadToBooked));
  const bookedToAttendedPath = createPath(chartData.map(d => d.bookedToAttended));
  const attendedToBoughtPath = createPath(chartData.map(d => d.attendedToBought));
  const overallPath = createPath(chartData.map(d => d.overallConversion));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Conversion Rate Trends</CardTitle>
        <CardDescription className="text-xs">Monthly conversion rates across the funnel</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Line chart */}
          <div className="relative h-48 w-full">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(y => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              
              {/* Data lines */}
              <path
                d={overallPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={leadToBookedPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={bookedToAttendedPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={attendedToBoughtPath}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              
              {/* Data points */}
              {chartData.map((d, i) => {
                const x = i * (100 / (chartData.length - 1));
                return (
                  <g key={i}>
                    <circle cx={x} cy={100 - (d.overallConversion * scale)} r="2" fill="#3b82f6" />
                    <circle cx={x} cy={100 - (d.leadToBooked * scale)} r="2" fill="#10b981" />
                    <circle cx={x} cy={100 - (d.bookedToAttended * scale)} r="2" fill="#f59e0b" />
                    <circle cx={x} cy={100 - (d.attendedToBought * scale)} r="2" fill="#ef4444" />
                  </g>
                );
              })}
            </svg>
            
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8 w-6">
              <span>{Math.round(maxRate)}%</span>
              <span>{Math.round(maxRate * 0.75)}%</span>
              <span>{Math.round(maxRate * 0.5)}%</span>
              <span>{Math.round(maxRate * 0.25)}%</span>
              <span>0%</span>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between text-xs text-gray-600">
            {chartData.map((d, i) => (
              <span key={i}>{d.month}</span>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span>Overall (Lead → Bought)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Lead → Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded" />
              <span>Booked → Attended</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>Attended → Bought</span>
            </div>
          </div>

          {/* Current Month Stats */}
          {chartData.length > 0 && (
            <div className="border-t pt-3 mt-3">
              <h4 className="text-xs font-medium text-gray-600 mb-2">Current Month Rates</h4>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Overall', value: chartData[chartData.length - 1].overallConversion, color: 'text-blue-600' },
                  { label: 'Lead→Book', value: chartData[chartData.length - 1].leadToBooked, color: 'text-green-600' },
                  { label: 'Book→Attend', value: chartData[chartData.length - 1].bookedToAttended, color: 'text-amber-600' },
                  { label: 'Attend→Buy', value: chartData[chartData.length - 1].attendedToBought, color: 'text-red-600' },
                ].map((metric) => (
                  <div key={metric.label} className="text-center">
                    <p className="text-xs text-gray-500">{metric.label}</p>
                    <p className={`text-sm font-semibold ${metric.color}`}>
                      {metric.value.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}