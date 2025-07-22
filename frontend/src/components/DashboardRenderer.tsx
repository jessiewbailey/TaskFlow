import React, { useState, useEffect } from 'react'
import { DashboardConfig } from '../types/workflow'
import { GroundTruthControl } from './GroundTruthControl'
import { groundTruthClient, UserPreferences } from '../api/groundTruthClient'

interface DashboardRendererProps {
  config: DashboardConfig
  data: any // AI output data
  requestId?: number
  workflowBlocks?: Array<{ id: number; name: string }>
}

export const DashboardRenderer: React.FC<DashboardRendererProps> = ({ config, data, requestId, workflowBlocks }) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const prefs = await groundTruthClient.getUserPreferences()
      setPreferences(prefs)
    } catch (err) {
      console.error('Failed to load preferences:', err)
    } finally {
      setLoadingPrefs(false)
    }
  }

  const getWorkflowBlockId = (blockName: string): number | undefined => {
    const block = workflowBlocks?.find(b => b.name === blockName)
    return block?.id
  }

  const getFieldValue = (blockName: string, fieldPath: string, data: any) => {
    // Direct access to transformed data structure
    if (!data || !data[blockName]) return null
    
    if (fieldPath === '') {
      return data[blockName] // Return full object/array
    }
    
    const blockData = data[blockName]
    
    // First try exact field path match
    if (blockData[fieldPath] !== undefined) {
      return blockData[fieldPath]
    }
    
    // If exact match fails, try to find a similar field or return the first non-null value
    if (typeof blockData === 'object' && blockData !== null) {
      const keys = Object.keys(blockData)
      
      // Look for field names that contain the expected field path (case insensitive)
      const similarKey = keys.find(key => 
        key.toLowerCase().includes(fieldPath.toLowerCase()) ||
        fieldPath.toLowerCase().includes(key.toLowerCase())
      )
      
      if (similarKey) {
        return blockData[similarKey]
      }
      
      // If no similar key found, return the first non-null value
      for (const key of keys) {
        if (blockData[key] !== null && blockData[key] !== undefined) {
          return blockData[key]
        }
      }
    }
    
    return null
  }

  const getFieldType = (value: any): 'text' | 'number' | 'array' | 'object' | 'boolean' => {
    if (value === null || value === undefined) return 'text'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'
    return 'text'
  }

  const renderField = (field: any, value: any) => {
    if (!field.visible) return null

    const baseClassName = getWidthClass(field.width)
    const isEmpty = value === null || value === undefined
    const showGroundTruth = preferences?.fine_tuning_mode && requestId && workflowBlocks
    const workflowBlockId = getWorkflowBlockId(field.block_name)
    
    switch (field.display_type) {
      case 'progress_bar':
        return (
          <div key={field.id} className={baseClassName}>
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{field.label}</h4>
              {isEmpty ? (
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-4" />
                  <span className="text-sm text-gray-400">--</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-4">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${Math.min(Number(value) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {(Number(value) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {showGroundTruth && workflowBlockId && (
                <GroundTruthControl
                  requestId={requestId}
                  workflowBlockId={workflowBlockId}
                  workflowBlockName={field.block_name}
                  fieldPath={field.field_path}
                  fieldType={getFieldType(value)}
                  aiValue={value}
                />
              )}
            </div>
          </div>
        )
      
      case 'badge':
        return (
          <div key={field.id} className={baseClassName}>
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{field.label}</h4>
              {isEmpty ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-400">
                  --
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {String(value)}
                </span>
              )}
              {showGroundTruth && workflowBlockId && (
                <GroundTruthControl
                  requestId={requestId}
                  workflowBlockId={workflowBlockId}
                  workflowBlockName={field.block_name}
                  fieldPath={field.field_path}
                  fieldType={getFieldType(value)}
                  aiValue={value}
                />
              )}
            </div>
          </div>
        )
      
      case 'list':
        return (
          <div key={field.id} className={baseClassName}>
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{field.label}</h4>
              {isEmpty ? (
                <p className="text-sm text-gray-400 italic">No items</p>
              ) : Array.isArray(value) ? (
                <ul className="space-y-1">
                  {value.map((item: any, index: number) => (
                    <li key={index} className="text-sm text-gray-700">
                      • {typeof item === 'string' ? item : JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-700">{String(value)}</p>
              )}
              {showGroundTruth && workflowBlockId && (
                <GroundTruthControl
                  requestId={requestId}
                  workflowBlockId={workflowBlockId}
                  workflowBlockName={field.block_name}
                  fieldPath={field.field_path}
                  fieldType={getFieldType(value)}
                  aiValue={value}
                />
              )}
            </div>
          </div>
        )
      
      case 'card':
        return (
          <div key={field.id} className={baseClassName}>
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{field.label}</h4>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-400 italic">
                  {isEmpty ? 'No content' : String(value)}
                </p>
              </div>
              {showGroundTruth && workflowBlockId && (
                <GroundTruthControl
                  requestId={requestId}
                  workflowBlockId={workflowBlockId}
                  workflowBlockName={field.block_name}
                  fieldPath={field.field_path}
                  fieldType={getFieldType(value)}
                  aiValue={value}
                />
              )}
            </div>
          </div>
        )
      
      case 'json':
        return (
          <div key={field.id} className={baseClassName}>
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{field.label}</h4>
              <pre className="text-xs text-gray-400 bg-gray-50 p-3 rounded-md overflow-x-auto">
                {isEmpty ? '{}' : JSON.stringify(value, null, 2)}
              </pre>
              {showGroundTruth && workflowBlockId && (
                <GroundTruthControl
                  requestId={requestId}
                  workflowBlockId={workflowBlockId}
                  workflowBlockName={field.block_name}
                  fieldPath={field.field_path}
                  fieldType={getFieldType(value)}
                  aiValue={value}
                />
              )}
            </div>
          </div>
        )
      
      default: // text
        return (
          <div key={field.id} className={baseClassName}>
            <div className="bg-white p-4 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{field.label}</h4>
              {isEmpty ? (
                <p className="text-sm text-gray-400 italic">--</p>
              ) : typeof value === 'object' && value !== null ? (
                <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-700">{String(value)}</p>
              )}
              {showGroundTruth && workflowBlockId && (
                <GroundTruthControl
                  requestId={requestId}
                  workflowBlockId={workflowBlockId}
                  workflowBlockName={field.block_name}
                  fieldPath={field.field_path}
                  fieldType={getFieldType(value)}
                  aiValue={value}
                />
              )}
            </div>
          </div>
        )
    }
  }

  const getWidthClass = (width: string) => {
    switch (width) {
      case 'quarter': return 'w-full md:w-1/4'
      case 'third': return 'w-full md:w-1/3'  
      case 'half': return 'w-full md:w-1/2'
      default: return 'w-full'
    }
  }

  const visibleFields = config.fields
    .filter(field => field.visible)
    .sort((a, b) => a.order - b.order)

  if (visibleFields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No dashboard fields configured
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        {visibleFields.map(field => {
          const value = getFieldValue(field.block_name, field.field_path, data)
          return renderField(field, value)
        })}
      </div>
    </div>
  )
}