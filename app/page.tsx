import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            MCB ManyChat Automation
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered conversation routing and automation system
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Funnel Analytics</h3>
            <p className="text-gray-600 mb-4">
              Monitor conversion funnel performance, A/B test results, and acquisition source effectiveness.
            </p>
            <div className="space-y-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors w-full justify-center"
              >
                Server-Side Dashboard
              </Link>
              <Link
                href="/dashboard/realtime"
                className="inline-flex items-center px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors w-full justify-center"
              >
                Real-time Dashboard
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Payment Tracking</h3>
            <p className="text-gray-600 mb-4">
              Track Stripe payments, abandoned checkouts, and revenue analytics.
            </p>
            <div className="space-y-2">
              <Link
                href="/stripe-logs"
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors w-full justify-center"
              >
                Payment Logs
              </Link>
              <Link
                href="/abandoned-checkouts"
                className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors w-full justify-center"
              >
                Abandoned Checkouts
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">API Endpoints</h2>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <code className="text-sm font-mono text-blue-600">POST /api/ai-router</code>
                <p className="text-gray-600 text-sm mt-1">AI-powered conversation routing and response generation</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <code className="text-sm font-mono text-green-600">POST /api/webhooks</code>
                <p className="text-gray-600 text-sm mt-1">ManyChat webhook receiver for processing incoming messages</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Built with Next.js, TypeScript, Supabase, and OpenAI
          </p>
        </div>
      </div>
    </div>
  );
}
