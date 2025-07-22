import React, { useState, useEffect } from 'react'
import { Switch } from '@headlessui/react'
import { groundTruthClient, UserPreferences } from '../api/groundTruthClient'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

interface FineTuningSettingsProps {
  onPreferencesChange?: (preferences: UserPreferences) => void
}

export const FineTuningSettings: React.FC<FineTuningSettingsProps> = ({
  onPreferencesChange
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    fine_tuning_mode: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const prefs = await groundTruthClient.getUserPreferences()
      setPreferences(prefs)
      onPreferencesChange?.(prefs)
    } catch (err) {
      console.error('Failed to load preferences:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFineTuningMode = async (enabled: boolean) => {
    setSaving(true)
    try {
      const updated = await groundTruthClient.updateUserPreferences({
        fine_tuning_mode: enabled
      })
      setPreferences(updated)
      onPreferencesChange?.(updated)
    } catch (err) {
      console.error('Failed to update preferences:', err)
      // Revert on error
      setPreferences(prev => ({ ...prev, fine_tuning_mode: !enabled }))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading settings...</div>
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Fine-Tuning Settings</h2>
      
      <div className="space-y-4">
        <div className="flex items-start">
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="text-sm font-medium text-gray-900">
                Fine-Tuning Mode
              </h3>
              <InformationCircleIcon 
                className="ml-2 h-4 w-4 text-gray-400" 
                title="Enable to show ground truth controls in the AI analysis dashboard"
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              When enabled, shows controls to add ground truth values for AI-generated fields. 
              This data can be exported later for model fine-tuning.
            </p>
          </div>
          
          <Switch
            checked={preferences.fine_tuning_mode}
            onChange={handleToggleFineTuningMode}
            disabled={saving}
            className={`${
              preferences.fine_tuning_mode ? 'bg-blue-600' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              saving ? 'opacity-50' : ''
            }`}
          >
            <span
              className={`${
                preferences.fine_tuning_mode ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
        </div>

        {preferences.fine_tuning_mode && (
          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Fine-Tuning Mode Active
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Ground truth controls are now visible in the AI analysis dashboard</li>
                    <li>Click the edit icon next to any AI-generated field to add the correct value</li>
                    <li>Your corrections will be saved for future model training</li>
                    <li>You can export all ground truth data from the Export page</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}