import { useState, useEffect } from 'react'

interface UISettings {
  showLogsButton: boolean
  showSimilarityFeatures: boolean
  loading: boolean
}

export const useUISettings = (): UISettings => {
  const [settings, setSettings] = useState<UISettings>({
    showLogsButton: true,
    showSimilarityFeatures: true,
    loading: true
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [logsResponse, similarityResponse] = await Promise.all([
        fetch('/api/settings/system/ui_show_logs_button'),
        fetch('/api/settings/system/ui_show_similarity_features')
      ])

      let showLogsButton = true
      let showSimilarityFeatures = true

      if (logsResponse.ok) {
        const logsSetting = await logsResponse.json()
        showLogsButton = logsSetting.value === true || logsSetting.value === "true"
      }

      if (similarityResponse.ok) {
        const similaritySetting = await similarityResponse.json()
        showSimilarityFeatures = similaritySetting.value === true || similaritySetting.value === "true"
      }

      setSettings({
        showLogsButton,
        showSimilarityFeatures,
        loading: false
      })
    } catch (error) {
      console.error('Error loading UI settings:', error)
      // Default to showing everything on error
      setSettings({
        showLogsButton: true,
        showSimilarityFeatures: true,
        loading: false
      })
    }
  }

  return settings
}