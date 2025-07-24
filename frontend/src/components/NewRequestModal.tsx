import React, { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useCreateRequest } from '../hooks/useRequests'
import { useWorkflows } from '../hooks/useWorkflows'
import { useUILabels } from '../hooks/useConfig'
import { Exercise } from '../types'

interface NewRequestModalProps {
  isOpen: boolean
  onClose: () => void
  selectedExercise?: Exercise | null
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, selectedExercise }) => {
  const [formData, setFormData] = useState({
    text: '',
    requester: '',
    workflow_id: null as number | null
  })

  const createRequest = useCreateRequest()
  const { data: workflowsData } = useWorkflows()
  const { data: labels } = useUILabels()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.text.trim()) {
      return
    }

    try {
      await createRequest.mutateAsync({
        text: formData.text.trim(),
        requester: formData.requester.trim() || undefined,
        workflow_id: formData.workflow_id,
        exercise_id: selectedExercise?.id
      })
      
      // Reset form and close modal
      setFormData({ text: '', requester: '', workflow_id: null })
      onClose()
    } catch (error) {
      console.error('Failed to create request:', error)
    }
  }

  const handleClose = () => {
    if (!createRequest.isPending) {
      setFormData({ text: '', requester: '', workflow_id: null })
      onClose()
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={handleClose}
                    disabled={createRequest.isPending}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Create New Task
                    </Dialog.Title>
                    
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                      <div>
                        <label htmlFor="requester" className="block text-sm font-medium text-gray-700">
                          {labels?.forms?.new_task_modal?.requester_label || 'Submitter'} (optional)
                        </label>
                        <input
                          type="text"
                          id="requester"
                          value={formData.requester}
                          onChange={(e) => setFormData(prev => ({ ...prev, requester: e.target.value }))}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder={labels?.forms?.new_task_modal?.requester_placeholder || 'Enter requester name or organization'}
                          disabled={createRequest.isPending}
                        />
                      </div>

                      <div>
                        <label htmlFor="workflow" className="block text-sm font-medium text-gray-700">
                          Workflow
                        </label>
                        <select
                          id="workflow"
                          value={formData.workflow_id || ''}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            workflow_id: e.target.value ? parseInt(e.target.value) : null 
                          }))}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          disabled={createRequest.isPending}
                        >
                          <option value="">Use default workflow</option>
                          {workflowsData?.workflows?.map((workflow) => (
                            <option key={workflow.id} value={workflow.id}>
                              {workflow.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-sm text-gray-500">
                          Select a workflow for processing this request
                        </p>
                      </div>

                      <div>
                        <label htmlFor="text" className="block text-sm font-medium text-gray-700">
                          Task Description *
                        </label>
                        <textarea
                          id="text"
                          rows={8}
                          value={formData.text}
                          onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="Enter the context text..."
                          required
                          disabled={createRequest.isPending}
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Minimum 10 characters required
                        </p>
                      </div>

                      {createRequest.isError && (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="text-sm text-red-700">
                            Failed to create request. Please try again.
                          </div>
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={createRequest.isPending || formData.text.trim().length < 10}
                          className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 sm:ml-3 sm:w-auto"
                        >
                          {createRequest.isPending ? 'Creating...' : 'Create Task'}
                        </button>
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                          onClick={handleClose}
                          disabled={createRequest.isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}