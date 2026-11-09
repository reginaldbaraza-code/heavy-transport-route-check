/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    __HT_TEST__?: {
      getJobs: () => Array<{ id: string; lastCheckedAt?: string }>
      getAlerts: () => Array<{ change: string; severity: string; status: string }>
      simulateVerdictChange: (jobId: string, verdict: 'READY' | 'HOLD' | 'VERIFY') => unknown
      tickMs?: number
      pdfBytesFromSnapshot: (snapshot: any) => ArrayBuffer
      sanitizePdfText: (value: string | number | boolean | null | undefined) => string
    }
  }
}
