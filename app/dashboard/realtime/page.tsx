'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Types for our metrics
interface FunnelMetrics {
  dmStarted: number;
  leadCaptured: number;
  bookingShown: number;
  bookingClicked: number;
  booked: number;
  attended: number;
  purchased: number;
}

interface ConversionRates {
  dmToLead: number;
  leadToBookingShown: number;
  bookingShownToClicked: number;
  bookingClickedToBooked: number;
  bookedToAttended: number;
  attendedToPurchased: number;
  overallConversion: number;
}

interface Contact {
  dm_started_at: string | null;
  lead_captured_at: string | null;
  booking_shown_at: string | null;
  booking_clicked_at: string | null;
  booked_at: string | null;
  attended_at: string | null;
  purchased_at: string | null;
  ab_variant: string | null;
  acquisition_source: string | null;
  created_at: string;
  name: string | null;
}

function calculateFunnelMetrics(contacts: Contact[], dateFilter?: Date): FunnelMetrics {
  const filterByDate = (timestamp: string | null) => {
    if (!timestamp) return false;
    if (!dateFilter) return true;
    return new Date(timestamp) >= dateFilter;
  };

  return {
    dmStarted: contacts.filter(c => c.dm_started_at && filterByDate(c.dm_started_at)).length,
    leadCaptured: contacts.filter(c => c.lead_captured_at && filterByDate(c.lead_captured_at)).length,
    bookingShown: contacts.filter(c => c.booking_shown_at && filterByDate(c.booking_shown_at)).length,
    bookingClicked: contacts.filter(c => c.booking_clicked_at && filterByDate(c.booking_clicked_at)).length,
    booked: contacts.filter(c => c.booked_at && filterByDate(c.booked_at)).length,
    attended: contacts.filter(c => c.attended_at && filterByDate(c.attended_at)).length,
    purchased: contacts.filter(c => c.purchased_at && filterByDate(c.purchased_at)).length,
  };
}

function calculateConversionRates(metrics: FunnelMetrics): ConversionRates {
  const safeRate = (numerator: number, denominator: number): number => {
    return denominator > 0 ? (numerator / denominator) * 100 : 0;
  };

  return {
    dmToLead: safeRate(metrics.leadCaptured, metrics.dmStarted),
    leadToBookingShown: safeRate(metrics.bookingShown, metrics.leadCaptured),
    bookingShownToClicked: safeRate(metrics.bookingClicked, metrics.bookingShown),
    bookingClickedToBooked: safeRate(metrics.booked, metrics.bookingClicked),
    bookedToAttended: safeRate(metrics.attended, metrics.booked),
    attendedToPurchased: safeRate(metrics.purchased, metrics.attended),
    overallConversion: safeRate(metrics.purchased, metrics.dmStarted),
  };
}

function MetricCard({ title, value, subtitle, gradient }: { title: string; value: number; subtitle?: string; gradient: string }) {
  return (
    <div className={`${gradient} rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform duration-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          {subtitle && <p className="text-white/70 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
          <div className="h-6 w-6 bg-white/40 rounded"></div>
        </div>
      </div>
    </div>
  );
}

function ConversionRateCard({ title, rate, gradient }: { title: string; rate: number; gradient: string }) {
  return (
    <div className={`${gradient} rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform duration-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold">{rate.toFixed(1)}%</p>
        </div>
        <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
          <div className="h-6 w-6 bg-white/40 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

function FunnelVisualization({ metrics }: { metrics: FunnelMetrics }) {
  const stages = [
    { name: 'DM Started', value: metrics.dmStarted, color: 'bg-blue-500' },
    { name: 'Lead Captured', value: metrics.leadCaptured, color: 'bg-indigo-500' },
    { name: 'Booking Shown', value: metrics.bookingShown, color: 'bg-purple-500' },
    { name: 'Booking Clicked', value: metrics.bookingClicked, color: 'bg-pink-500' },
    { name: 'Booked', value: metrics.booked, color: 'bg-red-500' },
    { name: 'Attended', value: metrics.attended, color: 'bg-orange-500' },
    { name: 'Purchased', value: metrics.purchased, color: 'bg-green-500' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value));

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Interactive Funnel Visualization</h3>
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const width = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const prevStage = index > 0 ? stages[index - 1] : null;
          const conversionRate = prevStage && prevStage.value > 0 ? (stage.value / prevStage.value) * 100 : 100;

          return (
            <div key={stage.name} className="flex items-center space-x-4">
              <div className="w-32 text-sm font-medium text-gray-700">
                {stage.name}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                <div
                  className={`${stage.color} h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all duration-1000 ease-out`}
                  style={{ width: `${Math.max(width, 8)}%` }}
                >
                  {stage.value.toLocaleString()}
                </div>
              </div>
              <div className="w-16 text-right text-sm text-gray-600">
                {index > 0 && `${conversionRate.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="h-10 bg-gray-300 rounded-lg w-96 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-300 h-32 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RealtimeDashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [filteredMetrics, setFilteredMetrics] = useState<FunnelMetrics>({
    dmStarted: 0, leadCaptured: 0, bookingShown: 0, bookingClicked: 0,
    booked: 0, attended: 0, purchased: 0
  });

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          dm_started_at,
          lead_captured_at,
          booking_shown_at,
          booking_clicked_at,
          booked_at,
          attended_at,
          purchased_at,
          ab_variant,
          acquisition_source,
          created_at,
          name
        `);

      if (error) {
        console.error('Error fetching contacts:', error);
        return;
      }

      setContacts(data || []);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error in fetchContacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();

    // Set up real-time subscription
    const subscription = supabase
      .channel('contacts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (contacts.length > 0) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setDate(endDate.getDate() + 1); // Include end date

      const filtered = contacts.filter(contact => {
        const createdDate = new Date(contact.created_at);
        return createdDate >= startDate && createdDate < endDate;
      });

      const metrics = calculateFunnelMetrics(filtered);
      setFilteredMetrics(metrics);
    }
  }, [contacts, dateRange]);

  const totalMetrics = calculateFunnelMetrics(contacts);
  const totalConversionRates = calculateConversionRates(totalMetrics);
  const filteredConversionRates = calculateConversionRates(filteredMetrics);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Real-time Funnel Analytics
              </h1>
              <p className="text-gray-600">
                Live dashboard with interactive filtering and real-time updates
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-lg">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700 font-medium">Live</span>
              <span className="text-xs text-green-600">Updated: {lastUpdate}</span>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
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
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
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
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <button
              onClick={() => setDateRange({
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              })}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Reset to Last 30 Days
            </button>
          </div>
        </div>

        {/* Filtered Metrics */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Filtered Performance ({new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="DM Started"
              value={filteredMetrics.dmStarted}
              subtitle="In selected period"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <MetricCard
              title="Leads Captured"
              value={filteredMetrics.leadCaptured}
              subtitle="In selected period"
              gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            />
            <MetricCard
              title="Booked"
              value={filteredMetrics.booked}
              subtitle="In selected period"
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <MetricCard
              title="Purchased"
              value={filteredMetrics.purchased}
              subtitle="In selected period"
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
          </div>
        </div>

        {/* Filtered Conversion Rates */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Filtered Conversion Rates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ConversionRateCard
              title="DM → Lead"
              rate={filteredConversionRates.dmToLead}
              gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
            <ConversionRateCard
              title="Lead → Booking"
              rate={filteredConversionRates.leadToBookingShown}
              gradient="bg-gradient-to-br from-teal-500 to-teal-600"
            />
            <ConversionRateCard
              title="Booking → Booked"
              rate={filteredConversionRates.bookingClickedToBooked}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <ConversionRateCard
              title="Overall Conversion"
              rate={filteredConversionRates.overallConversion}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        </div>

        {/* Funnel Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <FunnelVisualization metrics={filteredMetrics} />
          
          {/* All-Time Metrics Comparison */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">All-Time vs Filtered Comparison</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Total DM Started</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{totalMetrics.dmStarted.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">Filtered: {filteredMetrics.dmStarted.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Total Purchased</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{totalMetrics.purchased.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">Filtered: {filteredMetrics.purchased.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Overall Conversion Rate</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">{totalConversionRates.overallConversion.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Filtered: {filteredConversionRates.overallConversion.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{contacts.length}</div>
              <div className="text-sm text-gray-600">Total Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {contacts.filter(c => c.dm_started_at).length}
              </div>
              <div className="text-sm text-gray-600">Contacts with DM Started</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {contacts.filter(c => c.purchased_at).length}
              </div>
              <div className="text-sm text-gray-600">Successful Conversions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}