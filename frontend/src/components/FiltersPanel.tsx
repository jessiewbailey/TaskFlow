import React from 'react'
import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import type { RequestStatus, RequestFilters } from '../types'

interface FiltersPanelProps {
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
}

const statusOptions: { value: RequestStatus | '', label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'NEW', label: 'New' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CLOSED', label: 'Closed' },
]

const sortOptions = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'updated_at', label: 'Date Updated' },
  { value: 'date_received', label: 'Date Received' },
  { value: 'due_date', label: 'Due Date' },
]

const orderOptions = [
  { value: 'desc', label: 'Newest First' },
  { value: 'asc', label: 'Oldest First' },
]

export const FiltersPanel: React.FC<FiltersPanelProps> = ({ filters, onFiltersChange }) => {
  const handleStatusChange = (status: RequestStatus | '') => {
    onFiltersChange({
      ...filters,
      status: status || undefined,
      page: 1, // Reset to first page when filtering
    })
  }

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({
      ...filters,
      sort_by: sortBy,
      page: 1,
    })
  }

  const handleOrderChange = (order: 'asc' | 'desc') => {
    onFiltersChange({
      ...filters,
      order,
      page: 1,
    })
  }

  const currentStatus = statusOptions.find(option => option.value === filters.status) || statusOptions[0]
  const currentSort = sortOptions.find(option => option.value === filters.sort_by) || sortOptions[0]
  const currentOrder = orderOptions.find(option => option.value === filters.order) || orderOptions[0]

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      <div className="flex flex-wrap gap-4 items-center">
        <h2 className="text-lg font-medium text-gray-900">Filters</h2>
        
        {/* Status Filter */}
        <div className="min-w-[160px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <Listbox value={currentStatus} onChange={handleStatusChange}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                <span className="block truncate">{currentStatus.label}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {statusOptions.map((option) => (
                    <Listbox.Option
                      key={option.value}
                      className={({ active }) =>
                        clsx(
                          'relative cursor-default select-none py-2 pl-10 pr-4',
                          active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                        )
                      }
                      value={option.value}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={clsx('block truncate', selected ? 'font-medium' : 'font-normal')}>
                            {option.label}
                          </span>
                          {selected ? (
                            <span
                              className={clsx(
                                'absolute inset-y-0 left-0 flex items-center pl-3',
                                active ? 'text-white' : 'text-indigo-600'
                              )}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>

        {/* Sort By Filter */}
        <div className="min-w-[160px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <Listbox value={currentSort} onChange={(option) => handleSortChange(option.value)}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                <span className="block truncate">{currentSort.label}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {sortOptions.map((option) => (
                    <Listbox.Option
                      key={option.value}
                      className={({ active }) =>
                        clsx(
                          'relative cursor-default select-none py-2 pl-10 pr-4',
                          active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                        )
                      }
                      value={option}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={clsx('block truncate', selected ? 'font-medium' : 'font-normal')}>
                            {option.label}
                          </span>
                          {selected ? (
                            <span
                              className={clsx(
                                'absolute inset-y-0 left-0 flex items-center pl-3',
                                active ? 'text-white' : 'text-indigo-600'
                              )}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>

        {/* Order Filter */}
        <div className="min-w-[140px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order
          </label>
          <Listbox value={currentOrder} onChange={(option) => handleOrderChange(option.value as 'asc' | 'desc')}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                <span className="block truncate">{currentOrder.label}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {orderOptions.map((option) => (
                    <Listbox.Option
                      key={option.value}
                      className={({ active }) =>
                        clsx(
                          'relative cursor-default select-none py-2 pl-10 pr-4',
                          active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                        )
                      }
                      value={option}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={clsx('block truncate', selected ? 'font-medium' : 'font-normal')}>
                            {option.label}
                          </span>
                          {selected ? (
                            <span
                              className={clsx(
                                'absolute inset-y-0 left-0 flex items-center pl-3',
                                active ? 'text-white' : 'text-indigo-600'
                              )}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>
      </div>
    </div>
  )
}