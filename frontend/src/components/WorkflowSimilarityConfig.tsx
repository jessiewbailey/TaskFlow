import React, { useState, useEffect } from 'react'
import { WorkflowBlock } from '../types/workflow'
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'

interface SimilarityField {
  name: string
  type: string
  source: string
  display_options?: any
}

interface SimilarityConfig {
  fields: SimilarityField[]
}

interface WorkflowSimilarityConfigProps {
  workflowId: number
  blocks: WorkflowBlock[]
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'list', label: 'List' },
  { value: 'date', label: 'Date' },
  { value: 'score', label: 'Similarity Score' },
  { value: 'status', label: 'Status Badge' }
]

export const WorkflowSimilarityConfig: React.FC<WorkflowSimilarityConfigProps> = ({
  workflowId,
  blocks
}) => {
  const [config, setConfig] = useState<SimilarityConfig>({
    fields: []
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}/similarity-config`)
        if (response.ok) {
          const data = await response.json()
          if (data) {
            setConfig({ fields: data.fields || [] })
          } else {
            // Set default fields
            setConfig({
              fields: [
                { name: 'Task ID', type: 'text', source: 'TASK_ID' },
                { name: 'Summary', type: 'text', source: 'REQUEST_TEXT' },
                { name: 'Similarity', type: 'score', source: 'SIMILARITY_SCORE' }
              ]
            })
          }
        }
      } catch (error) {
        console.error('Failed to load similarity config:', error)
      } finally {
        setLoading(false)
      }
    }

    if (workflowId) {
      loadConfig()
    }
  }, [workflowId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/workflows/${workflowId}/similarity-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        throw new Error('Failed to save similarity configuration')
      }

      alert('Similarity display configuration saved successfully')
    } catch (error) {
      console.error('Error saving similarity config:', error)
      alert('Failed to save similarity configuration')
    } finally {
      setSaving(false)
    }
  }

  const addField = () => {
    setConfig({
      fields: [
        ...config.fields,
        { name: '', type: 'text', source: '' }
      ]
    })
  }

  const removeField = (index: number) => {
    setConfig({
      fields: config.fields.filter((_, i) => i !== index)
    })
  }

  const updateField = (index: number, updates: Partial<SimilarityField>) => {
    setConfig({
      fields: config.fields.map((field, i) => 
        i === index ? { ...field, ...updates } : field
      )
    })
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...config.fields]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    if (newIndex >= 0 && newIndex < newFields.length) {
      [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]]
      setConfig({ fields: newFields })
    }
  }

  const getAvailableSources = () => {
    const sources = [
      { value: 'TASK_ID', label: 'Task ID' },
      { value: 'REQUEST_TEXT', label: 'Original Request Text' },
      { value: 'SIMILARITY_SCORE', label: 'Similarity Score' },
      { value: 'STATUS', label: 'Task Status' },
      { value: 'CREATED_AT', label: 'Created Date' },
      { value: 'REQUESTER', label: 'Requester' }
    ]

    // Add workflow block outputs
    blocks.forEach(block => {
      sources.push({
        value: block.name,
        label: `${block.name} (Full Output)`
      })
      // You could parse output_schema to add specific fields
      // For now, users can manually enter dot notation
    })

    return sources
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Similarity Search Display
        </h3>
        <p className="text-sm text-gray-600">
          Configure what information is shown when similar tasks are displayed.
        </p>
      </div>

      <div className="space-y-4">
        {/* Field List */}
        <div className="space-y-3">
          {config.fields.map((field, index) => (
            <div key={index} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg">
              <div className="flex-1 grid grid-cols-3 gap-3">
                {/* Field Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateField(index, { name: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="e.g., Summary"
                  />
                </div>

                {/* Field Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Display Type
                  </label>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    {FIELD_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data Source */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Data Source
                  </label>
                  <input
                    type="text"
                    value={field.source}
                    onChange={(e) => updateField(index, { source: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="e.g., Summarize.executive_summary"
                    list={`sources-${index}`}
                  />
                  <datalist id={`sources-${index}`}>
                    {getAvailableSources().map(source => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveField(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title="Move up"
                >
                  <ArrowUpIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveField(index, 'down')}
                  disabled={index === config.fields.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title="Move down"
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="p-1 text-red-400 hover:text-red-600"
                  title="Remove field"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Field Button */}
        <button
          type="button"
          onClick={addField}
          className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Display Field
        </button>

        {/* Special Sources Info */}
        <div className="bg-blue-50 p-4 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Available Data Sources</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p><code className="bg-blue-100 px-1 rounded">TASK_ID</code> - The task ID number</p>
            <p><code className="bg-blue-100 px-1 rounded">REQUEST_TEXT</code> - Original request text</p>
            <p><code className="bg-blue-100 px-1 rounded">SIMILARITY_SCORE</code> - Similarity percentage</p>
            <p><code className="bg-blue-100 px-1 rounded">Block_Name.field</code> - Workflow output field (e.g., Summarize.executive_summary)</p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || config.fields.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Display Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}