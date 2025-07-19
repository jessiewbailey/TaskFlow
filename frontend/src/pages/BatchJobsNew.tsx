import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, DocumentPlusIcon, ArrowPathIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Logo } from '../components/Logo'
import { BulkUpload } from '../components/BulkUpload'
import { RerunTasks } from '../components/RerunTasks'
import { PurgeJobs } from '../components/PurgeJobs'
import { ExportData } from '../components/ExportData'

type TabType = 'upload' | 'rerun' | 'purge' | 'export'

export const BatchJobsNew: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('upload')

  const tabs = [
    {
      id: 'upload' as const,
      name: 'Bulk Upload',
      icon: DocumentPlusIcon,
      description: 'Upload CSV/Excel files to create multiple tasks'
    },
    {
      id: 'rerun' as const,
      name: 'Re-run Tasks',
      icon: ArrowPathIcon,
      description: 'Re-process all existing tasks with a different workflow'
    },
    {
      id: 'purge' as const,
      name: 'Purge',
      icon: TrashIcon,
      description: 'Delete all processing jobs from the system'
    },
    {
      id: 'export' as const,
      name: 'Export Data',
      icon: ArrowDownTrayIcon,
      description: 'Export all tasks and AI analysis to Excel format'
    }
  ]


  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
              <Logo className="h-8 w-auto" />
              <h1 className="text-2xl font-bold text-gray-900">Batch Jobs</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      className={`-ml-0.5 mr-2 h-5 w-5 ${
                        activeTab === tab.id
                          ? 'text-indigo-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {tabs.find(tab => tab.id === activeTab)?.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>

          <div className="p-6">
            {activeTab === 'upload' && <BulkUpload />}
            {activeTab === 'rerun' && <RerunTasks />}
            {activeTab === 'purge' && <PurgeJobs />}
            {activeTab === 'export' && <ExportData />}
          </div>
        </div>
      </div>
    </div>
  )
}