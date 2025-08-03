# Testing SSE Connection

## Setup
1. Make sure the backend is running on port 8000
2. Make sure the frontend dev server is running with the updated Vite config
3. Make sure Redis is running for the event bus

## Testing Steps

1. **Open the Dashboard**
   - Navigate to http://localhost:3000
   - You should see the task list

2. **Select a Task**
   - Click on any existing task in the table
   - The SSE Test Component should appear below the filters panel
   - It will show the connection status and any events received

3. **Create a New Task**
   - Click "New Task" button
   - Fill in the task details
   - Submit the task
   - Select the newly created task from the table
   - Watch the SSE Test Component for real-time updates as the embedding is processed

4. **Monitor the Console**
   - Open browser developer tools (F12)
   - Check the Console tab for any SSE connection logs
   - Check the Network tab for the SSE connection (should show as EventStream)

## Expected Behavior

For a new task:
1. Connection should show as "✅ Connected"
2. Status should change from PENDING → RUNNING → COMPLETED
3. Progress should update from 0% to 100%
4. Messages should show the embedding progress steps
5. Event log should display all received events with timestamps

## Troubleshooting

- **Connection shows as disconnected**: Check that backend is running and Redis is available
- **No events received**: Check browser console for errors, verify the request has pending jobs
- **404 errors**: Ensure Vite proxy is correctly configured and backend routes are accessible

## Clean Up

Once testing is complete, remove the SSETestComponent from Dashboard.tsx:
1. Remove the import statement
2. Remove the component usage