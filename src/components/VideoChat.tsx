import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Users, Wifi, WifiOff } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import ServerStatus from './ServerStatus';

const VideoChat: React.FC = () => {
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

  // Sync local state with actual track states
  useEffect(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];
      
      if (videoTrack) {
        setIsVideoEnabled(videoTrack.enabled);
      }
      if (audioTrack) {
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 flex flex-col">
      {/* Header */}
      <header className="p-4 lg:p-6 text-center backdrop-blur-sm bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">VideoConnect</h1>
          </div>
          
          <div className="flex items-center space-x-4 text-sm">
            <ServerStatus />
            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
              socketConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {socketConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>{socketConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Video Container */}
      <div className="flex-1 relative p-4 lg:p-6">
        <div className="h-full w-full max-w-7xl mx-auto">
          {/* Connection Status Overlay */}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-8 lg:p-12 border border-white/10">
                <div className="mb-4">
                  {connectionState === 'searching' && (
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  )}
                  <Users className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                </div>
                <h2 className="text-xl lg:text-2xl font-semibold text-white mb-2">
                  {connectionState === 'searching' ? 'Finding a Partner...' : 'Ready to Connect'}
                </h2>
                <p className="text-gray-300 max-w-md">{getStatusText()}</p>
                
                {connectionState === 'idle' && (
                  <button
                    onClick={handleStartCall}
                    disabled={!socketConnected}
                    className="mt-6 px-8 py-3 rounded-full transition-all flex items-center space-x-2 font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white mx-auto"
                  >
                    <Phone className="w-5 h-5" />
                    <span>Start Random Chat</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Video Grid */}
          <div className={`h-full grid gap-4 lg:gap-6 ${
            remoteStream 
              ? 'grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1' 
              : 'grid-cols-1'
          }`}>
            
            {/* Local Video - Shows as main on mobile when connected, small on desktop */}
            <div className={`relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-300 ${
              remoteStream 
                ? 'border-blue-500/50 lg:border-gray-700 order-2 lg:order-1' 
                : 'border-gray-700 order-1'
            }`}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Flip horizontally for correct orientation
              />
              
              {/* Video Off Overlay */}
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
                  <div className="text-center">
                    <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Camera Off</p>
                  </div>
                </div>
              )}
              
              {/* Local Video Label */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                <p className="text-white text-sm font-medium">You</p>
              </div>
              
              {/* Audio Status */}
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full p-2">
                {isAudioEnabled ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>

            {/* Remote Video - Shows as main on mobile when connected */}
            <div className={`relative bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all duration-300 ${
              remoteStream 
                ? 'border-purple-500/50 lg:border-gray-700 order-1 lg:order-2' 
                : 'hidden'
            }`}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Remote Video Label */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                <p className="text-white text-sm font-medium">Partner</p>
              </div>
              
              {/* Connection Status */}
              {connectionState === 'connected' && (
                <div className="absolute top-4 right-4 bg-green-500/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <p className="text-green-400 text-sm font-medium">Live</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 lg:p-6 backdrop-blur-sm bg-black/20 border-t border-white/10">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-4 lg:space-x-6">
            
            {/* Audio Toggle */}
            <button
              onClick={handleToggleAudio}
              className={`p-4 rounded-2xl transition-all duration-200 transform hover:scale-105 ${
                isAudioEnabled 
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              } backdrop-blur-sm border border-white/10`}
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6 lg:w-7 lg:h-7" />
              ) : (
                <MicOff className="w-6 h-6 lg:w-7 lg:h-7" />
              )}
            </button>

            {/* Call Control */}
            {connectionState === 'idle' || connectionState === 'searching' ? (
              <button
                onClick={handleStartCall}
                disabled={!socketConnected || connectionState === 'searching'}
                className="px-8 py-4 rounded-2xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-3 font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white shadow-lg"
              >
                {connectionState === 'searching' ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-6 h-6" />
                    <span>Start Call</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="px-8 py-4 rounded-2xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-3 font-semibold bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-lg"
              >
                <PhoneOff className="w-6 h-6" />
                <span>End Call</span>
              </button>
            )}

            {/* Video Toggle */}
            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-2xl transition-all duration-200 transform hover:scale-105 ${
                isVideoEnabled 
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              } backdrop-blur-sm border border-white/10`}
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6 lg:w-7 lg:h-7" />
              ) : (
                <VideoOff className="w-6 h-6 lg:w-7 lg:h-7" />
              )}
            </button>
          </div>
          
          {/* Status Text */}
          <div className="text-center mt-4">
            <p className="text-gray-300 text-sm">
              {connectionState === 'connected' ? 'Connected securely via WebRTC' : getStatusText()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;