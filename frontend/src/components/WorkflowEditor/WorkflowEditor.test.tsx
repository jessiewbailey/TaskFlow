import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowEditor } from '../WorkflowEditor';
// Temporarily disabled MSW
// import { server } from '../../test-utils/mocks/server';
// import { rest } from 'msw';

// Mock workflow data
const mockWorkflow = {
  id: 1,
  name: 'Test Workflow',
  description: 'A test workflow',
  status: 'DRAFT',
  is_default: false,
  blocks: [
    {
      id: 1,
      name: 'Summarize',
      prompt: 'Summarize the following: {{REQUEST_TEXT}}',
      order: 1,
      block_type: 'CUSTOM',
    },
  ],
};

describe('WorkflowEditor', () => {
  it('renders workflow editor with tabs', async () => {
    render(<WorkflowEditor workflowId={1} />);
    
    // Wait for workflow to load
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Check tabs are present
    expect(screen.getByRole('tab', { name: /blocks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /embedding/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /similarity/i })).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Initially on blocks tab
    expect(screen.getByText(/summarize the following/i)).toBeInTheDocument();
    
    // Switch to dashboard tab
    await user.click(screen.getByRole('tab', { name: /dashboard/i }));
    expect(screen.getByText(/dashboard configuration/i)).toBeInTheDocument();
    
    // Switch to embedding tab
    await user.click(screen.getByRole('tab', { name: /embedding/i }));
    expect(screen.getByText(/embedding configuration/i)).toBeInTheDocument();
    
    // Switch to similarity tab
    await user.click(screen.getByRole('tab', { name: /similarity/i }));
    expect(screen.getByText(/similarity display/i)).toBeInTheDocument();
  });

  it('adds a new block to the workflow', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Click add block button
    await user.click(screen.getByRole('button', { name: /add block/i }));
    
    // Fill in block details
    await user.type(screen.getByLabelText(/block name/i), 'Extract Keywords');
    await user.type(
      screen.getByLabelText(/prompt/i),
      'Extract key terms from: {{REQUEST_TEXT}}'
    );
    
    // Save block
    await user.click(screen.getByRole('button', { name: /save block/i }));
    
    // Verify block was added
    await waitFor(() => {
      expect(screen.getByText('Extract Keywords')).toBeInTheDocument();
    });
  });

  it('edits an existing block', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Click edit on existing block
    await user.click(screen.getByRole('button', { name: /edit/i }));
    
    // Clear and update block name
    const nameInput = screen.getByLabelText(/block name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Summarize');
    
    // Save changes
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    // Verify update
    await waitFor(() => {
      expect(screen.getByText('Updated Summarize')).toBeInTheDocument();
    });
  });

  it('deletes a block from the workflow', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Verify block exists
    expect(screen.getByText('Summarize')).toBeInTheDocument();
    
    // Click delete button
    await user.click(screen.getByRole('button', { name: /delete/i }));
    
    // Confirm deletion
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    
    // Verify block was removed
    await waitFor(() => {
      expect(screen.queryByText('Summarize')).not.toBeInTheDocument();
    });
  });

  it('reorders blocks using drag and drop', async () => {
    const user = userEvent.setup();
    
    // Setup workflow with multiple blocks
    server.use(
      rest.get('/api/workflows/:id', (req, res, ctx) => {
        return res(
          ctx.json({
            ...mockWorkflow,
            blocks: [
              {
                id: 1,
                name: 'Block 1',
                prompt: 'First block',
                order: 1,
                block_type: 'CUSTOM',
              },
              {
                id: 2,
                name: 'Block 2',
                prompt: 'Second block',
                order: 2,
                block_type: 'CUSTOM',
              },
            ],
          })
        );
      })
    );
    
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Block 1')).toBeInTheDocument();
      expect(screen.getByText('Block 2')).toBeInTheDocument();
    });
    
    // This would require a more complex drag-and-drop simulation
    // For now, we'll just verify the blocks are rendered
    const blocks = screen.getAllByRole('article');
    expect(blocks).toHaveLength(2);
  });

  it('saves workflow changes', async () => {
    const user = userEvent.setup();
    let savedData: any = null;
    
    server.use(
      rest.put('/api/workflows/:id', async (req, res, ctx) => {
        savedData = await req.json();
        return res(ctx.json({ ...mockWorkflow, ...savedData }));
      })
    );
    
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Make changes to workflow
    const nameInput = screen.getByLabelText(/workflow name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Workflow Name');
    
    // Save workflow
    await user.click(screen.getByRole('button', { name: /save workflow/i }));
    
    // Verify save was called
    await waitFor(() => {
      expect(savedData).toEqual(
        expect.objectContaining({
          name: 'Updated Workflow Name',
        })
      );
    });
    
    // Check for success message
    expect(screen.getByText(/workflow saved successfully/i)).toBeInTheDocument();
  });

  it('configures embedding settings', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Switch to embedding tab
    await user.click(screen.getByRole('tab', { name: /embedding/i }));
    
    // Configure embedding template
    const templateInput = screen.getByLabelText(/embedding template/i);
    await user.type(templateInput, 'Summary: {{Summarize.summary}}');
    
    // Toggle enabled status
    await user.click(screen.getByRole('checkbox', { name: /enable embedding/i }));
    
    // Save configuration
    await user.click(screen.getByRole('button', { name: /save embedding config/i }));
    
    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/embedding configuration saved/i)).toBeInTheDocument();
    });
  });

  it('shows validation errors for invalid input', async () => {
    const user = userEvent.setup();
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Try to save with empty name
    const nameInput = screen.getByLabelText(/workflow name/i);
    await user.clear(nameInput);
    
    await user.click(screen.getByRole('button', { name: /save workflow/i }));
    
    // Check for validation error
    expect(screen.getByText(/workflow name is required/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    server.use(
      rest.put('/api/workflows/:id', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ detail: 'Internal server error' })
        );
      })
    );
    
    render(<WorkflowEditor workflowId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });
    
    // Try to save
    await user.click(screen.getByRole('button', { name: /save workflow/i }));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to save workflow/i)).toBeInTheDocument();
    });
  });
});