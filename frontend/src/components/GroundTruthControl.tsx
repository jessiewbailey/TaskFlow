import React, { useState, useEffect } from 'react'
import { 
  CheckCircleIcon, 
  PencilSquareIcon, 
  XMarkIcon,
  CheckIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { groundTruthClient, GroundTruthData } from '../api/groundTruthClient'

interface GroundTruthControlProps {
  requestId: number
  workflowBlockId: number
  workflowBlockName: string
  fieldPath: string
  fieldType: 'text' | 'number' | 'array' | 'object' | 'boolean'
  aiValue: any
  onGroundTruthUpdate?: (groundTruth: GroundTruthData | null) => void
}

export const GroundTruthControl: React.FC<GroundTruthControlProps> = ({
  requestId,
  workflowBlockId,
  workflowBlockName,
  fieldPath,
  fieldType,
  aiValue,
  onGroundTruthUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [groundTruth, setGroundTruth] = useState<GroundTruthData | null>(null)
  const [editValue, setEditValue] = useState<any>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGroundTruth()
  }, [requestId, workflowBlockId, fieldPath])

  const loadGroundTruth = async () => {
    try {
      const data = await groundTruthClient.getGroundTruthForField(
        requestId,
        workflowBlockId,
        fieldPath
      )
      setGroundTruth(data)
      if (data) {
        setEditValue(formatValueForEdit(data.ground_truth_value))
        setNotes(data.notes || '')
      }
      onGroundTruthUpdate?.(data)
    } catch (err) {
      console.error('Failed to load ground truth:', err)
    }
  }

  const formatValueForEdit = (value: any): string => {
    if (fieldType === 'array' || fieldType === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value || '')
  }

  const parseEditValue = (): any => {
    try {
      if (fieldType === 'array' || fieldType === 'object') {
        return JSON.parse(editValue)
      }
      if (fieldType === 'number') {
        return parseFloat(editValue)
      }
      if (fieldType === 'boolean') {
        return editValue.toLowerCase() === 'true'
      }
      return editValue
    } catch (err) {
      throw new Error('Invalid format for ' + fieldType)
    }
  }

  const handleSave = async () => {
    setError(null)
    setLoading(true)
    
    try {
      const parsedValue = parseEditValue()
      
      const data: GroundTruthData = {
        request_id: requestId,
        workflow_block_id: workflowBlockId,
        field_path: fieldPath,
        ai_value: aiValue,
        ground_truth_value: parsedValue,
        notes: notes || undefined
      }
      
      const saved = await groundTruthClient.createOrUpdateGroundTruth(data)
      setGroundTruth(saved)
      setIsEditing(false)
      onGroundTruthUpdate?.(saved)
    } catch (err: any) {
      setError(err.message || 'Failed to save ground truth')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!groundTruth?.id) return
    
    if (!confirm('Are you sure you want to delete this ground truth?')) return
    
    setLoading(true)
    try {
      await groundTruthClient.deleteGroundTruth(groundTruth.id)
      setGroundTruth(null)
      setEditValue('')
      setNotes('')
      setIsEditing(false)
      onGroundTruthUpdate?.(null)
    } catch (err) {
      setError('Failed to delete ground truth')
    } finally {
      setLoading(false)
    }
  }

  const startEditing = () => {
    setIsEditing(true)
    if (groundTruth) {
      setEditValue(formatValueForEdit(groundTruth.ground_truth_value))
      setNotes(groundTruth.notes || '')
    } else {
      setEditValue(formatValueForEdit(aiValue))
      setNotes('')
    }
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setError(null)
    if (groundTruth) {
      setEditValue(formatValueForEdit(groundTruth.ground_truth_value))
      setNotes(groundTruth.notes || '')
    } else {
      setEditValue('')
      setNotes('')
    }
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Ground Truth</span>
          {groundTruth && (
            <CheckCircleIcon className="h-4 w-4 text-green-600" title="Has ground truth" />
          )}
        </div>
        
        {!isEditing && (
          <button
            onClick={startEditing}
            className="p-1 text-blue-600 hover:text-blue-800"
            title="Edit ground truth"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Correct Value
            </label>
            {fieldType === 'array' || fieldType === 'object' ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Enter ${fieldType} in JSON format`}
              />
            ) : fieldType === 'boolean' ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                type={fieldType === 'number' ? 'number' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Enter correct ${fieldType} value`}
              />
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Why is this the correct value?"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Save
              </button>
              <button
                onClick={cancelEditing}
                disabled={loading}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Cancel
              </button>
            </div>
            
            {groundTruth && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : groundTruth ? (
        <div>
          <div className="text-sm">
            <span className="font-medium text-gray-600">Value: </span>
            <span className="text-gray-900">
              {fieldType === 'object' || fieldType === 'array' 
                ? JSON.stringify(groundTruth.ground_truth_value)
                : String(groundTruth.ground_truth_value)
              }
            </span>
          </div>
          {groundTruth.notes && (
            <div className="text-sm mt-1">
              <span className="font-medium text-gray-600">Notes: </span>
              <span className="text-gray-700">{groundTruth.notes}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            By {groundTruth.created_by_name} at {new Date(groundTruth.updated_at!).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          No ground truth set. Click edit to add one.
        </div>
      )}
    </div>
  )
}