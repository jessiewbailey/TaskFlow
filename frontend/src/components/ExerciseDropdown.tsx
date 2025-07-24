import React from 'react'
import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Exercise } from '../types'

interface ExerciseDropdownProps {
  exercises: Exercise[]
  selectedExercise: Exercise | null
  onSelectExercise: (exercise: Exercise) => void
  loading?: boolean
  className?: string
}

export const ExerciseDropdown: React.FC<ExerciseDropdownProps> = ({
  exercises,
  selectedExercise,
  onSelectExercise,
  loading = false,
  className = '',
}) => {
  // Filter to only show active exercises
  const activeExercises = exercises.filter(ex => ex.is_active)

  if (loading) {
    return (
      <div className={`w-64 ${className}`}>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded-md"></div>
        </div>
      </div>
    )
  }

  if (activeExercises.length === 0) {
    return (
      <div className={`w-64 ${className}`}>
        <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-md">
          No active exercises available
        </div>
      </div>
    )
  }

  return (
    <div className={`w-64 ${className}`}>
      <Listbox value={selectedExercise} onChange={onSelectExercise}>
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-300 sm:text-sm">
            <span className="block truncate">
              {selectedExercise?.name || 'Select an exercise'}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {activeExercises.map((exercise) => (
                <Listbox.Option
                  key={exercise.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                    }`
                  }
                  value={exercise}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? 'font-medium' : 'font-normal'
                        }`}
                      >
                        {exercise.name}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                      {exercise.description && (
                        <span className="text-sm text-gray-500 truncate block">
                          {exercise.description}
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}