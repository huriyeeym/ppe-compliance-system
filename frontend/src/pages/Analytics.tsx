export default function Analytics() {
  const charts = [
    { title: 'Violations by Time', description: 'Hourly distribution of PPE violations' },
    { title: 'Compliance Rate', description: 'Overall compliance percentage over time' },
    { title: 'Top Violation Types', description: 'Most common PPE violations' },
    { title: 'Camera Performance', description: 'Violations detected per camera' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title mb-1">Analytics Dashboard</h1>
          <p className="text-caption text-slate-500">Comprehensive insights and trends</p>
        </div>
      </div>

      {/* Charts Grid - Aynı yükseklik */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.map((chart, index) => (
          <div key={index} className="card h-[400px] flex flex-col">
            {/* Başlık - Küçük */}
            <div className="mb-4">
              <h3 className="text-section-title mb-1">{chart.title}</h3>
              <p className="text-caption text-slate-500">{chart.description}</p>
            </div>
            
            {/* Grafik Alanı - Büyük */}
            <div className="flex-1 flex items-center justify-center bg-slate-900/50 rounded-lg">
              <div className="text-center">
                {/* Skeleton Loader */}
                <div className="animate-pulse space-y-4 w-full">
                  <div className="h-8 bg-slate-700 rounded w-3/4 mx-auto"></div>
                  <div className="h-32 bg-slate-700 rounded"></div>
                  <div className="h-4 bg-slate-700 rounded w-1/2 mx-auto"></div>
                </div>
                <p className="text-caption text-slate-500 mt-4">Recharts integration pending</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
