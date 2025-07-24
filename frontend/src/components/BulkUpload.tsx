import React, { useState, useRef, useEffect } from 'react'
import { ArrowDownTrayIcon, CloudArrowUpIcon, DocumentIcon } from '@heroicons/react/24/outline'
import { useExercises } from '../hooks/useExercises'

interface Workflow {
  id: number
  name: string
  description: string
  status: string
  is_default: boolean
}

interface BatchUploadResult {
  success: boolean
  totalRows: number
  successCount: number
  errors: Array<{
    row: number
    message: string
  }>
}

export const BulkUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<BatchUploadResult | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Get exercises
  const { exercises, selectedExercise } = useExercises()

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await fetch('/api/workflows')
        const data = await response.json()
        setWorkflows(data.workflows || [])
      } catch (error) {
        console.error('Failed to fetch workflows:', error)
      } finally {
        setIsLoadingWorkflows(false)
      }
    }

    fetchWorkflows()
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
      if (allowedTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile)
        setUploadResult(null)
      } else {
        alert('Please select a CSV or Excel file')
      }
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
      if (allowedTypes.includes(droppedFile.type) || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile)
        setUploadResult(null)
      } else {
        alert('Please select a CSV or Excel file')
      }
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const downloadTemplate = () => {
    const headers = [
      'text',
      'requester',
      'assigned_analyst_id', 
      'workflow_name',
      'due_date'
    ]
    
    const workflowNames = workflows.map(w => w.name)
    const defaultWorkflow = workflows.find(w => w.is_default)
    const exampleWorkflow = defaultWorkflow?.name || workflowNames[0] || 'Default Workflow'
    const examples = [
      `"Request for quarterly financial reports","john.doe@company.com",,"${exampleWorkflow}","2025-12-31"`,
      `"Access to employee training records","jane.smith@company.com",,"${exampleWorkflow}",`,
      `"Meeting minutes from board meetings","admin@company.com",,,""`
    ]
    
    const csvContent = headers.join(',') + '\n' + examples.join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch_tasks_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const url = selectedExercise 
        ? `/api/requests/batch?exercise_id=${selectedExercise.id}`
        : '/api/requests/batch'
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      setUploadResult(result)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({
        success: false,
        totalRows: 0,
        successCount: 0,
        errors: [{ row: 0, message: error instanceof Error ? error.message : 'Upload failed' }]
      })
    } finally {
      setIsUploading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setUploadResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Template Download Section */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-3">Step 1: Download Template</h3>
        <p className="text-sm text-gray-600 mb-4">
          Download the template file with the required columns to ensure your data is formatted correctly.
        </p>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Download Template
        </button>
      </div>

      {/* Upload Section */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-3">Step 2: Upload Your File</h3>
        
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">CSV or Excel files only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DocumentIcon className="h-8 w-8 text-gray-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Button */}
      {file && (
        <div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                Upload Tasks
              </>
            )}
          </button>
        </div>
      )}

      {/* Results Section */}
      {uploadResult && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-md font-medium text-gray-900 mb-3">Upload Results</h3>
          
          {uploadResult.success ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-green-800">Upload Successful</h4>
                  <p className="text-sm text-green-700">
                    Successfully created {uploadResult.successCount} out of {uploadResult.totalRows} tasks.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Upload Failed</h4>
                  <p className="text-sm text-red-700">
                    {uploadResult.successCount} out of {uploadResult.totalRows} tasks were created successfully.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Details */}
          {uploadResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Errors:</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-40 overflow-y-auto">
                {uploadResult.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-600">
                    Row {error.row}: {error.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-gray-200 pt-6">
        {selectedExercise && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              All uploaded tasks will be assigned to: <strong>{selectedExercise.name}</strong>
            </p>
          </div>
        )}
        
        <h3 className="text-md font-medium text-gray-900 mb-3">Required Columns</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>text</strong> (required): The task/request description</p>
          <p><strong>requester</strong> (optional): Email or name of the person making the request</p>
          <p><strong>assigned_analyst_id</strong> (optional): ID of the analyst to assign the task to</p>
          <p><strong>workflow_name</strong> (optional): Name of the workflow to use for processing</p>
          <p><strong>due_date</strong> (optional): Due date in YYYY-MM-DD format</p>
        </div>

        {/* Available Workflows */}
        {!isLoadingWorkflows && workflows.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Available Workflows:</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-700">
                    <strong>{workflow.name}</strong>
                    {workflow.is_default && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Default</span>}
                  </span>
                  <span className="text-xs text-gray-500">{workflow.description}</span>
                </div>
              ))}
              <div className="mt-2 text-xs text-gray-500">
                Leave workflow_name empty to use the default workflow.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}