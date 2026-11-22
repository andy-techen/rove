export interface RoveApi {
  requestMicAccess(): Promise<boolean>
  openMicSettings(): Promise<void>
}

declare global {
  interface Window {
    api: RoveApi
  }
}
