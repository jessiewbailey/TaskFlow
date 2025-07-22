import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  CogIcon, 
  PlayIcon, 
  UserIcon, 
  BellIcon,
  ArrowLeftIcon,
  BeakerIcon 
} from '@heroicons/react/24/outline'

const settingsNavigation = [
  { name: 'Workflows', href: '/settings/workflows', icon: PlayIcon },
  { name: 'Users', href: '/settings/users', icon: UserIcon },
  { name: 'Notifications', href: '/settings/notifications', icon: BellIcon },
  { name: 'Fine-Tuning', href: '/settings/fine-tuning', icon: BeakerIcon },
]

interface SettingsProps {
  children: React.ReactNode
}

export const Settings: React.FC<SettingsProps> = ({ children }) => {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <Link
                  to="/"
                  className="mr-4 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                  <CogIcon className="inline h-8 w-8 mr-2 text-gray-600" />
                  Settings
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
            {/* Settings Navigation */}
            <aside className="py-6 lg:col-span-3">
              <nav className="space-y-1 px-6">
                {settingsNavigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive
                          ? 'bg-teal-50 border-teal-500 text-teal-700'
                          : 'border-transparent text-gray-900 hover:bg-gray-50'
                      } group border-l-4 px-3 py-2 flex items-center text-sm font-medium`}
                    >
                      <item.icon
                        className={`${
                          isActive
                            ? 'text-teal-500'
                            : 'text-gray-400 group-hover:text-gray-500'
                        } flex-shrink-0 -ml-1 mr-3 h-6 w-6`}
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </aside>

            {/* Settings Content */}
            <div className="divide-y divide-gray-200 lg:col-span-9">
              <div className="px-6 py-6 lg:px-8">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}