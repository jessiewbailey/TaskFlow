// MSW request handlers for API mocking

import { rest } from 'msw';

// Base API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Mock data
const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'ANALYST',
};

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
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    processing_status: 'COMPLETED',
    ai_outputs: [
      {
        id: 1,
        summary: '{"Summarize": {"summary": "This is a sample analysis"}}',
        created_at: '2024-01-15T10:30:00Z',
      },
    ],
  },
  {
    id: 2,
    text: 'Another request for processing',
    requester: 'user2@example.com',
    status: 'NEW',
    priority: 'medium',
    workflow_id: 2,
    created_at: '2024-01-15T11:00:00Z',
    updated_at: '2024-01-15T11:00:00Z',
    processing_status: 'PENDING',
    queue_position: 3,
  },
];

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

// Request handlers
export const handlers = [
  // Authentication
  rest.post(`${API_URL}/api/auth/login`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'mock-jwt-token',
        token_type: 'bearer',
      })
    );
  }),

  rest.get(`${API_URL}/api/auth/me`, (req, res, ctx) => {
    const token = req.headers.get('Authorization');
    if (!token || !token.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ detail: 'Not authenticated' }));
    }
    return res(ctx.status(200), ctx.json(mockUser));
  }),

  // Workflows
  rest.get(`${API_URL}/api/workflows`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockWorkflows));
  }),

  rest.get(`${API_URL}/api/workflows/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const workflow = mockWorkflows.find((w) => w.id === Number(id));
    
    if (!workflow) {
      return res(ctx.status(404), ctx.json({ detail: 'Workflow not found' }));
    }
    
    return res(ctx.status(200), ctx.json(workflow));
  }),

  rest.post(`${API_URL}/api/workflows`, async (req, res, ctx) => {
    const body = await req.json();
    const newWorkflow = {
      id: mockWorkflows.length + 1,
      ...body,
      status: 'DRAFT',
      is_default: false,
      created_at: new Date().toISOString(),
    };
    
    mockWorkflows.push(newWorkflow);
    return res(ctx.status(201), ctx.json(newWorkflow));
  }),

  rest.put(`${API_URL}/api/workflows/:id`, async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    const workflowIndex = mockWorkflows.findIndex((w) => w.id === Number(id));
    
    if (workflowIndex === -1) {
      return res(ctx.status(404), ctx.json({ detail: 'Workflow not found' }));
    }
    
    mockWorkflows[workflowIndex] = { ...mockWorkflows[workflowIndex], ...body };
    return res(ctx.status(200), ctx.json(mockWorkflows[workflowIndex]));
  }),

  rest.delete(`${API_URL}/api/workflows/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const workflowIndex = mockWorkflows.findIndex((w) => w.id === Number(id));
    
    if (workflowIndex === -1) {
      return res(ctx.status(404), ctx.json({ detail: 'Workflow not found' }));
    }
    
    mockWorkflows.splice(workflowIndex, 1);
    return res(ctx.status(204));
  }),

  // Workflow Embedding Config
  rest.get(`${API_URL}/api/workflows/:id/embedding-config`, (req, res, ctx) => {
    const { id } = req.params;
    
    // Return mock embedding config for workflow 1
    if (Number(id) === 1) {
      return res(
        ctx.status(200),
        ctx.json({
          id: 1,
          workflow_id: 1,
          enabled: true,
          embedding_template: 'Summary: {{Summarize.summary}}',
        })
      );
    }
    
    return res(ctx.status(404));
  }),

  rest.post(`${API_URL}/api/workflows/:id/embedding-config`, async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        workflow_id: Number(id),
        ...body,
      })
    );
  }),

  // Workflow Similarity Config
  rest.get(`${API_URL}/api/workflows/:id/similarity-config`, (req, res, ctx) => {
    return res(ctx.status(404));
  }),

  rest.post(`${API_URL}/api/workflows/:id/similarity-config`, async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        workflow_id: Number(id),
        ...body,
      })
    );
  }),

  // Requests
  rest.get(`${API_URL}/api/requests`, (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page') || 1);
    const pageSize = Number(req.url.searchParams.get('page_size') || 20);
    
    return res(
      ctx.status(200),
      ctx.json({
        items: mockRequests,
        total: mockRequests.length,
        page: page,
        page_size: pageSize,
        total_pages: Math.ceil(mockRequests.length / pageSize),
        has_next: false,
      })
    );
  }),

  rest.get(`${API_URL}/api/requests/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const request = mockRequests.find((r) => r.id === Number(id));
    
    if (!request) {
      return res(ctx.status(404), ctx.json({ detail: 'Request not found' }));
    }
    
    return res(ctx.status(200), ctx.json(request));
  }),

  rest.post(`${API_URL}/api/requests`, async (req, res, ctx) => {
    const body = await req.json();
    const newRequest = {
      id: mockRequests.length + 1,
      ...body,
      status: 'NEW',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      processing_status: 'PENDING',
      queue_position: 5,
    };
    
    mockRequests.push(newRequest);
    return res(ctx.status(201), ctx.json(newRequest));
  }),

  // Exercises
  rest.get(`${API_URL}/api/exercises`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockExercises));
  }),

  // Settings
  rest.get(`${API_URL}/api/settings/system/:key`, (req, res, ctx) => {
    const { key } = req.params;
    
    const settings: Record<string, any> = {
      'ui_show_logs_button': { value: true },
      'ui_show_similarity_features': { value: true },
      'rag-search-enabled': true,
    };
    
    return res(
      ctx.status(200),
      ctx.json(settings[key as string] || { value: false })
    );
  }),

  // SSE Events endpoint
  rest.get(`${API_URL}/api/events`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/event-stream'),
      ctx.set('Cache-Control', 'no-cache'),
      ctx.set('Connection', 'keep-alive'),
      ctx.body('data: {"type": "connection", "data": {"status": "connected"}}\n\n')
    );
  }),

  // RAG Search
  rest.post(`${API_URL}/api/rag-search/search`, async (req, res, ctx) => {
    const body = await req.json();
    
    return res(
      ctx.status(200),
      ctx.json({
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
      })
    );
  }),

  // Jobs
  rest.get(`${API_URL}/api/jobs/:id/status`, (req, res, ctx) => {
    const { id } = req.params;
    
    return res(
      ctx.status(200),
      ctx.json({
        job_id: id,
        request_id: 1,
        status: 'COMPLETED',
        error_message: null,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:05:00Z',
        created_at: '2024-01-15T09:59:00Z',
      })
    );
  }),

  // Catch all handler for unhandled requests
  rest.get('*', (req, res, ctx) => {
    console.error(`Unhandled GET request: ${req.url.toString()}`);
    return res(ctx.status(404));
  }),
  
  rest.post('*', (req, res, ctx) => {
    console.error(`Unhandled POST request: ${req.url.toString()}`);
    return res(ctx.status(404));
  }),
];

// Error handlers for testing error scenarios
export const errorHandlers = {
  networkError: rest.get('*', (req, res) => {
    return res.networkError('Network error');
  }),
  
  serverError: rest.get('*', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ detail: 'Internal server error' })
    );
  }),
  
  unauthorized: rest.get('*', (req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({ detail: 'Unauthorized' })
    );
  }),
};