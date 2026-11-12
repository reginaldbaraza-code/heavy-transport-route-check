/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    __HT_TEST__?: {
      getJobs: () => Array<{ id: string; lastCheckedAt?: string }>
      getAlerts: () => Array<{ change: string; severity: string; status: string }>
      getHistory?: () => unknown[]
      getStore?: (key: string) => unknown
      setStore?: (key: string, value: unknown) => void
      flushStore?: () => void | Promise<void>
      simulateVerdictChange: (jobId: string, verdict: 'READY' | 'HOLD' | 'VERIFY') => unknown
      tickMs?: number
      pdfBytesFromSnapshot: (snapshot: any) => ArrayBuffer | Promise<ArrayBuffer>
      sanitizePdfText: (value: string | number | boolean | null | undefined) => string | Promise<string>
    }
  }
}
