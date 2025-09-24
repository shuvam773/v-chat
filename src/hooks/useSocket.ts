import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

declare global {
  interface Window {
    socketInstance: Socket;
    signalHandler: (data: any) => void;
  }
}

export const useSocket = (
  onPeerFound: (isInitiator: boolean, signalHandler: (signal: any) => void) => void,
  onPeerDisconnected: () => void
) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // const socket = io('http://localhost:3001');
    const socket = io('https://v-chat-qdyg.onrender.com/');
    socketRef.current = socket;
    window.socketInstance = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setIsConnected(false);
    });

    socket.on('waiting-for-peer', () => {
      console.log('Waiting for peer...');
    });

    socket.on('peer-found', (data) => {
      console.log('Peer found:', data);
      onPeerFound(data.initiator, (signal) => {
        socket.emit('signal', { signal });
      });
    });

    socket.on('signal', (data) => {
      console.log('Received signal:', data);
      if (window.signalHandler) {
        window.signalHandler(data);
      }
    });

    socket.on('peer-disconnected', () => {
      console.log('Peer disconnected');
      onPeerDisconnected();
    });

    return () => {
      socket.disconnect();
    };
  }, [onPeerFound, onPeerDisconnected]);

  const findPeer = () => {
    if (socketRef.current) {
      socketRef.current.emit('find-peer');
    }
  };

  const disconnectPeer = () => {
    if (socketRef.current) {
      socketRef.current.emit('disconnect-peer');
    }
  };

  return {
    isConnected,
    findPeer,
    disconnectPeer
  };
};