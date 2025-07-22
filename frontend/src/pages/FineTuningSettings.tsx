import React from 'react'
import { Settings } from './Settings'
import { FineTuningSettings as FineTuningSettingsComponent } from '../components/FineTuningSettings'

export const FineTuningSettingsPage: React.FC = () => {
  return (
    <Settings>
      <div className="px-6 py-6">
        <FineTuningSettingsComponent />
      </div>
    </Settings>
  )
}