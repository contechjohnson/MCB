'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

function RefreshButton({ onRefresh, isRefreshing }: RefreshButtonProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={isRefreshing}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
    >
      {isRefreshing ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Refreshing...
        </>
      ) : (
        <>
          <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </>
      )}
    </button>
  );
}

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
  onReset: () => void;
}

function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onReset
}: DateRangeFilterProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h3>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-40">
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div className="flex-1 min-w-40">
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onApply}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
          >
            Apply Filter
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

interface RecentActivityProps {
  activities: any[];
  loading: boolean;
}

function RecentActivity({ activities, loading }: RecentActivityProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="h-10 w-10 bg-gray-300 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-6a2 2 0 00-2 2v3a2 2 0 002 2h6a2 2 0 002-2v-3z" />
          </svg>
          <p>No recent activity</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                activity.type === 'dm_started' ? 'bg-blue-500' :
                activity.type === 'lead_captured' ? 'bg-indigo-500' :
                activity.type === 'booked' ? 'bg-purple-500' :
                activity.type === 'purchased' ? 'bg-green-500' :
                'bg-gray-500'
              }`}>
                {activity.type === 'dm_started' ? 'DM' :
                 activity.type === 'lead_captured' ? 'L' :
                 activity.type === 'booked' ? 'B' :
                 activity.type === 'purchased' ? 'P' :
                 '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {activity.name || 'Unknown Contact'}
                </p>
                <p className="text-xs text-gray-500">
                  {activity.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardClient() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // Set default date range (last 30 days)
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const fetchRecentActivities = async () => {
    try {
      setActivitiesLoading(true);
      
      // Get recent contacts with activity
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('name, dm_started_at, lead_captured_at, booked_at, purchased_at')
        .or('dm_started_at.not.is.null,lead_captured_at.not.is.null,booked_at.not.is.null,purchased_at.not.is.null')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching recent activities:', error);
        return;
      }

      // Transform contacts into activity events
      const activities: any[] = [];
      
      contacts?.forEach(contact => {
        if (contact.dm_started_at) {
          activities.push({
            name: contact.name,
            type: 'dm_started',
            time: new Date(contact.dm_started_at).toLocaleString(),
            timestamp: new Date(contact.dm_started_at)
          });
        }
        if (contact.lead_captured_at) {
          activities.push({
            name: contact.name,
            type: 'lead_captured',
            time: new Date(contact.lead_captured_at).toLocaleString(),
            timestamp: new Date(contact.lead_captured_at)
          });
        }
        if (contact.booked_at) {
          activities.push({
            name: contact.name,
            type: 'booked',
            time: new Date(contact.booked_at).toLocaleString(),
            timestamp: new Date(contact.booked_at)
          });
        }
        if (contact.purchased_at) {
          activities.push({
            name: contact.name,
            type: 'purchased',
            time: new Date(contact.purchased_at).toLocaleString(),
            timestamp: new Date(contact.purchased_at)
          });
        }
      });

      // Sort by timestamp and take the most recent 10
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentActivities(activities.slice(0, 10));
      
    } catch (error) {
      console.error('Error in fetchRecentActivities:', error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();
    
    // Set up real-time subscription for contacts table
    const subscription = supabase
      .channel('contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchRecentActivities();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Simulate refresh delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force a page refresh to get updated data
    window.location.reload();
  };

  const handleApplyDateFilter = () => {
    // In a real implementation, this would trigger a re-fetch of data with the date range
    console.log('Applying date filter:', { startDate, endDate });
    // For now, just show an alert
    alert(`Date filter applied: ${startDate} to ${endDate}\n\nNote: This is a demo - in production, this would filter the dashboard data.`);
  };

  const handleResetDateFilter = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  return (
    <div className="mt-8">
      {/* Controls Section */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dashboard Controls</h3>
            <p className="text-sm text-gray-600 mt-1">
              Last updated: {lastRefresh}
            </p>
          </div>
          <RefreshButton onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={handleApplyDateFilter}
        onReset={handleResetDateFilter}
      />

      {/* Recent Activity */}
      <RecentActivity activities={recentActivities} loading={activitiesLoading} />
    </div>
  );
}