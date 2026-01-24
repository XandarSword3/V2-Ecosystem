"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Default to environment variable or localhost:3001 for backend
    const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    
    const socketInstance = io(url, {
       path: '/socket.io',
       transports: ['websocket'],
       reconnectionAttempts: 5,
       reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  return socket;
};
