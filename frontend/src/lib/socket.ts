'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// SOCKET_URL should NOT include /api
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Ensure we don't have /api suffix for socket connection
const cleanSocketUrl = SOCKET_URL.replace(/\/api\/?$/, '');

// Singleton socket instance to prevent multiple connections
let globalSocket: Socket | null = null;
let socketRefCount = 0;
let heartbeatInterval: NodeJS.Timeout | null = null;

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function createSocket(): Socket {
  const token = getAuthToken();
  
  const socket = io(cleanSocketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 120000,           // Match server pingTimeout (2 minutes)
    forceNew: false,           // Reuse existing connection
    multiplex: true,           // Allow connection sharing
    autoConnect: true,
    auth: token ? { token } : undefined,
    // Buffer events when disconnected
    retries: 3,
  });

  // Setup heartbeat to keep connection alive
  socket.on('connect', () => {
    // Clear any existing heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    // Send heartbeat every 30 seconds
    heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 30000);
  });

  socket.on('disconnect', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  return socket;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  reconnect: () => void;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  const reconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket.connect();
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // Use singleton pattern - create or reuse global socket
    if (!globalSocket || globalSocket.disconnected) {
      globalSocket = createSocket();
    }
    
    socketRefCount++;
    const socketInstance = globalSocket;

    const handleConnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        console.log('[Socket] Connected:', socketInstance.id);
      }
    };

    const handleDisconnect = (reason: string) => {
      if (mountedRef.current) {
        setIsConnected(false);
        console.log('[Socket] Disconnected:', reason);
      }
      // Handle specific disconnect reasons
      if (reason === 'io server disconnect') {
        // Server forcefully disconnected - reconnect
        setTimeout(() => socketInstance.connect(), 1000);
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network issue - socket.io will auto-reconnect
        console.log('[Socket] Transport issue, auto-reconnecting...');
      } else if (reason === 'ping timeout') {
        // Ping timeout - try to reconnect
        console.log('[Socket] Ping timeout, reconnecting...');
        setTimeout(() => socketInstance.connect(), 2000);
      }
    };

    const handleConnectError = (error: Error) => {
      console.log('[Socket] Connection error:', error.message);
      // If auth error, try reconnecting without token
      if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        console.log('[Socket] Auth error, reconnecting...');
      }
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      // Re-authenticate on reconnect
      const token = getAuthToken();
      if (token && socketInstance.auth) {
        (socketInstance.auth as { token?: string }).token = token;
      }
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      console.log('[Socket] Reconnect attempt:', attemptNumber);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('connect_error', handleConnectError);
    socketInstance.io.on('reconnect', handleReconnect);
    socketInstance.io.on('reconnect_attempt', handleReconnectAttempt);

    // Set initial state if already connected
    if (socketInstance.connected) {
      setIsConnected(true);
    }

    setSocket(socketInstance);

    return () => {
      mountedRef.current = false;
      socketRefCount--;
      
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('connect_error', handleConnectError);
      socketInstance.io.off('reconnect', handleReconnect);
      socketInstance.io.off('reconnect_attempt', handleReconnectAttempt);
      
      // Only disconnect when no components are using the socket
      if (socketRefCount === 0 && globalSocket) {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        globalSocket.disconnect();
        globalSocket = null;
      }
    };
  }, []);

  const joinRoom = useCallback((room: string) => {
    socket?.emit('join-room', room, (success: boolean) => {
      if (success) {
        console.log('[Socket] Joined room:', room);
      }
    });
  }, [socket]);

  const leaveRoom = useCallback((room: string) => {
    socket?.emit('leave-room', room);
  }, [socket]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    reconnect,
  };
}

export function useOrderUpdates(orderId: string, onUpdate: (data: any) => void) {
  const { socket, joinRoom, leaveRoom } = useSocket();

  useEffect(() => {
    if (socket && orderId) {
      joinRoom(`order-${orderId}`);

      socket.on('order-status-updated', onUpdate);

      return () => {
        leaveRoom(`order-${orderId}`);
        socket.off('order-status-updated', onUpdate);
      };
    }
  }, [socket, orderId]);
}

export function useRestaurantOrders(onNewOrder: (data: any) => void, onStatusUpdate: (data: any) => void) {
  const { socket, joinRoom, leaveRoom } = useSocket();

  useEffect(() => {
    if (socket) {
      joinRoom('restaurant-kitchen');

      socket.on('new-order', onNewOrder);
      socket.on('order-status-updated', onStatusUpdate);

      return () => {
        leaveRoom('restaurant-kitchen');
        socket.off('new-order', onNewOrder);
        socket.off('order-status-updated', onStatusUpdate);
      };
    }
  }, [socket]);
}
