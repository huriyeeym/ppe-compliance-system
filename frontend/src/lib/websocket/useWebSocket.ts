/**
 * WebSocket hook for real-time violation notifications
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { logger } from '../utils/logger'

export interface ViolationNotification {
  type: 'violation'
  data: {
    id: number
    camera_id: number
    domain_id: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    missing_ppe: Array<{ type: string; name?: string }>
    timestamp: string
    snapshot_path?: string | null
    video_path?: string | null
    track_id?: number | null
  }
  timestamp: string
}

export interface WebSocketMessage {
  type: 'connected' | 'violation' | 'keepalive' | 'pong'
  data?: any
  message?: string
  timestamp?: string
}

interface UseWebSocketOptions {
  domainIds?: number[]  // Filter violations by domain IDs (empty = all domains)
  onViolation?: (violation: ViolationNotification['data']) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  autoReconnect?: boolean
  reconnectInterval?: number  // milliseconds
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    domainIds = [],
    onViolation,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnectRef = useRef(true)

  // Store callbacks in refs to avoid recreating connection on callback changes
  const onViolationRef = useRef(onViolation)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onViolationRef.current = onViolation
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
    onErrorRef.current = onError
  }, [onViolation, onConnect, onDisconnect, onError])

  // Store domainIds in ref to avoid recreating connection
  const domainIdsRef = useRef(domainIds)
  useEffect(() => {
    domainIdsRef.current = domainIds
  }, [domainIds])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected')
      return
    }

    try {
      // Build WebSocket URL using ref value
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || 'localhost:8000'
      const domainIdsParam = domainIdsRef.current.length > 0 ? `?domain_ids=${domainIdsRef.current.join(',')}` : ''
      const wsUrl = `${protocol}//${host}/api/v1/ws/notifications${domainIdsParam}`

      logger.info(`Connecting to WebSocket: ${wsUrl}`)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        logger.info('WebSocket connected')
        setIsConnected(true)
        setConnectionError(null)
        shouldReconnectRef.current = true
        onConnectRef.current?.()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          logger.debug('WebSocket message received', message)

          switch (message.type) {
            case 'connected':
              logger.info('WebSocket connection confirmed')
              break
            case 'violation':
              if (message.data && onViolationRef.current) {
                onViolationRef.current(message.data)
              }
              break
            case 'keepalive':
            case 'pong':
              // Keep connection alive
              break
            default:
              logger.warn('Unknown WebSocket message type', message.type)
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message', error)
        }
      }

      ws.onerror = (error) => {
        logger.error('WebSocket error', error)
        setConnectionError('WebSocket connection error')
        onErrorRef.current?.(error)
      }

      ws.onclose = (event) => {
        logger.info('WebSocket disconnected', { code: event.code, reason: event.reason })
        setIsConnected(false)

        if (shouldReconnectRef.current && autoReconnect && event.code !== 1000) {
          // Normal closure (1000) means intentional disconnect, don't reconnect
          logger.info(`Reconnecting in ${reconnectInterval}ms...`)
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) {
              connect()
            }
          }, reconnectInterval)
        }

        onDisconnectRef.current?.()
      }

      wsRef.current = ws
    } catch (error) {
      logger.error('Failed to create WebSocket connection', error)
      setConnectionError('Failed to create WebSocket connection')
      onErrorRef.current?.(error as Event)
    }
  }, [autoReconnect, reconnectInterval])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect')
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      logger.warn('WebSocket is not connected, cannot send message')
    }
  }, [])

  // Only reconnect when domainIds actually change (not on every render)
  // Use useMemo to stabilize the domainIds string representation
  // Convert array to sorted string for comparison
  const domainIdsString = useMemo(() => {
    if (domainIds.length === 0) return ''
    const sorted = [...domainIds].sort((a, b) => a - b)
    return sorted.join(',')
  }, [domainIds]) // React will handle deep comparison for arrays in useMemo

  useEffect(() => {
    // Only connect if not already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected, skipping reconnect')
      return
    }

    // Disconnect existing connection if any
    if (wsRef.current) {
      disconnect()
    }

    // Small delay to ensure disconnect completes
    const timeoutId = setTimeout(() => {
      connect()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainIdsString]) // Only depend on domainIds string representation

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    sendMessage,
  }
}

