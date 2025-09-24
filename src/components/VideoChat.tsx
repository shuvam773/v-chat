import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';

interface VideoChatProps {}

const VideoChat: React.FC<VideoChatProps> = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<'idle' | 'searching' | 'connecting' | 'connected'>('idle');

  const { 
    localStream, 
    remoteStream, 
    startCall, 
    endCall, 
    toggleVideo, 
    toggleAudio,
    connectionStatus 
  } = useWebRTC(localVideoRef, remoteVideoRef);

  const { 
    isConnected: socketConnected, 
    findPeer, 
    disconnectPeer 
  } = useSocket(startCall, () => {
    setConnectionState('idle');
    endCall();
  });

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    setConnectionState(connectionStatus);
  }, [connectionStatus]);

  const handleStartCall = async () => {
    if (!socketConnected) return;
    setConnectionState('searching');
    findPeer();
  };

  const handleEndCall = () => {
    setConnectionState('idle');
    disconnectPeer();
    endCall();
  };

  const handleToggleVideo = () => {
    const newState = toggleVideo();
    setIsVideoEnabled(newState);
  };

  const handleToggleAudio = () => {
    const newState = toggleAudio();
    setIsAudioEnabled(newState);
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'searching':
        return 'Looking for someone to chat with...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      default:
        return 'Ready to start video chat';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'searching':
        return 'text-yellow-400';
      case 'connecting':
        return 'text-blue-400';
      case 'connected':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">VideoConnect</h1>
        <p className={`text-lg ${getStatusColor()}`}>{getStatusText()}</p>
      </header>

      {/* Video Container */}
      <div className="flex-1 relative px-6 pb-6">
        <div className="max-w-6xl mx-auto h-full">
          {/* Remote Video (Main) */}
          <div className="relative h-full bg-gray-800 rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-center">
                  {connectionState === 'searching' && (
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  )}
                  <p className="text-gray-300 text-lg">
                    {connectionState === 'idle' ? 'Click "Start" to begin' : 'Waiting for peer...'}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video (Picture-in-Picture) */}
            <div className="absolute top-4 right-4 w-64 h-48 bg-gray-900 rounded-xl overflow-hidden shadow-lg border-2 border-gray-700">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6">
        <div className="max-w-md gap-9 mx-auto">
          <div className="flex items-center justify-center space-x-4">
            {/* Audio Toggle */}
            <button
              onClick={handleToggleAudio}
              className={`p-4 rounded-full transition-all ${
                isAudioEnabled
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              disabled={connectionState === 'searching'}
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </button>

            {/* Main Call Button */}
            {connectionState === 'idle' ? (
              <button
                onClick={handleStartCall}
                disabled={!socketConnected}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-8 py-4 rounded-full transition-all flex items-center space-x-2 font-semibold"
              >
                <Phone className="w-6 h-6" />
                <span>Start</span>
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full transition-all flex items-center space-x-2 font-semibold"
              >
                <PhoneOff className="w-6 h-6" />
                <span>End</span>
              </button>
            )}

            {/* Video Toggle */}
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-full transition-all ${
                isVideoEnabled
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              disabled={connectionState === 'searching'}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* {!socketConnected && (
            <div className="mt-4 text-center">
              <p className="text-red-400">Connecting to server...</p>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
};

export default VideoChat;