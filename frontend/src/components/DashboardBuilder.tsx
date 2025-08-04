import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
  PlusIcon, 
  TrashIcon, 
  EyeIcon, 
  EyeSlashIcon,
  Bars3Icon
} from '@heroicons/react/24/outline'
import { CreateWorkflowBlockRequest, DashboardConfig, DashboardFieldConfig } from '../types/workflow'
import { DashboardPreview } from './DashboardPreview'

interface DashboardBuilderProps {
  blocks: CreateWorkflowBlockRequest[]
  dashboardConfig: DashboardConfig
  onConfigChange: (config: DashboardConfig) => void
}

interface AvailableField {
  block_name: string
  field_path: string
  field_type: string
  label: string
  suggested_display_type: DashboardFieldConfig['display_type']
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  blocks,
  dashboardConfig,
  onConfigChange
}) => {
  const [showAddField, setShowAddField] = useState(false)
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([])

  useEffect(() => {
    // Extract available fields from block schemas
    const fields: AvailableField[] = []
    
    blocks.forEach(block => {
      if (block.output_schema) {
        const schema = block.output_schema
        
        if (schema.type === 'object' && schema.properties) {
          Object.entries(schema.properties).forEach(([fieldName, fieldSchema]: [string, any]) => {
            const suggestedType = getSuggestedDisplayType(fieldName, fieldSchema)
            fields.push({
              block_name: block.name,
              field_path: fieldName,
              field_type: fieldSchema.type,
              label: `${block.name}: ${fieldName}`,
              suggested_display_type: suggestedType
            })
          })
        } else if (schema.type === 'array') {
          // For array types (like redactions), add the whole array
          fields.push({
            block_name: block.name,
            field_path: '',
            field_type: 'array',
            label: `${block.name}: Full Output`,
            suggested_display_type: 'list'
          })
        }
      }
    })
    
    setAvailableFields(fields)
  }, [blocks])

  const getSuggestedDisplayType = (fieldName: string, fieldSchema: any): DashboardFieldConfig['display_type'] => {
    // Suggest display types based on field names and types
    const name = fieldName.toLowerCase()
    
    if (name.includes('score') || name.includes('confidence')) {
      return 'progress_bar'
    }
    if (name.includes('topic') || name.includes('status') || name.includes('level')) {
      return 'badge'
    }
    if (fieldSchema.type === 'array') {
      return 'list'
    }
    if (name.includes('summary') || name.includes('explanation')) {
      return 'card'
    }
    return 'text'
  }

  const addField = (availableField: AvailableField) => {
    const newField: DashboardFieldConfig = {
      id: `field_${Date.now()}`,
      block_name: availableField.block_name,
      field_path: availableField.field_path,
      display_type: availableField.suggested_display_type,
      label: availableField.label,
      order: dashboardConfig.fields.length,
      width: 'full',
      visible: true
    }

    const updatedConfig = {
      ...dashboardConfig,
      fields: [...dashboardConfig.fields, newField]
    }
    onConfigChange(updatedConfig)
    setShowAddField(false)
  }

  const removeField = (fieldId: string) => {
    const updatedConfig = {
      ...dashboardConfig,
      fields: dashboardConfig.fields.filter(f => f.id !== fieldId)
    }
    onConfigChange(updatedConfig)
  }

  const updateField = (fieldId: string, updates: Partial<DashboardFieldConfig>) => {
    const updatedConfig = {
      ...dashboardConfig,
      fields: dashboardConfig.fields.map(f => 
        f.id === fieldId ? { ...f, ...updates } : f
      )
    }
    onConfigChange(updatedConfig)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(dashboardConfig.fields)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order values
    const updatedFields = items.map((field, index) => ({
      ...field,
      order: index
    }))

    const updatedConfig = {
      ...dashboardConfig,
      fields: updatedFields
    }
    onConfigChange(updatedConfig)
  }

  const getDisplayTypeIcon = (type: DashboardFieldConfig['display_type']) => {
    switch (type) {
      case 'progress_bar': return '📊'
      case 'badge': return '🏷️'
      case 'list': return '📝'
      case 'card': return '📋'
      case 'json': return '{ }'
      default: return '📄'
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Configure how AI analysis results appear in the request details
            </p>
            <button
              onClick={() => setShowAddField(!showAddField)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Field
            </button>
          </div>

          {/* Add Field Panel */}
          {showAddField && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Available Fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableFields
                  .filter(field => !dashboardConfig.fields.some(f => 
                    f.block_name === field.block_name && f.field_path === field.field_path
                  ))
                  .map(field => (
                    <button
                      key={`${field.block_name}-${field.field_path}`}
                      onClick={() => addField(field)}
                      className="flex items-center justify-between p-3 text-left border border-gray-200 rounded-md hover:bg-white hover:border-indigo-300 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{field.label}</p>
                        <p className="text-xs text-gray-500">{field.field_type}</p>
                      </div>
                      <span className="text-sm">
                        {getDisplayTypeIcon(field.suggested_display_type)}
                      </span>
                    </button>
                  ))}
              </div>
              {availableFields.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No additional fields available. Add blocks with output schemas to see more options.
                </p>
              )}
            </div>
          )}

          {/* Dashboard Fields */}
          {dashboardConfig.fields.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">No dashboard fields configured</p>
              <p className="text-sm text-gray-400 mt-1">Add fields to customize the AI analysis display</p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="dashboard-fields">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {dashboardConfig.fields
                      .sort((a, b) => a.order - b.order)
                      .map((field, index) => (
                        <Draggable key={field.id} draggableId={field.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="border border-gray-200 rounded-lg p-4 bg-white"
                            >
                              <div className="flex items-center space-x-3">
                                <div {...provided.dragHandleProps} className="cursor-move">
                                  <Bars3Icon className="h-5 w-5 text-gray-400" />
                                </div>
                                
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Label
                                    </label>
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Display Type
                                    </label>
                                    <select
                                      value={field.display_type}
                                      onChange={(e) => updateField(field.id, { 
                                        display_type: e.target.value as DashboardFieldConfig['display_type'] 
                                      })}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                      <option value="text">Text</option>
                                      <option value="progress_bar">Progress Bar</option>
                                      <option value="badge">Badge</option>
                                      <option value="list">List</option>
                                      <option value="card">Card</option>
                                      <option value="json">JSON</option>
                                    </select>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Width
                                    </label>
                                    <select
                                      value={field.width}
                                      onChange={(e) => updateField(field.id, { 
                                        width: e.target.value as DashboardFieldConfig['width'] 
                                      })}
                                      className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                      <option value="full">Full Width</option>
                                      <option value="half">Half Width</option>
                                      <option value="third">Third Width</option>
                                      <option value="quarter">Quarter Width</option>
                                    </select>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => updateField(field.id, { visible: !field.visible })}
                                      className={`p-1 rounded ${field.visible ? 'text-green-600' : 'text-gray-400'}`}
                                      title={field.visible ? 'Hide field' : 'Show field'}
                                    >
                                      {field.visible ? (
                                        <EyeIcon className="h-4 w-4" />
                                      ) : (
                                        <EyeSlashIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                    
                                    <button
                                      onClick={() => removeField(field.id)}
                                      className="p-1 text-red-500 hover:text-red-700"
                                      title="Remove field"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-2 text-xs text-gray-500">
                                {field.block_name} → {field.field_path || 'Full Output'}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Preview */}
          {dashboardConfig.fields.length > 0 && (
            <DashboardPreview config={dashboardConfig} />
          )}
      </div>
    </div>
  )
}