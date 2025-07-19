import React, { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface SchemaField {
  name: string
  type: string
  required: boolean
  description?: string
  items?: SchemaField // For array types
}

interface SchemaEditorProps {
  schema?: Record<string, any>
  onSave: (schema: Record<string, any> | undefined) => void
  onCancel: () => void
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  schema,
  onSave,
  onCancel
}) => {
  const [fields, setFields] = useState<SchemaField[]>([])
  const [rawJson, setRawJson] = useState('')
  const [viewMode, setViewMode] = useState<'builder' | 'json'>('builder')
  const [jsonError, setJsonError] = useState('')

  useEffect(() => {
    if (schema) {
      setRawJson(JSON.stringify(schema, null, 2))
      
      // Convert schema to fields format
      if (schema.properties) {
        const convertedFields: SchemaField[] = Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type || 'string',
          required: schema.required?.includes(name) || false,
          description: prop.description,
          items: prop.items ? {
            name: 'item',
            type: prop.items.type || 'string',
            required: false,
            description: prop.items.description
          } : undefined
        }))
        setFields(convertedFields)
      }
    } else {
      setFields([])
      setRawJson('')
    }
  }, [schema])

  const addField = () => {
    setFields([...fields, {
      name: '',
      type: 'string',
      required: false,
      description: ''
    }])
  }

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...updates }
    setFields(newFields)
  }

  const deleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const buildSchemaFromFields = (): Record<string, any> => {
    const properties: Record<string, any> = {}
    const required: string[] = []

    fields.forEach(field => {
      if (!field.name) return

      const propSchema: any = {
        type: field.type
      }

      if (field.description) {
        propSchema.description = field.description
      }

      if (field.type === 'array' && field.items) {
        propSchema.items = {
          type: field.items.type
        }
        if (field.items.description) {
          propSchema.items.description = field.items.description
        }
      }

      properties[field.name] = propSchema

      if (field.required) {
        required.push(field.name)
      }
    })

    const schema: Record<string, any> = {
      type: 'object',
      properties
    }

    if (required.length > 0) {
      schema.required = required
    }

    return schema
  }

  const handleSaveFromBuilder = () => {
    if (fields.length === 0) {
      onSave(undefined)
      return
    }

    const schema = buildSchemaFromFields()
    onSave(schema)
  }

  const handleSaveFromJson = () => {
    try {
      const parsedSchema = rawJson.trim() ? JSON.parse(rawJson) : undefined
      onSave(parsedSchema)
    } catch (error) {
      setJsonError('Invalid JSON format')
    }
  }

  const handleJsonChange = (value: string) => {
    setRawJson(value)
    setJsonError('')
  }

  const typeOptions = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'integer', label: 'Integer' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'array', label: 'Array' },
    { value: 'object', label: 'Object' }
  ]

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Output Schema Editor
              </h3>
              <button
                onClick={onCancel}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* View Mode Tabs */}
            <div className="mb-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setViewMode('builder')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      viewMode === 'builder'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Schema Builder
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      viewMode === 'json'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Raw JSON
                  </button>
                </nav>
              </div>
            </div>

            {/* Builder Mode */}
            {viewMode === 'builder' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Fields</h4>
                  <button
                    onClick={addField}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Field
                  </button>
                </div>

                {fields.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-8">
                    No fields defined. Add a field to get started.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {fields.map((field, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 border border-gray-200 rounded-lg">
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Field Name
                          </label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateField(index, { name: e.target.value })}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="field_name"
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Type
                          </label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, { type: e.target.value })}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            {typeOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {field.type === 'array' && (
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Item Type
                            </label>
                            <select
                              value={field.items?.type || 'string'}
                              onChange={(e) => updateField(index, { 
                                items: { 
                                  ...field.items, 
                                  name: 'item', 
                                  type: e.target.value, 
                                  required: false 
                                }
                              })}
                              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="integer">Integer</option>
                              <option value="boolean">Boolean</option>
                              <option value="object">Object</option>
                            </select>
                          </div>
                        )}

                        <div className={`${field.type === 'array' ? 'col-span-3' : 'col-span-5'}`}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={field.description || ''}
                            onChange={(e) => updateField(index, { description: e.target.value })}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Field description"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Required
                          </label>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            &nbsp;
                          </label>
                          <button
                            onClick={() => deleteField(index)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* JSON Mode */}
            {viewMode === 'json' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JSON Schema
                  </label>
                  <textarea
                    rows={12}
                    value={rawJson}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    className={`w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono ${
                      jsonError ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter JSON schema or leave empty for no schema"
                  />
                  {jsonError && (
                    <p className="mt-1 text-sm text-red-600">{jsonError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={viewMode === 'builder' ? handleSaveFromBuilder : handleSaveFromJson}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Save Schema
            </button>
            <button
              onClick={onCancel}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}