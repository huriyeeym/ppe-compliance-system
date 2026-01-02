import { AlertTriangle, User, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { audioAlert } from '../../lib/utils/audioAlert'

interface ViolationAlertData {
  track_id: number
  reason: string
  missing_ppe: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp?: string
}

/**
 * Show violation alert with sound and toast notification
 */
export function showViolationAlert(data: ViolationAlertData) {
  // Play alert sound based on severity
  audioAlert.playAlert(data.severity)

  // Show toast notification
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${data.severity === 'critical' ? 'bg-red-600' :
                  data.severity === 'high' ? 'bg-orange-500' :
                  data.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}
              `}>
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-slate-50">
                İhlal Tespit Edildi
              </p>
              <div className="mt-1 text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>Kişi #{data.track_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Eksik: {data.missing_ppe.join(', ')}</span>
                </div>
                {data.timestamp && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(data.timestamp).toLocaleTimeString('tr-TR')}</span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {data.reason}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-slate-700">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-slate-200 focus:outline-none"
          >
            Kapat
          </button>
        </div>
      </div>
    ),
    {
      duration: data.severity === 'critical' ? 10000 : 5000,
      position: 'top-right',
    }
  )
}

/**
 * Show success notification
 */
export function showSuccessAlert(message: string) {
  audioAlert.playSuccess()
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  })
}

/**
 * Show error notification
 */
export function showErrorAlert(message: string) {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
  })
}

/**
 * Show info notification
 */
export function showInfoAlert(message: string) {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: '📋',
  })
}
