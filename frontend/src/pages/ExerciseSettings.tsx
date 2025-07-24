import React from 'react'
import { ExerciseManager } from '../components/ExerciseManager'

export const ExerciseSettings: React.FC = () => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Exercise Management</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage exercises to organize tasks and control access. Each task is assigned to an exercise,
          and users can be granted permissions to view specific exercises.
        </p>
      </div>
      
      <ExerciseManager />
    </div>
  )
}