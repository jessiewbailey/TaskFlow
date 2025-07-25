import React, { useState } from 'react'
import { Exercise, ExerciseCreate, ExerciseUpdate } from '../types'
import { useExercises } from '../hooks/useExercises'
import { Dialog } from '@headlessui/react'
import { PlusIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon, StarIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

export const ExerciseManager: React.FC = () => {
  const { exercises, loading, createExercise, updateExercise, deleteExercise, setDefaultExercise } = useExercises()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [formData, setFormData] = useState<ExerciseCreate>({
    name: '',
    description: '',
    is_active: true,
    is_default: false,
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      is_default: false,
    })
    setEditingExercise(null)
  }

  const openCreateModal = () => {
    resetForm()
    setIsCreateModalOpen(true)
  }

  const openEditModal = (exercise: Exercise) => {
    setEditingExercise(exercise)
    setFormData({
      name: exercise.name,
      description: exercise.description || '',
      is_active: exercise.is_active,
      is_default: exercise.is_default,
    })
    setIsCreateModalOpen(true)
  }

  const closeModal = () => {
    setIsCreateModalOpen(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingExercise) {
        const updateData: ExerciseUpdate = {}
        if (formData.name !== editingExercise.name) updateData.name = formData.name
        if (formData.description !== editingExercise.description) updateData.description = formData.description
        if (formData.is_active !== editingExercise.is_active) updateData.is_active = formData.is_active
        if (formData.is_default !== editingExercise.is_default) updateData.is_default = formData.is_default
        
        await updateExercise(editingExercise.id, updateData)
      } else {
        await createExercise(formData)
      }
      closeModal()
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleDelete = async (exercise: Exercise) => {
    if (window.confirm(`Are you sure you want to delete "${exercise.name}"?`)) {
      try {
        await deleteExercise(exercise.id)
      } catch (error) {
        // Error is handled in the hook
      }
    }
  }

  const handleSetDefault = async (exercise: Exercise) => {
    try {
      await setDefaultExercise(exercise.id)
    } catch (error) {
      // Error is handled in the hook
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Exercises</h3>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" />
            New Exercise
          </button>
        </div>

        <div className="space-y-2">
          {loading && exercises.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Loading exercises...</p>
          ) : exercises.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No exercises found. Create one to get started.</p>
          ) : (
            exercises.map((exercise) => (
              <div
                key={exercise.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  exercise.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className={`font-medium ${exercise.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                      {exercise.name}
                    </h4>
                    {exercise.is_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                    {!exercise.is_active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  {exercise.description && (
                    <p className="text-sm text-gray-500 mt-1">{exercise.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {exercise.is_active && !exercise.is_default && (
                    <button
                      onClick={() => handleSetDefault(exercise)}
                      className="text-gray-400 hover:text-yellow-600"
                      title="Set as default"
                    >
                      <StarIcon className="h-5 w-5" />
                    </button>
                  )}
                  {exercise.is_default && (
                    <StarIconSolid className="h-5 w-5 text-yellow-500" title="Default exercise" />
                  )}
                  <button
                    onClick={() => openEditModal(exercise)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(exercise)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen} onClose={closeModal} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <form onSubmit={handleSubmit}>
              <div className="px-4 pt-5 pb-4 sm:p-6">
                <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                  {editingExercise ? 'Edit Exercise' : 'Create New Exercise'}
                </Dialog.Title>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                      maxLength={128}
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        id="is_active"
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                        Active
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="is_default"
                        type="checkbox"
                        checked={formData.is_default}
                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        disabled={!formData.is_active}
                      />
                      <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                        Set as default exercise
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingExercise ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  )
}