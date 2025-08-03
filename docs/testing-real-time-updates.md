# Testing Real-Time Updates

## Access the Application

1. **Open TaskFlow Dashboard**: http://localhost:3000
2. **View Components Test Pages**:
   - Progress Bar Test: http://localhost:3000/test/progress-bar
   - Request Card Test: http://localhost:3000/test/request-card

## What to Look For

### In the Main Dashboard (http://localhost:3000)

1. **View Toggle**: In the top-right of the requests section, you'll see toggle buttons:
   - 📊 Table view (default)
   - 🔲 Card view (shows RequestCard components)

2. **Real-Time Updates**:
   - Look for request #38 from "Real-Time Test User"
   - If it's still processing, you'll see:
     - A progress bar showing percentage completion
     - "Processing..." status
     - Live indicator (red dot with "LIVE" text)
   - Embedding status icons:
     - ⏳ = Pending
     - 🔄 = Processing (animated)
     - ✅ = Completed
     - ❌ = Failed

3. **No Refresh Needed**:
   - The UI updates automatically
   - Progress bars animate smoothly
   - Status changes happen in real-time

## Creating New Test Requests

To see the real-time updates in action, create a new request:

```bash
curl -X POST http://localhost:8008/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test request to demonstrate real-time progress updates. Please analyze this text and show me how the progress bar works.",
    "requester": "Demo User",
    "exercise_id": 1
  }'
```

Then watch the dashboard - no refresh needed!

## Features to Test

1. **Progress Bar Animation**:
   - Smooth progression from 0% to 100%
   - Color changes based on status
   - Time estimates (elapsed and remaining)

2. **Card View**:
   - Toggle to card view to see RequestCard components
   - Each card shows embedding status
   - Live indicator appears during processing

3. **SSE Connection**:
   - Open browser DevTools → Network tab
   - Look for "events" connections (EventStream type)
   - These are the SSE connections providing real-time updates

## Troubleshooting

- **No updates appearing?** Check browser console for SSE connection errors
- **Progress stuck?** Check if AI worker is running: `kubectl get pods -n taskflow`
- **Can't see card view?** Make sure you're using the toggle buttons in the requests section

## Architecture Verification

The real-time flow works as follows:
1. Create request → Backend queues embedding job
2. AI Worker processes → Publishes events to Redis
3. API subscribes to Redis → Sends SSE events to browser
4. React components update → UI refreshes automatically

You should see all of this happen without any manual page refreshes!