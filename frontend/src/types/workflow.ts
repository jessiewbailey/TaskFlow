export interface WorkflowBlockInput {
  id: number
  input_type: 'REQUEST_TEXT' | 'BLOCK_OUTPUT'
  source_block_id?: number
  variable_name: string
}

export interface WorkflowBlock {
  id: number
  workflow_id: number
  name: string
  prompt: string
  system_prompt?: string
  order: number
  block_type: 'CORE' | 'CUSTOM'
  output_schema?: Record<string, any>
  model_name?: string
  model_parameters?: Record<string, any>
  inputs: WorkflowBlockInput[]
  created_at: string
  updated_at: string
}

export interface Workflow {
  id: number
  name: string
  description?: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  is_default: boolean
  created_by: number
  blocks: WorkflowBlock[]
  created_at: string
  updated_at: string
}

export interface WorkflowList {
  workflows: Workflow[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Request types
export interface CreateWorkflowBlockInputRequest {
  input_type: 'REQUEST_TEXT' | 'BLOCK_OUTPUT'
  source_block_id?: number
  variable_name: string
}

export interface CreateWorkflowBlockRequest {
  name: string
  prompt: string
  system_prompt?: string
  order: number
  block_type?: 'CORE' | 'CUSTOM'
  output_schema?: Record<string, any>
  model_name?: string
  model_parameters?: Record<string, any>
  inputs: CreateWorkflowBlockInputRequest[]
}

export interface CreateWorkflowRequest {
  name: string
  description?: string
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  is_default?: boolean
  blocks: CreateWorkflowBlockRequest[]
}

export interface UpdateWorkflowRequest {
  name?: string
  description?: string
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  is_default?: boolean
  blocks?: CreateWorkflowBlockRequest[]
}

export interface WorkflowFilters {
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  page?: number
  page_size?: number
}

// Dashboard configuration types
export interface DashboardFieldConfig {
  id: string
  block_name: string
  field_path: string // e.g., "score", "risk_factors", "primary_topic"
  display_type: 'text' | 'progress_bar' | 'badge' | 'list' | 'card' | 'json'
  label: string
  order: number
  width: 'full' | 'half' | 'third' | 'quarter'
  visible: boolean
}

export interface DashboardConfig {
  id?: number
  workflow_id: number
  fields: DashboardFieldConfig[]
  layout: 'grid' | 'list'
  created_at?: string
  updated_at?: string
}