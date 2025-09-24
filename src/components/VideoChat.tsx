import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  const onPeerDisconnected = useCallback(() => {
    setConnectionState('idle');
    endCall();
  }, [endCall]);

  const { 
    isConnected: socketConnected, 
    findPeer, 
    disconnectPeer 
  } = useSocket(startCall, onPeerDisconnected);

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


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="p-4 text-center backdrop-blur-sm bg-black/30">
        <h1 className="text-2xl font-bold text-white">VideoConnect</h1>
      </header>

      {/* Video Container */}
      <div className="flex-1 relative p-4">
        <div className="relative h-full w-full max-w-6xl mx-auto">
          {/* Remote Video */}
          <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden shadow-2xl border border-gray-700">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  {connectionState === 'searching' && (
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  )}
                  <p className="text-gray-400">{getStatusText()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2 border-gray-600">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 backdrop-blur-sm bg-black/30">
        <div className="max-w-xs mx-auto">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={handleToggleAudio}
              className={`p-3 rounded-full transition-all ${
                isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
              } text-white disabled:opacity-50`}
              disabled={connectionState !== 'connected'}
            >
              {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>

            {connectionState === 'idle' || connectionState === 'searching' ? (
              <button
                onClick={handleStartCall}
                disabled={!socketConnected || connectionState === 'searching'}
                className="px-6 py-3 rounded-full transition-all flex items-center space-x-2 font-semibold bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white"
              >
                <Phone className="w-6 h-6" />
                <span>{connectionState === 'searching' ? 'Searching...' : 'Start'}</span>
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="px-6 py-3 rounded-full transition-all flex items-center space-x-2 font-semibold bg-red-500 hover:bg-red-600 text-white"
              >
                <PhoneOff className="w-6 h-6" />
                <span>Disconnect</span>
              </button>
            )}

            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded-full transition-all ${
                isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
              } text-white disabled:opacity-50`}
              disabled={connectionState !== 'connected'}
            >
              {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
