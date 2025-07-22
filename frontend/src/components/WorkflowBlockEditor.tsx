import React, { useState, useEffect } from 'react'
import { 
  TrashIcon, 
  PlusIcon, 
  Bars3Icon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { CreateWorkflowBlockRequest, CreateWorkflowBlockInputRequest } from '../types/workflow'
import { SchemaEditor } from './SchemaEditor'
import { taskflowApi } from '../api/client'
import type { OllamaModel } from '../types/models'

interface WorkflowBlockEditorProps {
  block: CreateWorkflowBlockRequest
  blockIndex: number
  availableBlocks: CreateWorkflowBlockRequest[]
  onUpdate: (block: CreateWorkflowBlockRequest) => void
  onDelete: () => void
  errors: Record<string, string>
  dragHandleProps?: any
}

export const WorkflowBlockEditor: React.FC<WorkflowBlockEditorProps> = ({
  block,
  blockIndex,
  availableBlocks,
  onUpdate,
  onDelete,
  errors,
  dragHandleProps
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  
  const [showSchemaEditor, setShowSchemaEditor] = useState(false)
  const [showModelParameters, setShowModelParameters] = useState(false)
  const [showOutputSchema, setShowOutputSchema] = useState(false)
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  const updateBlock = (updates: Partial<CreateWorkflowBlockRequest>) => {
    console.log('WorkflowBlockEditor updateBlock called:', {
      blockIndex,
      updates,
      currentBlock: block
    })
    const updatedBlock = { ...block, ...updates }
    console.log('Updated block:', updatedBlock)
    onUpdate(updatedBlock)
  }

  // Load available models on component mount
  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true)
      try {
        const response = await taskflowApi.getOllamaModels()
        setAvailableModels(response.models || [])
      } catch (error) {
        console.error('Failed to load Ollama models:', error)
        setAvailableModels([])
      } finally {
        setModelsLoading(false)
      }
    }
    loadModels()
  }, [])

  const addInput = () => {
    console.log('Adding new input, current inputs count:', block.inputs.length)
    const newInput: CreateWorkflowBlockInputRequest = {
      input_type: 'REQUEST_TEXT',
      variable_name: `input_${block.inputs.length + 1}`
    }
    updateBlock({
      inputs: [...block.inputs, newInput]
    })
    console.log('New input added, total inputs:', block.inputs.length + 1)
  }

  const updateInput = (index: number, updatedInput: CreateWorkflowBlockInputRequest) => {
    console.log('updateInput called:', {
      index,
      updatedInput,
      currentInputs: block.inputs
    })
    const newInputs = [...block.inputs]
    newInputs[index] = { ...updatedInput }  // Ensure new object reference
    console.log('newInputs array:', newInputs)
    console.log('Before updateBlock call')
    updateBlock({ inputs: newInputs })
    console.log('After updateBlock call')
  }

  const deleteInput = (index: number) => {
    const newInputs = block.inputs.filter((_, i) => i !== index)
    updateBlock({ inputs: newInputs })
  }

  const handleSchemaChange = (schema: Record<string, any> | undefined) => {
    updateBlock({ output_schema: schema })
    setShowSchemaEditor(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div {...dragHandleProps} className="cursor-move">
            <Bars3Icon className="h-5 w-5 text-gray-400" />
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700"
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
            <span>{block.name || `Block ${blockIndex + 1}`}</span>
            {block.block_type === 'CORE' && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Core Block
              </span>
            )}
          </button>
        </div>
        <button
          onClick={onDelete}
          disabled={block.block_type === 'CORE'}
          className={`p-1 ${
            block.block_type === 'CORE' 
              ? 'text-gray-400 cursor-not-allowed' 
              : 'text-red-500 hover:text-red-700'
          }`}
          title={block.block_type === 'CORE' ? 'Core blocks cannot be deleted' : 'Delete block'}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Show error message for block deletion attempts */}
      {errors[`block_${blockIndex}`] && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{errors[`block_${blockIndex}`]}</p>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4 pl-8">
          {/* Block Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Block Name *
            </label>
            <input
              type="text"
              value={block.name}
              onChange={(e) => updateBlock({ name: e.target.value })}
              className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                errors[`block_${blockIndex}_name`] ? 'border-red-300' : ''
              }`}
              placeholder="Enter block name"
            />
            {errors[`block_${blockIndex}_name`] && (
              <p className="mt-1 text-sm text-red-600">{errors[`block_${blockIndex}_name`]}</p>
            )}
          </div>

          {/* Block Inputs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Inputs
              </label>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Add Input button clicked')
                  addInput()
                }}
                className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                type="button"
              >
                <PlusIcon className="h-3 w-3 mr-1" />
                Add Input
              </button>
            </div>
            
            {block.inputs.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No inputs defined</p>
            ) : (
              <div className="space-y-2">
                {block.inputs.map((input, inputIndex) => (
                  <div key={`input-${inputIndex}`} className="flex items-center space-x-2 p-2 border border-gray-200 rounded">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={input.variable_name}
                        onChange={(e) => updateInput(inputIndex, { ...input, variable_name: e.target.value })}
                        onFocus={() => console.log('Input focused:', inputIndex)}
                        className={`block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                          errors[`block_${blockIndex}_input_${inputIndex}_variable`] ? 'border-red-300' : ''
                        }`}
                        placeholder="Variable name"
                        tabIndex={0}
                      />
                      {errors[`block_${blockIndex}_input_${inputIndex}_variable`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`block_${blockIndex}_input_${inputIndex}_variable`]}</p>
                      )}
                    </div>
                    
                    <select
                      value={input.input_type}
                      onChange={(e) => updateInput(inputIndex, { 
                        ...input, 
                        input_type: e.target.value as 'REQUEST_TEXT' | 'BLOCK_OUTPUT',
                        source_block_id: e.target.value === 'REQUEST_TEXT' ? undefined : input.source_block_id
                      })}
                      className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="REQUEST_TEXT">Task Text</option>
                      <option value="BLOCK_OUTPUT">Block Output</option>
                    </select>
                    
                    {input.input_type === 'BLOCK_OUTPUT' && (
                      <select
                        value={input.source_block_id !== undefined ? input.source_block_id.toString() : ''}
                        onChange={(e) => {
                          console.log('Dropdown change:', {
                            inputIndex,
                            currentValue: input.source_block_id,
                            newTargetValue: e.target.value,
                            willBecome: e.target.value ? parseInt(e.target.value) : undefined
                          })
                          const newValue = e.target.value === '' ? undefined : parseInt(e.target.value)
                          const updatedInput = { 
                            ...input, 
                            source_block_id: newValue
                          }
                          console.log('Calling updateInput with:', updatedInput)
                          updateInput(inputIndex, updatedInput)
                        }}
                        className={`border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                          errors[`block_${blockIndex}_input_${inputIndex}_source`] ? 'border-red-300' : ''
                        }`}
                      >
                        <option value="">Select source block</option>
                        {availableBlocks.length === 0 ? (
                          <option value="" disabled>No previous blocks available</option>
                        ) : (
                          availableBlocks.map((sourceBlock, sourceIndex) => (
                            <option key={sourceIndex} value={sourceIndex}>
                              {sourceBlock.name}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                    
                    <button
                      onClick={() => deleteInput(inputIndex)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              AI Model
            </label>
            <select
              value={block.model_name || ''}
              onChange={(e) => updateBlock({ model_name: e.target.value || undefined })}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={modelsLoading}
            >
              <option value="">Use default model</option>
              {availableModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)
                </option>
              ))}
            </select>
            {modelsLoading && (
              <p className="mt-1 text-sm text-gray-500">Loading available models...</p>
            )}
            {!modelsLoading && availableModels.length === 0 && (
              <p className="mt-1 text-sm text-orange-600">No models available. Check Ollama connection.</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Select which AI model this block should use, or leave blank for default.
            </p>
          </div>

          {/* Model Parameters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Model Parameters
              </label>
              <button
                onClick={() => setShowModelParameters(!showModelParameters)}
                className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                type="button"
              >
                {showModelParameters ? (
                  <ChevronUpIcon className="h-3 w-3" />
                ) : (
                  <ChevronDownIcon className="h-3 w-3" />
                )}
              </button>
            </div>
            {showModelParameters && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-md">
              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Temperature
                </label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={block.model_parameters?.temperature ?? 0.7}
                  onChange={(e) => {
                    const temperature = parseFloat(e.target.value)
                    updateBlock({
                      model_parameters: {
                        ...(block.model_parameters || {}),
                        temperature: isNaN(temperature) ? 0.7 : temperature
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Controls randomness: 0 = focused, 2 = very creative
                </p>
              </div>

              {/* Context Window */}
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Context Window (num_ctx)
                </label>
                <input
                  type="number"
                  min="128"
                  max="32768"
                  step="128"
                  value={block.model_parameters?.num_ctx ?? 4096}
                  onChange={(e) => {
                    const num_ctx = parseInt(e.target.value)
                    updateBlock({
                      model_parameters: {
                        ...(block.model_parameters || {}),
                        num_ctx: isNaN(num_ctx) ? 4096 : num_ctx
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum context window size in tokens
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="1"
                  max="4096"
                  step="1"
                  value={block.model_parameters?.max_tokens ?? 2048}
                  onChange={(e) => {
                    const max_tokens = parseInt(e.target.value)
                    updateBlock({
                      model_parameters: {
                        ...(block.model_parameters || {}),
                        max_tokens: isNaN(max_tokens) ? 2048 : max_tokens
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum tokens to generate in response
                </p>
              </div>

              {/* Top P */}
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Top P
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={block.model_parameters?.top_p ?? 0.9}
                  onChange={(e) => {
                    const top_p = parseFloat(e.target.value)
                    updateBlock({
                      model_parameters: {
                        ...(block.model_parameters || {}),
                        top_p: isNaN(top_p) ? 0.9 : top_p
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nucleus sampling threshold (0-1)
                </p>
              </div>

              {/* Top K */}
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Top K
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={block.model_parameters?.top_k ?? 40}
                  onChange={(e) => {
                    const top_k = parseInt(e.target.value)
                    updateBlock({
                      model_parameters: {
                        ...(block.model_parameters || {}),
                        top_k: isNaN(top_k) ? 40 : top_k
                      }
                    })
                  }}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Number of top tokens to consider
                </p>
              </div>

              {/* Repeat Penalty */}
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Repeat Penalty
                </label>
                <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={block.model_parameters?.repeat_penalty ?? 1.1}
                      onChange={(e) => {
                        const repeat_penalty = parseFloat(e.target.value)
                        updateBlock({
                          model_parameters: {
                            ...(block.model_parameters || {}),
                            repeat_penalty: isNaN(repeat_penalty) ? 1.1 : repeat_penalty
                          }
                        })
                      }}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Penalty for repeated tokens (1.0 = no penalty)
                    </p>
                  </div>

                  {/* Seed */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600">
                      Seed (optional)
                    </label>
                    <input
                      type="number"
                      value={block.model_parameters?.seed ?? ''}
                      onChange={(e) => {
                        const seed = e.target.value ? parseInt(e.target.value) : undefined
                        updateBlock({
                          model_parameters: {
                            ...(block.model_parameters || {}),
                            seed
                          }
                        })
                      }}
                      placeholder="Random seed for reproducibility"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Set for reproducible outputs
                    </p>
                  </div>
              </div>
            )}
          </div>

          {/* Block Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Prompt *
            </label>
            <textarea
              rows={6}
              value={block.prompt}
              onChange={(e) => updateBlock({ prompt: e.target.value })}
              className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                errors[`block_${blockIndex}_prompt`] ? 'border-red-300' : ''
              }`}
              placeholder="Enter the prompt template. Use {variable_name} to reference inputs."
            />
            {errors[`block_${blockIndex}_prompt`] && (
              <p className="mt-1 text-sm text-red-600">{errors[`block_${blockIndex}_prompt`]}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Use curly braces to reference inputs: {'{variable_name}'}
            </p>
          </div>

          {/* Output Schema */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Output Schema
              </label>
              <div className="flex items-center space-x-2">
                {block.block_type === 'CORE' ? (
                  <span className="text-xs text-gray-500 italic">
                    Core blocks have fixed schemas
                  </span>
                ) : (
                  <button
                    onClick={() => setShowSchemaEditor(true)}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                    type="button"
                  >
                    {block.output_schema ? 'Edit Schema' : 'Add Schema'}
                  </button>
                )}
                <button
                  onClick={() => setShowOutputSchema(!showOutputSchema)}
                  className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  {showOutputSchema ? (
                    <ChevronUpIcon className="h-3 w-3" />
                  ) : (
                    <ChevronDownIcon className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
            
            {showOutputSchema && (
              block.output_schema ? (
                <div className="p-3 bg-gray-50 rounded-md">
                  <pre className="text-xs text-gray-700 overflow-x-auto">
                    {JSON.stringify(block.output_schema, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No output schema defined</p>
              )
            )}
          </div>
        </div>
      )}

      {/* Schema Editor Modal */}
      {showSchemaEditor && block.block_type === 'CUSTOM' && (
        <SchemaEditor
          schema={block.output_schema}
          onSave={handleSchemaChange}
          onCancel={() => setShowSchemaEditor(false)}
        />
      )}
    </div>
  )
}