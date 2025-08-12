import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function Loading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ManyChat Dashboard</h1>
        <div className="flex gap-3">
          <div className="h-9 w-32 bg-gray-200 animate-pulse rounded-md" />
          <div className="h-9 w-28 bg-gray-200 animate-pulse rounded-md" />
        </div>
      </div>

      {/* Key Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded mb-2" />
              <div className="h-7 w-20 bg-gray-200 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-3 w-28 bg-gray-200 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Overview Skeleton */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="h-5 w-32 bg-gray-200 animate-pulse rounded mb-2" />
            <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
                  <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
                </div>
                <div className="h-2 w-full bg-gray-200 animate-pulse rounded" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Hot Leads Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-5 w-24 bg-gray-200 animate-pulse rounded mb-2" />
            <div className="h-4 w-40 bg-gray-200 animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 border rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                    <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
                    <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
                  </div>
                  <div className="h-3 w-40 bg-gray-200 animate-pulse rounded" />
                  <div className="h-3 w-48 bg-gray-200 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Cycle Metrics Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-48 bg-gray-200 animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="h-3 w-40 bg-gray-200 animate-pulse rounded mb-2" />
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded mb-1" />
                <div className="h-3 w-28 bg-gray-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}