import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

declare global {
  interface Window {
    socketInstance: Socket;
    signalHandler: (data: any) => void;
  }
}

interface UseSocketProps {
  onPeerFound: (isInitiator: boolean, signalHandler: (signal: any) => void) => void;
  onPeerDisconnected: () => void;
  onReceiveMessage?: (message: any) => void;
}

export const useSocket = ({
  onPeerFound,
  onPeerDisconnected,
  onReceiveMessage
}: UseSocketProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('https://v-chat-qdyg.onrender.com');
    socketRef.current = socket;
    window.socketInstance = socket;

    socket.on('connect', () => {
      
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      
      setIsConnected(false);
    });

    socket.on('waiting-for-peer', () => {
      // console.log('Waiting for peer...');
    });

    socket.on('peer-found', (data) => {
      
      onPeerFound(data.initiator, (signal) => {
        socket.emit('signal', { signal });
      });
    });

    socket.on('signal', (data) => {
      
      if (window.signalHandler) {
        window.signalHandler(data);
      }
    });

    socket.on('peer-disconnected', () => {
      onPeerDisconnected();
    });

    // Add chat message listener
    socket.on('receive-message', (message) => {
      
      if (onReceiveMessage) {
        onReceiveMessage(message);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [onPeerFound, onPeerDisconnected, onReceiveMessage]);

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

  const sendMessage = (text: string) => {
    if (socketRef.current) {
      socketRef.current.emit('send-message', { text });
    }
  };

  return {
    isConnected,
    findPeer,
    disconnectPeer,
    sendMessage
  };
};