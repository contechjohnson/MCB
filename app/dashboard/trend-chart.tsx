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

export function TrendChart({ monthlyData }: { monthlyData: MonthData[] }) {
  if (!monthlyData || monthlyData.length === 0) {
    return null;
  }

  // Find max value for scaling
  const maxValue = Math.max(...monthlyData.map(d => d.total));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Funnel Trends</CardTitle>
        <CardDescription className="text-xs">Performance over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Mini bar chart */}
          <div className="flex items-end gap-1 h-20">
            {monthlyData.map((data, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-px">
                  {/* Stacked bars */}
                  <div 
                    className="w-full bg-gray-900 rounded-t"
                    style={{ 
                      height: `${(data.bought / maxValue) * 60}px`,
                      minHeight: data.bought > 0 ? '1px' : '0'
                    }}
                    title={`Bought: ${data.bought}`}
                  />
                  <div 
                    className="w-full bg-gray-700"
                    style={{ 
                      height: `${((data.attended - data.bought) / maxValue) * 60}px`,
                      minHeight: data.attended > data.bought ? '1px' : '0'
                    }}
                    title={`Attended: ${data.attended}`}
                  />
                  <div 
                    className="w-full bg-gray-500"
                    style={{ 
                      height: `${((data.booked - data.attended) / maxValue) * 60}px`,
                      minHeight: data.booked > data.attended ? '1px' : '0'
                    }}
                    title={`Booked: ${data.booked}`}
                  />
                  <div 
                    className="w-full bg-gray-300"
                    style={{ 
                      height: `${((data.lead - data.booked) / maxValue) * 60}px`,
                      minHeight: data.lead > data.booked ? '1px' : '0'
                    }}
                    title={`Lead: ${data.lead}`}
                  />
                  <div 
                    className="w-full bg-gray-100 rounded-b"
                    style={{ 
                      height: `${((data.total - data.lead) / maxValue) * 60}px`,
                      minHeight: data.total > data.lead ? '1px' : '0'
                    }}
                    title={`Total: ${data.total}`}
                  />
                </div>
                <span className="text-xs text-gray-600">{data.month}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 rounded" />
              <span>New Contacts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded" />
              <span>Leads</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded" />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-700 rounded" />
              <span>Attended</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-900 rounded" />
              <span>Bought</span>
            </div>
          </div>

          {/* Month over Month Comparison */}
          {monthlyData.length >= 2 && (
            <div className="border-t pt-3 mt-3">
              <h4 className="text-xs font-medium text-gray-600 mb-2">Month-over-Month Change</h4>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Total', current: monthlyData[monthlyData.length - 1].total, prev: monthlyData[monthlyData.length - 2].total },
                  { label: 'Leads', current: monthlyData[monthlyData.length - 1].lead, prev: monthlyData[monthlyData.length - 2].lead },
                  { label: 'Booked', current: monthlyData[monthlyData.length - 1].booked, prev: monthlyData[monthlyData.length - 2].booked },
                  { label: 'Attended', current: monthlyData[monthlyData.length - 1].attended, prev: monthlyData[monthlyData.length - 2].attended },
                  { label: 'Bought', current: monthlyData[monthlyData.length - 1].bought, prev: monthlyData[monthlyData.length - 2].bought },
                ].map((metric) => {
                  const change = metric.prev > 0 ? ((metric.current - metric.prev) / metric.prev * 100) : 0;
                  const isPositive = change >= 0;
                  return (
                    <div key={metric.label} className="text-center">
                      <p className="text-xs text-gray-500">{metric.label}</p>
                      <p className="text-sm font-semibold">{metric.current}</p>
                      <p className={`text-xs ${isPositive ? 'text-gray-600' : 'text-gray-400'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(0)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}