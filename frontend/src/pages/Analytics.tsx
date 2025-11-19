import { useState } from 'react'

export default function Analytics() {
  const [selectedDomain, setSelectedDomain] = useState<string>('construction')

  const domains = [
    { id: 'construction', name: 'İnşaat Alanı', icon: '🏗️', status: 'active' },
    { id: 'manufacturing', name: 'Üretim Sanayi', icon: '🏭', status: 'active' },
    { id: 'mining', name: 'Madencilik', icon: '⛏️', status: 'planned' },
  ]

  const charts = [
    { 
      title: 'İhlal Trendi (Zaman Bazlı)', 
      description: 'Seçili domain için saatlik/günlük ihlal dağılımı',
      domainSpecific: true,
    },
    { 
      title: 'Uyumluluk Oranı', 
      description: 'Genel uyumluluk yüzdesi zaman içinde',
      domainSpecific: true,
    },
    { 
      title: 'PPE Türü Bazlı İhlaller', 
      description: 'Hangi PPE türlerinde en çok ihlal var?',
      domainSpecific: true,
    },
    { 
      title: 'Kamera Performansı', 
      description: 'Kamera bazlı tespit sayıları ve doğruluk',
      domainSpecific: true,
    },
  ]

  const currentDomain = domains.find(d => d.id === selectedDomain)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title mb-1">Analitik Dashboard</h1>
          <p className="text-caption text-slate-500">Kapsamlı içgörüler ve trendler</p>
        </div>
      </div>

      {/* Domain Selector */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-caption text-slate-400 mb-2">Analiz Domain'i:</p>
        <div className="flex gap-2">
          {domains
            .filter(d => d.status === 'active')
            .map((domain) => (
              <button
                key={domain.id}
                onClick={() => setSelectedDomain(domain.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectedDomain === domain.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }
                `}
              >
                <span className="mr-2">{domain.icon}</span>
                {domain.name}
              </button>
            ))}
        </div>
      </div>

      {/* Charts Grid - Domain bazlı */}
      {currentDomain?.status === 'active' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {charts.map((chart, index) => (
            <div key={index} className="card h-[400px] flex flex-col">
              {/* Başlık - Küçük */}
              <div className="mb-4">
                <h3 className="text-section-title mb-1">{chart.title}</h3>
                <p className="text-caption text-slate-500">{chart.description}</p>
                {chart.domainSpecific && (
                  <p className="text-caption text-purple-400 mt-1">
                    {currentDomain.icon} {currentDomain.name}
                  </p>
                )}
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
      ) : (
        <div className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-30">⏳</div>
            <h3 className="text-section-title mb-2">Model Eğitimi Bekleniyor</h3>
            <p className="text-body text-slate-500">
              {currentDomain?.name} domain'i için analitik veriler henüz mevcut değil.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
