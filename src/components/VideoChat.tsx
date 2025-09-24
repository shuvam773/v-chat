import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Users, Wifi, WifiOff, RotateCcw, Copyright } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import ServerStatus from './ServerStatus';

const VideoChat: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<'idle' | 'searching' | 'connecting' | 'connected'>('idle');
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const {
    localStream,
    remoteStream,
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
    connectionStatus,
    switchCamera
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

  const handleSwitchCamera = async () => {
    try {
      await switchCamera();
      setIsFrontCamera(!isFrontCamera);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
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
    <div className="min-h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - Compact */}
      <header className="p-3 lg:p-4 backdrop-blur-sm bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <Users className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">VideoConnect</h1>
          </div>

          <div className="flex items-center space-x-3 lg:space-x-4 text-xs lg:text-sm">
            <ServerStatus />
            <div className={`flex items-center space-x-1 px-2 lg:px-3 py-1 rounded-full ${socketConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
              {socketConnected ? <Wifi className="w-3 h-3 lg:w-4 lg:h-4" /> : <WifiOff className="w-3 h-3 lg:w-4 lg:h-4" />}
              <span>{socketConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Video Container - 4:3 ratio, no scrolling */}
      <div className="flex-1 flex items-center justify-center p-3 lg:p-4 relative overflow-hidden">

        {/* Connection Status Overlay */}
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900">
            <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-white/10 max-w-md mx-4">
              <div className="mb-4">
                {connectionState === 'searching' && (
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
                )}
                <Users className="w-10 h-10 lg:w-12 lg:h-12 text-green-400 mx-auto mb-4" />
              </div>
              <h2 className="text-lg lg:text-xl font-semibold text-white mb-2">
                {connectionState === 'searching' ? 'Finding a Partner...' : 'Ready to Connect'}
              </h2>
              <p className="text-gray-300 text-sm lg:text-base mb-4">{getStatusText()}</p>

              {connectionState === 'idle' && (
                <button
                  onClick={handleStartCall}
                  disabled={!socketConnected}
                  className="px-6 py-2 lg:px-8 lg:py-3 rounded-full transition-all flex items-center space-x-2 font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white mx-auto text-sm lg:text-base"
                >
                  <Phone className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span>Start Random Chat</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video Grid - 4:3 ratio containers */}
        <div className={`w-full h-full max-w-6xl flex items-center justify-center ${remoteStream
            ? 'grid grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1 gap-3 lg:gap-4'
            : 'flex'
          }`}>

          {/* Remote Video - Top on mobile, Left on desktop */}
          <div className={`relative bg-black rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500/30 ${remoteStream ? 'aspect-[4/3] w-full h-full' : 'hidden'
            }`}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Remote Video Label */}
            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
              <p className="text-white text-sm font-medium">Partner</p>
            </div>

            {/* Connection Status */}
            {connectionState === 'connected' && (
              <div className="absolute top-3 right-3 bg-green-500/20 backdrop-blur-sm rounded-full px-3 py-1">
                <p className="text-green-400 text-sm font-medium">Live</p>
              </div>
            )}
          </div>

          {/* Local Video - Bottom on mobile, Right on desktop */}
          <div className={`relative bg-black rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border-2 border-blue-500/30 ${remoteStream ? 'aspect-[4/3] w-full h-full' : 'aspect-[4/3] w-full max-w-md'
            }`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: isFrontCamera ? 'scaleX(-1)' : 'scaleX(1)' }}
            />

            {/* Video Off Overlay */}
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
                <div className="text-center">
                  <VideoOff className="w-8 h-8 lg:w-12 lg:h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Camera Off</p>
                </div>
              </div>
            )}

            {/* Local Video Label */}
            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
              <p className="text-white text-sm font-medium">You</p>
            </div>

            {/* Audio Status */}
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-2">
              {isAudioEnabled ? (
                <Mic className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" />
              )}
            </div>

            {/* Camera Rotate Button */}
            {isVideoEnabled && (
              <button
                onClick={handleSwitchCamera}
                className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition-all"
                title="Switch Camera"
              >
                <RotateCcw className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </button>
            )}
          </div>

          {/* Single Video View when not connected */}
          {!remoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-gray-400 text-lg mb-2">Your Camera Preview</p>
              <p className="text-gray-500 text-sm">Start a call to see your partner's video</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls - Fixed at bottom */}
      <div className="p-3 lg:p-4 backdrop-blur-sm bg-black/30 border-t border-white/10">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-3 lg:space-x-4">

            {/* Audio Toggle */}
            <button
              onClick={handleToggleAudio}
              className={`p-3 lg:p-4 rounded-xl transition-all duration-200 transform hover:scale-105 ${isAudioEnabled
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
                } backdrop-blur-sm border border-white/10`}
            >
              {isAudioEnabled ? (
                <Mic className="w-5 h-5 lg:w-6 lg:h-6" />
              ) : (
                <MicOff className="w-5 h-5 lg:w-6 lg:h-6" />
              )}
            </button>

            {/* Call Control */}
            {connectionState === 'idle' || connectionState === 'searching' ? (
              <button
                onClick={handleStartCall}
                disabled={!socketConnected || connectionState === 'searching'}
                className="px-6 py-3 lg:px-8 lg:py-4 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white shadow-lg text-sm lg:text-base"
              >
                {connectionState === 'searching' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 lg:h-5 lg:w-5 border-t-2 border-b-2 border-white"></div>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5 lg:w-6 lg:h-6" />
                    <span>Start Call</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                className="px-6 py-3 lg:px-8 lg:py-4 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 font-semibold bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-lg text-sm lg:text-base"
              >
                <PhoneOff className="w-5 h-5 lg:w-6 lg:h-6" />
                <span>End Call</span>
              </button>
            )}

            {/* Video Toggle */}
            <button
              onClick={handleToggleVideo}
              className={`p-3 lg:p-4 rounded-xl transition-all duration-200 transform hover:scale-105 ${isVideoEnabled
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
                } backdrop-blur-sm border border-white/10`}
            >
              {isVideoEnabled ? (
                <Video className="w-5 h-5 lg:w-6 lg:h-6" />
              ) : (
                <VideoOff className="w-5 h-5 lg:w-6 lg:h-6" />
              )}
            </button>
          </div>

          {/* Status Text */}
          <div className="text-center mt-2 lg:mt-3">
            <p className="text-gray-300 text-xs lg:text-sm">
              {connectionState === 'connected' ? (
                <span>Connected securely via WebRTC <Copyright /> Shuvam Kumar</span>
              ) : (
                getStatusText()
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;