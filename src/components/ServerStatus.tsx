import React, { useState, useEffect } from 'react';

interface ServerStatus {
  waitingUsers: number;
  activeConnections: number;
  totalRooms: number;
  uptime: number;
}

const ServerStatus: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const socketUrl = 'https://v-chat-qdyg.onrender.com';
        const response = await fetch(`${socketUrl}/status`);
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch server status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-xs text-gray-400">
        Loading server status...
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-xs text-red-400">
        Server status unavailable
      </div>
    );
  }

  return (
    <div className="text-xs text-gray-400 space-y-1">
      <div>Waiting: {status.waitingUsers}</div>
      <div>Active: {status.activeConnections}</div>
      {/* <div>Rooms: {status.totalRooms}</div> */}
    </div>
  );
};

export default ServerStatus;
