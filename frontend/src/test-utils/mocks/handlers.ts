// MSW request handlers for API mocking

import { http, HttpResponse } from 'msw';

// Base API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Mock data
const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'ANALYST',
};

const mockExercises = [
  {
    id: 1,
    name: 'Default Exercise',
    description: 'Default exercise for all users',
    is_active: true,
    is_default: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

const mockWorkflows = [
  {
    id: 1,
    name: 'Summarization Workflow',
    description: 'Summarizes input text',
    status: 'ACTIVE',
    is_default: true,
    created_at: '2024-01-01T00:00:00Z',
    blocks: [
      {
        id: 1,
        name: 'Summarize',
        prompt: 'Summarize the following: {{REQUEST_TEXT}}',
        order: 1,
        block_type: 'CUSTOM',
      },
    ],
  },
  {
    id: 2,
    name: 'Analysis Workflow',
    description: 'Analyzes text for insights',
    status: 'ACTIVE',
    is_default: false,
    created_at: '2024-01-02T00:00:00Z',
    blocks: [],
  },
];

const mockRequests = [
  {
    id: 1,
    text: 'Please analyze this sample text',
    requester: 'user1@example.com',
    status: 'COMPLETED',
    priority: 'high',
    workflow_id: 1,
    exercise_id: 1,
    assigned_analyst_id: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    processing_status: 'COMPLETED',
    has_active_jobs: false,
    queue_position: null,
    latest_job_id: null,
    embedding_status: 'COMPLETED',
    assigned_analyst: mockUser,
    exercise: mockExercises[0],
    latest_ai_output: {
      id: 1,
      summary: '{"Summarize": {"summary": "This is a sample analysis"}}',
      created_at: '2024-01-15T10:30:00Z',
    },
    latest_failed_job: null,
  },
  {
    id: 2,
    text: 'Another request for processing',
    requester: 'user2@example.com',
    status: 'NEW',
    priority: 'medium',
    workflow_id: 2,
    exercise_id: 1,
    assigned_analyst_id: null,
    created_at: '2024-01-15T11:00:00Z',
    updated_at: '2024-01-15T11:00:00Z',
    processing_status: 'PENDING',
    has_active_jobs: true,
    queue_position: 3,
    latest_job_id: 'job-123',
    embedding_status: 'PENDING',
    assigned_analyst: null,
    exercise: mockExercises[0],
    latest_ai_output: null,
    latest_failed_job: null,
  },
];

// Request handlers
export const handlers = [
  // Authentication
  http.post(`${API_URL}/api/auth/login`, () => {
    return HttpResponse.json({
      access_token: 'mock-jwt-token',
      token_type: 'bearer',
    });
  }),

  http.get(`${API_URL}/api/auth/me`, ({ request }) => {
    const token = request.headers.get('Authorization');
    if (!token || !token.startsWith('Bearer ')) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    return HttpResponse.json(mockUser);
  }),

  // Workflows
  http.get(`${API_URL}/api/workflows`, () => {
    return HttpResponse.json(mockWorkflows);
  }),

  http.get(`${API_URL}/api/workflows/:id`, ({ params }) => {
    const { id } = params;
    const workflow = mockWorkflows.find((w) => w.id === Number(id));
    
    if (!workflow) {
      return HttpResponse.json({ detail: 'Workflow not found' }, { status: 404 });
    }
    
    return HttpResponse.json(workflow);
  }),

  http.post(`${API_URL}/api/workflows`, async ({ request }) => {
    const body = await request.json();
    const newWorkflow = {
      id: mockWorkflows.length + 1,
      ...body,
      status: 'DRAFT',
      is_default: false,
      created_at: new Date().toISOString(),
    };
    
    mockWorkflows.push(newWorkflow);
    return HttpResponse.json(newWorkflow, { status: 201 });
  }),

  http.put(`${API_URL}/api/workflows/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const workflowIndex = mockWorkflows.findIndex((w) => w.id === Number(id));
    
    if (workflowIndex === -1) {
      return HttpResponse.json({ detail: 'Workflow not found' }, { status: 404 });
    }
    
    mockWorkflows[workflowIndex] = { ...mockWorkflows[workflowIndex], ...body };
    return HttpResponse.json(mockWorkflows[workflowIndex]);
  }),

  http.delete(`${API_URL}/api/workflows/:id`, ({ params }) => {
    const { id } = params;
    const workflowIndex = mockWorkflows.findIndex((w) => w.id === Number(id));
    
    if (workflowIndex === -1) {
      return HttpResponse.json({ detail: 'Workflow not found' }, { status: 404 });
    }
    
    mockWorkflows.splice(workflowIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Workflow Embedding Config
  http.get(`${API_URL}/api/workflows/:id/embedding-config`, ({ params }) => {
    const { id } = params;
    
    // Return mock embedding config for workflow 1
    if (Number(id) === 1) {
      return HttpResponse.json({
        id: 1,
        workflow_id: 1,
        enabled: true,
        embedding_template: 'Summary: {{Summarize.summary}}',
      });
    }
    
    return new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API_URL}/api/workflows/:id/embedding-config`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    
    return HttpResponse.json({
      id: 1,
      workflow_id: Number(id),
      ...body,
    });
  }),

  // Workflow Similarity Config
  http.get(`${API_URL}/api/workflows/:id/similarity-config`, () => {
    return new HttpResponse(null, { status: 404 });
  }),

  http.post(`${API_URL}/api/workflows/:id/similarity-config`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    
    return HttpResponse.json({
      id: 1,
      workflow_id: Number(id),
      ...body,
    });
  }),

  // Requests
  http.get(`${API_URL}/api/requests`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('page_size') || 20);
    
    return HttpResponse.json({
      items: mockRequests,
      total: mockRequests.length,
      page: page,
      page_size: pageSize,
      total_pages: Math.ceil(mockRequests.length / pageSize),
      has_next: false,
    });
  }),

  http.get(`${API_URL}/api/requests/:id`, ({ params }) => {
    const { id } = params;
    const request = mockRequests.find((r) => r.id === Number(id));
    
    if (!request) {
      return HttpResponse.json({ detail: 'Request not found' }, { status: 404 });
    }
    
    return HttpResponse.json(request);
  }),

  http.post(`${API_URL}/api/requests`, async ({ request }) => {
    const body = await request.json();
    const newRequest = {
      id: mockRequests.length + 1,
      ...body,
      status: 'NEW',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      processing_status: 'PENDING',
      has_active_jobs: false,
      queue_position: 5,
      latest_job_id: null,
      embedding_status: 'PENDING',
      assigned_analyst: null,
      exercise: mockExercises[0],
      latest_ai_output: null,
      latest_failed_job: null,
    };
    
    mockRequests.push(newRequest);
    return HttpResponse.json(newRequest, { status: 201 });
  }),

  // Exercises
  http.get(`${API_URL}/api/exercises`, () => {
    return HttpResponse.json(mockExercises);
  }),

  // Settings
  http.get(`${API_URL}/api/settings/system/:key`, ({ params }) => {
    const { key } = params;
    
    const settings: Record<string, any> = {
      'ui_show_logs_button': { value: true },
      'ui_show_similarity_features': { value: true },
      'rag-search-enabled': true,
    };
    
    return HttpResponse.json(settings[key as string] || { value: false });
  }),

  // SSE Events endpoint
  http.get(`${API_URL}/api/events`, () => {
    return new HttpResponse('data: {"type": "connection", "data": {"status": "connected"}}\\n\\n', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  // RAG Search
  http.post(`${API_URL}/api/rag-search/search`, async ({ request }) => {
    const body = await request.json();
    
    return HttpResponse.json({
      results: [
        {
          task_id: 1,
          title: 'Task #1',
          description: 'Similar task found',
          similarity_score: 0.95,
          status: 'COMPLETED',
          priority: 'high',
          created_at: '2024-01-10T00:00:00Z',
        },
      ],
      query: body.query,
      total_results: 1,
    });
  }),

  // Jobs
  http.get(`${API_URL}/api/jobs/:id/status`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      job_id: id,
      request_id: 1,
      status: 'COMPLETED',
      error_message: null,
      started_at: '2024-01-15T10:00:00Z',
      completed_at: '2024-01-15T10:05:00Z',
      created_at: '2024-01-15T09:59:00Z',
    });
  }),

  // Catch all handler for unhandled requests
  http.get('*', ({ request }) => {
    console.error(`Unhandled GET request: ${request.url}`);
    return new HttpResponse(null, { status: 404 });
  }),
  
  http.post('*', ({ request }) => {
    console.error(`Unhandled POST request: ${request.url}`);
    return new HttpResponse(null, { status: 404 });
  }),
];

// Error handlers for testing error scenarios
export const errorHandlers = {
  networkError: http.get('*', () => {
    return HttpResponse.error();
  }),
  
  serverError: http.get('*', () => {
    return HttpResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }),
  
  unauthorized: http.get('*', () => {
    return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }),
};