/// <reference types="vite/client" />
import type { WindowApi } from '@lele/shared-types'

declare global {
  interface Window {
    api: WindowApi
  }
}
export {}
