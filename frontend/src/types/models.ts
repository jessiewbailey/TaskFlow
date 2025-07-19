export interface OllamaModel {
  name: string
  size: number
  modified_at: string
  digest: string
  details: Record<string, any>
}

export interface OllamaModelsResponse {
  models: OllamaModel[]
  total: number
  error?: string
}