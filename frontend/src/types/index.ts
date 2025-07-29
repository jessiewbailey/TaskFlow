export type UserRole = 'ANALYST' | 'SUPERVISOR' | 'ADMIN'
export type RequestStatus = 'NEW' | 'IN_REVIEW' | 'PENDING' | 'CLOSED'
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  created_at: string
}

export interface Exercise {
  id: number
  name: string
  description?: string
  is_active: boolean
  is_default: boolean
  created_by?: number
  created_at: string
  updated_at: string
}

export interface ExerciseCreate {
  name: string
  description?: string
  is_active?: boolean
  is_default?: boolean
}

export interface ExerciseUpdate {
  name?: string
  description?: string
  is_active?: boolean
  is_default?: boolean
}

export interface AIOutput {
  id: number
  version: number
  summary?: string
  topic?: string
  sensitivity_score?: number
  redactions_json?: any[]
  custom_instructions?: string
  model_name?: string
  tokens_used?: number
  duration_ms?: number
  created_at: string
}

export interface Task {
  id: number
  text: string
  requester?: string
  date_received: string
  assigned_analyst_id?: number
  workflow_id?: number
  exercise_id?: number
  status: RequestStatus
  due_date?: string
  created_at: string
  updated_at: string
  assigned_analyst?: User
  exercise?: Exercise
  latest_ai_output?: AIOutput
  has_active_jobs?: boolean
  latest_failed_job?: JobProgress
}

export interface TaskList {
  requests: Task[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Legacy type aliases for compatibility - deprecated
// Use Task and TaskList instead

export interface CreateRequestPayload {
  text: string
  requester?: string
  assigned_analyst_id?: number
  exercise_id?: number
}

export interface CreateRequestResponse {
  id: number
  job_id: string
}

export interface UpdateStatusPayload {
  status: RequestStatus
  assigned_analyst_id?: number
}

export interface ProcessRequestPayload {
  instructions?: string
}

export interface JobProgress {
  job_id: string
  request_id: number
  status: JobStatus
  error_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface RequestFilters {
  analyst?: number
  status?: RequestStatus
  exercise_id?: number
  sort_by?: string
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}