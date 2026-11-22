export interface ChosenProject {
  dir: string
  name: string
  manifest: unknown
}

export interface ImportedBackingTrack {
  file: string
  name: string
}

export interface RoveApi {
  requestMicAccess(): Promise<boolean>
  openMicSettings(): Promise<void>
  chooseProjectFolder(): Promise<ChosenProject | null>
  importBackingTrack(projectDir: string): Promise<ImportedBackingTrack | null>
  saveTake(projectDir: string, wav: ArrayBuffer): Promise<string>
  readAudio(projectDir: string, relPath: string): Promise<Uint8Array>
  writeManifest(projectDir: string, manifest: unknown): Promise<void>
}

declare global {
  interface Window {
    api: RoveApi
  }
}
