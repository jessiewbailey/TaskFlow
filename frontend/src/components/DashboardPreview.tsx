import React from 'react'
import { DashboardConfig } from '../types/workflow'
import { DashboardRenderer } from './DashboardRenderer'

interface DashboardPreviewProps {
  config: DashboardConfig
}

export const DashboardPreview: React.FC<DashboardPreviewProps> = ({ config }) => {
  // Empty data to show just the field structure
  const sampleData: Record<string, any> = {}

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
      <div className="bg-white rounded-md p-4 min-h-[200px]">
        <DashboardRenderer config={config} data={sampleData} />
      </div>
    </div>
  )
}