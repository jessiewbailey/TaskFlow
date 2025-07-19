import React, { useState, useEffect, useRef } from 'react'
import { 
  XMarkIcon, 
  PauseIcon, 
  PlayIcon, 
  ArrowDownIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL !== undefined 
  ? (import.meta as any).env.VITE_API_BASE_URL 
  : ''

interface LogEntry {
  timestamp: string
  level: string
  message: string
  source: string
}

interface LogViewerProps {
  isOpen: boolean
  onClose: () => void
}

export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL')
  
  const logContainerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isUserScrollingRef = useRef(false)
  
  useEffect(() => {
    if (isOpen) {
      connectWebSocket()
      fetchRecentLogs()
    } else {
      disconnectWebSocket()
    }
    
    return () => {
      disconnectWebSocket()
    }
  }, [isOpen])
  
  useEffect(() => {
    if (autoScroll && logContainerRef.current && !isUserScrollingRef.current) {
      const container = logContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [logs, autoScroll])
  
  // Auto-scroll detection
  useEffect(() => {
    const container = logContainerRef.current
    if (!container) return
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold
      
      if (isAtBottom) {
        setAutoScroll(true)
        isUserScrollingRef.current = false
      } else {
        setAutoScroll(false)
        isUserScrollingRef.current = true
      }
    }
    
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isOpen])
  
  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/logs/ollama/stream`
      wsRef.current = new WebSocket(wsUrl)
      
      wsRef.current.onopen = () => {
        setIsConnected(true)
        console.log('WebSocket connected for log streaming')
      }
      
      wsRef.current.onmessage = (event) => {
        if (!isPaused) {
          try {
            const logEntry: LogEntry = JSON.parse(event.data)
            setLogs(prev => [...prev, logEntry])
          } catch (error) {
            console.error('Failed to parse log entry:', error)
          }
        }
      }
      
      wsRef.current.onclose = () => {
        setIsConnected(false)
        console.log('WebSocket disconnected for log streaming')
      }
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      setIsConnected(false)
    }
  }
  
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }
  
  const fetchRecentLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logs/ollama/recent?lines=100`)
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to fetch recent logs:', error)
    }
  }
  
  const togglePause = () => {
    setIsPaused(!isPaused)
  }
  
  const clearLogs = () => {
    setLogs([])
  }
  
  const scrollToBottom = () => {
    if (logContainerRef.current) {
      const container = logContainerRef.current
      container.scrollTop = container.scrollHeight
      setAutoScroll(true)
      isUserScrollingRef.current = false
    }
  }
  
  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      case 'debug':
        return 'text-gray-400'
      default:
        return 'text-green-400'
    }
  }
  
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === '' || log.message.toLowerCase().includes(filter.toLowerCase())
    const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel
    return matchesFilter && matchesLevel
  })
  
  const levels = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG']
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" />
        
        <div className="inline-block align-bottom bg-gray-900 text-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-medium text-white">
                  Ollama Logs
                </h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-gray-300">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={togglePause}
                  className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
                </button>
                
                <button
                  onClick={clearLogs}
                  className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                  title="Clear logs"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
                
                <button
                  onClick={scrollToBottom}
                  className={`p-2 rounded-md hover:text-white hover:bg-gray-700 ${autoScroll ? 'text-green-400' : 'text-gray-400'}`}
                  title={autoScroll ? "Auto-scroll active" : "Jump to bottom"}
                >
                  <ArrowDownIcon className="h-5 w-5" />
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center space-x-4 mt-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Filter:</label>
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search logs..."
                  className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">Level:</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => {
                      setAutoScroll(e.target.checked)
                      if (e.target.checked) {
                        isUserScrollingRef.current = false
                        scrollToBottom()
                      }
                    }}
                    className="mr-2"
                  />
                  Auto-scroll
                </label>
              </div>
              
              <div className="text-sm text-gray-400">
                {filteredLogs.length} / {logs.length} logs
              </div>
            </div>
          </div>
          
          {/* Log Content */}
          <div 
            ref={logContainerRef}
            className="h-96 overflow-y-auto bg-black font-mono text-sm p-4 space-y-1"
          >
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                {logs.length === 0 ? 'No logs available' : 'No logs match the current filter'}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 hover:bg-gray-800 px-2 py-1 rounded">
                  <span className="text-gray-500 text-xs w-20 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`w-12 text-xs font-bold flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-gray-300 flex-1 break-words">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
          
          {/* Status Bar */}
          <div className="bg-gray-800 px-4 py-2 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center space-x-4">
                {isPaused && (
                  <span className="text-yellow-400">⏸ Paused - New logs will be buffered</span>
                )}
                {!autoScroll && (
                  <span className="text-blue-400">↑ Scroll up - Auto-scroll disabled</span>
                )}
                {autoScroll && (
                  <span className="text-green-400">↓ Auto-scroll active</span>
                )}
              </div>
              <div>
                Container: taskflow-ollama
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}