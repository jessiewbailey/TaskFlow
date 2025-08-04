import React, { useState, useEffect } from 'react'
import { WorkflowBlock } from '../types/workflow'
import { InformationCircleIcon, CodeBracketIcon } from '@heroicons/react/24/outline'

interface EmbeddingConfig {
  enabled: boolean
  embedding_template: string
}

interface WorkflowEmbeddingConfigProps {
  workflowId: number
  blocks: WorkflowBlock[]
}

export const WorkflowEmbeddingConfig: React.FC<WorkflowEmbeddingConfigProps> = ({
  workflowId,
  blocks
}) => {
  const [config, setConfig] = useState<EmbeddingConfig>({
    enabled: true,
    embedding_template: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showVariables, setShowVariables] = useState(false)

  // Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}/embedding-config`)
        if (response.ok) {
          const data = await response.json()
          if (data) {
            setConfig(data)
          } else {
            // Set default template
            setConfig({
              enabled: true,
              embedding_template: '{{REQUEST_TEXT}}'
            })
          }
        }
      } catch (error) {
        console.error('Failed to load embedding config:', error)
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
      const response = await fetch(`/api/workflows/${workflowId}/embedding-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        throw new Error('Failed to save embedding configuration')
      }

      // Show success message
      alert('Embedding configuration saved successfully')
    } catch (error) {
      console.error('Error saving embedding config:', error)
      alert('Failed to save embedding configuration')
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('embedding-template') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = 
        config.embedding_template.substring(0, start) +
        `{{${variable}}}` +
        config.embedding_template.substring(end)
      
      setConfig({
        ...config,
        embedding_template: newValue
      })
      
      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = start + variable.length + 4
        textarea.selectionEnd = start + variable.length + 4
        textarea.focus()
      }, 0)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Embedding Configuration
        </h3>
        <p className="text-sm text-gray-600">
          Configure how embeddings are generated for similarity search. The embedding text 
          is built from workflow outputs after successful completion.
        </p>
      </div>

      <div className="space-y-4">
        {/* Enabled Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="embedding-enabled"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="embedding-enabled" className="ml-2 block text-sm text-gray-900">
            Enable embedding generation after workflow completion
          </label>
        </div>

        {/* Template Editor */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="embedding-template" className="block text-sm font-medium text-gray-700">
              Embedding Template
            </label>
            <button
              type="button"
              onClick={() => setShowVariables(!showVariables)}
              className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center"
            >
              <CodeBracketIcon className="h-4 w-4 mr-1" />
              {showVariables ? 'Hide' : 'Show'} Available Variables
            </button>
          </div>

          {/* Variable Helper */}
          {showVariables && (
            <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="text-sm text-gray-700 mb-2">
                Click to insert variables:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertVariable('REQUEST_TEXT')}
                  className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  REQUEST_TEXT
                </button>
                {blocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => insertVariable(block.name)}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                    title={`Output from ${block.name} block`}
                  >
                    {block.name}.*
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <InformationCircleIcon className="h-3 w-3 inline mr-1" />
                Use dot notation to access specific fields, e.g., {`{{Summarize.executive_summary}}`}
              </div>
            </div>
          )}

          <textarea
            id="embedding-template"
            value={config.embedding_template}
            onChange={(e) => setConfig({ ...config, embedding_template: e.target.value })}
            rows={6}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
            placeholder="Enter template for embedding text...&#10;&#10;Example:&#10;Summary: {{Summarize.executive_summary}}&#10;Topics: {{Classify.primary_topic}}&#10;Original: {{REQUEST_TEXT}}"
            disabled={!config.enabled}
          />
        </div>

        {/* Example Output */}
        <div className="bg-blue-50 p-4 rounded-md">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">How it works</h4>
              <div className="mt-1 text-sm text-blue-700">
                <p>After a workflow completes successfully:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>The template is processed, replacing variables with actual values</li>
                  <li>The resulting text is used to generate an embedding vector</li>
                  <li>This embedding enables similarity search based on AI-processed content</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !config.enabled}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}