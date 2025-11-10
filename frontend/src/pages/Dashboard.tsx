import KPICard from '../components/dashboard/KPICard'
import CameraGrid from '../components/dashboard/CameraGrid'
import ViolationsAlert from '../components/dashboard/ViolationsAlert'

export default function Dashboard() {
  return (
    <>
      {/* Welcome Section - Küçültülmüş */}
      <div className="mb-8">
        <h1 className="text-page-title mb-1">Welcome back, User</h1>
        <p className="text-caption text-slate-500">
          Remember, Waqayatuk comes first! 🛡️
        </p>
      </div>

      {/* KPI Cards - Daha belirgin */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Total hard hat violations"
          value="6089"
          icon="🔨"
          trend="+12%"
          color="warning"
        />
        <KPICard
          title="Total vest violations"
          value="7306"
          icon="🦺"
          trend="+8%"
          color="danger"
        />
        <KPICard
          title="Total PPE violations"
          value="13395"
          icon="⚠️"
          trend="+10%"
          color="info"
        />
      </div>

      {/* Main Content Grid - 3 sütun, hizalı */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Camera Grid + Charts */}
        <div className="lg:col-span-2 space-y-6">
          <CameraGrid />
          
          {/* Charts */}
          <div className="card">
            <h3 className="text-section-title mb-4">Violations Trend</h3>
            <div className="h-64 flex items-center justify-center text-slate-500 bg-slate-900/50 rounded-lg">
              <div className="text-center">
                <div className="text-4xl mb-2 opacity-50">📊</div>
                <p className="text-body">Bar Chart Coming Soon</p>
                <p className="text-caption mt-1">Recharts integration pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Alerts */}
        <div className="lg:col-span-1">
          <ViolationsAlert />
        </div>
      </div>
    </>
  )
}
