'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const joinRoom = (room: string) => {
    socket?.emit('join-room', room);
  };

  const leaveRoom = (room: string) => {
    socket?.emit('leave-room', room);
  };

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
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
