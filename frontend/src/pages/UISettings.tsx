import React, { useState, useEffect } from 'react'
import { Switch } from '@headlessui/react'

export const UISettings: React.FC = () => {
  const [showLogsButton, setShowLogsButton] = useState(true)
  const [showSimilarityFeatures, setShowSimilarityFeatures] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [logsResponse, similarityResponse] = await Promise.all([
        fetch('/api/settings/system/ui_show_logs_button'),
        fetch('/api/settings/system/ui_show_similarity_features')
      ])

      if (logsResponse.ok) {
        const logsSetting = await logsResponse.json()
        setShowLogsButton(logsSetting.value === true || logsSetting.value === "true")
      }

      if (similarityResponse.ok) {
        const similaritySetting = await similarityResponse.json()
        setShowSimilarityFeatures(similaritySetting.value === true || similaritySetting.value === "true")
      }
    } catch (error) {
      console.error('Error loading UI settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = async (key: string, value: boolean) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/settings/system/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: value.toString() })
      })

      if (!response.ok) {
        throw new Error('Failed to update setting')
      }

      console.log('Setting updated successfully')
    } catch (error) {
      console.error('Error updating setting:', error)
      // Revert the change
      if (key === 'ui_show_logs_button') {
        setShowLogsButton(!value)
      } else if (key === 'ui_show_similarity_features') {
        setShowSimilarityFeatures(!value)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleLogsButtonToggle = (value: boolean) => {
    setShowLogsButton(value)
    updateSetting('ui_show_logs_button', value)
  }

  const handleSimilarityFeaturesToggle = (value: boolean) => {
    setShowSimilarityFeatures(value)
    updateSetting('ui_show_similarity_features', value)
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-6">User Interface Settings</h2>
      
      <div className="space-y-6">
        <div className="bg-white shadow sm:rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900">Show Logs Button</h3>
              <p className="mt-1 text-sm text-gray-500">
                Display the logs button in the dashboard navigation bar. When disabled, users won't be able to access the Ollama logs viewer.
              </p>
            </div>
            <Switch
              checked={showLogsButton}
              onChange={handleLogsButtonToggle}
              disabled={saving}
              className={`${
                showLogsButton ? 'bg-indigo-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  showLogsButton ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </div>

        <div className="bg-white shadow sm:rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-base font-medium text-gray-900">Show Similarity Features</h3>
              <p className="mt-1 text-sm text-gray-500">
                Display RAG search and similar tasks features. When disabled, the RAG search sidebar button and the "Similar Tasks" tab in the request drawer will be hidden.
              </p>
            </div>
            <Switch
              checked={showSimilarityFeatures}
              onChange={handleSimilarityFeaturesToggle}
              disabled={saving}
              className={`${
                showSimilarityFeatures ? 'bg-indigo-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  showSimilarityFeatures ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>Note: These settings affect the visibility of UI elements across the entire application for all users.</p>
      </div>
    </div>
  )
}