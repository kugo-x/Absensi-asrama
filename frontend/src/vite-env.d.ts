/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' = mode demo tanpa backend (data contoh dari mockData) */
  readonly VITE_OFFLINE_DEMO?: string
}
