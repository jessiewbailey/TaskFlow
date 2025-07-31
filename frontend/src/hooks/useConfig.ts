import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export interface AppConfig {
  name: string;
  title: string;
}

export interface UILabels {
  app: {
    name: string;
    title: string;
    description: string;
  };
  terminology: {
    task: string;
    tasks: string;
    request: string;
    requests: string;
    requester: string;
    analyst: string;
    processing: string;
    workflow: string;
    workflows: string;
    new_task: string;
    new_request: string;
    [key: string]: string;
  };
  dashboard: {
    title: string;
    filters: string;
    search_placeholder: string;
    no_tasks: string;
    loading: string;
    table: {
      [key: string]: string;
    };
    actions: {
      [key: string]: string;
    };
  };
  forms: {
    [key: string]: any;
  };
  settings: {
    [key: string]: any;
  };
  errors: {
    [key: string]: string;
  };
  success: {
    [key: string]: string;
  };
  confirmations: {
    [key: string]: string;
  };
  navigation: {
    [key: string]: string;
  };
}

export interface DashboardConfig {
  refresh_interval?: number;
  max_recent_items?: number;
  metrics?: Array<{
    name: string;
    title: string;
    query: string;
  }>;
}

export interface WorkflowConfig {
  default_workflow_id?: number;
  auto_assign?: boolean;
  stages?: Array<{
    name: string;
    description: string;
    required: boolean;
    [key: string]: any;
  }>;
}

export interface SecurityConfig {
  access_control?: {
    require_assignment?: boolean;
    allow_self_assignment?: boolean;
    supervisor_override?: boolean;
  };
  privacy?: {
    mask_sensitive_data?: boolean;
    audit_trail?: boolean;
  };
}

// Hook to get app configuration
export const useAppConfig = () => {
  return useQuery<AppConfig>({
    queryKey: ['config', 'app-info'],
    queryFn: async () => {
      const response = await api.get('/config/app-info');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to get UI labels
export const useUILabels = () => {
  return useQuery<UILabels>({
    queryKey: ['config', 'ui-labels'],
    queryFn: async () => {
      const response = await api.get('/config/ui-labels');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to get dashboard configuration
export const useDashboardConfig = () => {
  return useQuery<DashboardConfig>({
    queryKey: ['config', 'dashboard'],
    queryFn: async () => {
      const response = await api.get('/config/dashboard');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to get workflow configuration
export const useWorkflowConfig = () => {
  return useQuery<WorkflowConfig>({
    queryKey: ['config', 'workflow'],
    queryFn: async () => {
      const response = await api.get('/config/workflow');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to get security configuration
export const useSecurityConfig = () => {
  return useQuery<SecurityConfig>({
    queryKey: ['config', 'security'],
    queryFn: async () => {
      const response = await api.get('/config/security');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to refresh configuration
export const useRefreshConfig = () => {
  return async () => {
    await api.post('/config/refresh');
  };
};