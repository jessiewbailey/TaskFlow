import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Dashboard } from './pages/Dashboard'
import { WorkflowSettings } from './pages/WorkflowSettings'
import { Settings } from './pages/Settings'
import { BatchJobsNew } from './pages/BatchJobsNew'
import { FineTuningSettingsPage } from './pages/FineTuningSettings'
import { ExerciseSettings } from './pages/ExerciseSettings'
import { SimilaritySearchSettings } from './pages/SimilaritySearchSettings'
import { UISettings } from './pages/UISettings'
import ProgressBarTest from './components/ProgressBarTest'
import RequestCardTest from './components/RequestCardTest'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batch-jobs" element={<BatchJobsNew />} />
          <Route path="/settings" element={<Settings><div className="text-center py-8 text-gray-500">Select a settings category from the sidebar</div></Settings>} />
          <Route path="/settings/exercises" element={<Settings><ExerciseSettings /></Settings>} />
          <Route path="/settings/workflows" element={<WorkflowSettings />} />
          <Route path="/settings/users" element={<Settings><div className="text-center py-8 text-gray-500">User management coming soon</div></Settings>} />
          <Route path="/settings/notifications" element={<Settings><div className="text-center py-8 text-gray-500">Notification settings coming soon</div></Settings>} />
          <Route path="/settings/fine-tuning" element={<FineTuningSettingsPage />} />
          <Route path="/settings/similarity-search" element={<SimilaritySearchSettings />} />
          <Route path="/settings/ui" element={<Settings><UISettings /></Settings>} />
          <Route path="/test/progress-bar" element={<ProgressBarTest />} />
          <Route path="/test/request-card" element={<RequestCardTest />} />
        </Routes>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App