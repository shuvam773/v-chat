import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Users, Wifi, WifiOff, Tv, RefreshCw, MessageCircle, X, Send } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSocket } from '../hooks/useSocket';
import ServerStatus from './ServerStatus';
import ChatButton from './ChatButton';

// Chat message interface
interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  type: 'text' | 'system';
}

const VideoChat: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<'idle' | 'searching' | 'connecting' | 'connected'>('idle');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const {
    localStream,
    remoteStream,
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
    connectionStatus
  } = useWebRTC(localVideoRef, remoteVideoRef);

  // Handle incoming chat messages
  const handleReceiveMessage = useCallback((message: ChatMessage) => {

    setChatMessages(prev => {
      const messageExists = prev.some(msg => 
        msg.id === message.id || 
        (msg.text === message.text && Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000)
      );
      
      if (!messageExists) {
        return [...prev, message];
      }
      return prev;
    });
  }, []);

  const onPeerDisconnected = useCallback(() => {
    setConnectionState("idle");
    endCall();

    // Add system message when peer disconnects
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      from: 'system',
      text: 'Peer disconnected',
      timestamp: new Date().toISOString(),
      type: 'system'
    }]);

    // Only auto-reconnect if the feature is enabled
    if (autoReconnect) {
      setTimeout(() => {
        if (socketConnectedRef.current) {
          setConnectionState("searching");
          findPeerRef.current();
        }
      }, 1000);
    }
  }, [endCall, autoReconnect]);

  // Store refs to avoid "used before declaration" error
  const socketConnectedRef = useRef(false);
  const findPeerRef = useRef(() => { });
  const sendMessageRef = useRef((text: string) => {});
  const pendingMessageIdRef = useRef<string | null>(null);

  // Initialize useSocket with chat handler
  const {
    isConnected: socketConnected,
    findPeer,
    disconnectPeer,
    sendMessage
  } = useSocket({
    onPeerFound: startCall,
    onPeerDisconnected,
    onReceiveMessage: handleReceiveMessage
  });

  useEffect(() => {
    socketConnectedRef.current = socketConnected;
    findPeerRef.current = findPeer;
    sendMessageRef.current = sendMessage;
  }, [socketConnected, findPeer, sendMessage]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Clear chat when peer disconnects
  useEffect(() => {
    if (connectionState === 'idle') {
      setChatMessages([]);
      pendingMessageIdRef.current = null;
    }
  }, [connectionState]);

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
    
    // Add system message when starting call
    setChatMessages([{
      id: Date.now().toString(),
      from: 'system',
      text: 'Hey whats up...',
      timestamp: new Date().toISOString(),
      type: 'system'
    }]);
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

  const handleToggleAutoReconnect = () => {
    setAutoReconnect(prev => !prev);
  };

  const handleToggleChat = () => {
    setIsChatOpen(prev => !prev);
    // Focus input when chat opens
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    }, 100);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !sendMessageRef.current) return;

    // Generate a unique ID for this message
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    pendingMessageIdRef.current = messageId;

    // Create temporary message for immediate UI update
    const tempMessage: ChatMessage = {
      id: messageId,
      from: window.socketInstance?.id || 'me',
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // Add message immediately to UI (ONLY ONCE)
    setChatMessages(prev => {
      // Check if message already exists to prevent duplicates
      const messageExists = prev.some(msg => msg.id === messageId);
      if (!messageExists) {
        return [...prev, tempMessage];
      }
      return prev;
    });
    
    // Send message via socket
    sendMessageRef.current(newMessage.trim());
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  // Check if message is from current user
  const isMyMessage = (message: ChatMessage) => {
    return message.from === window.socketInstance?.id || message.from === 'me';
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - Compact */}
      <header className="p-3 lg:p-4 backdrop-blur-sm bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-400 to-blue-500 rounded-full blur opacity-75 animate-pulse"></div>
              <div className="relative p-3 bg-gray-900 rounded-full border-2 border-green-400/50">
                <Tv className="w-5 h-5 lg:w-6 lg:h-6 text-green-400" />
              </div>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">
              <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                VChat
              </span>
            </h1>
          </div>

          <div className="flex items-center space-x-3 lg:space-x-4 text-xs lg:text-sm">
            <ServerStatus />

            {/* Auto Reconnect Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleAutoReconnect}
                className="flex items-center space-x-2 focus:outline-none group"
                title={autoReconnect ? "Auto-reconnect enabled" : "Auto-reconnect disabled"}
              >
                <RefreshCw className={`w-3 h-3 lg:w-4 lg:h-4 ${autoReconnect ? 'text-green-400 animate-spin' : 'text-gray-400'
                  }`} />
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ${autoReconnect ? 'bg-green-500' : 'bg-gray-600'
                  }`}>
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-300 ${autoReconnect ? 'translate-x-4' : 'translate-x-1'
                      }`}
                  />
                </div>
              </button>
            </div>

            <div className={`flex items-center space-x-1 px-2 lg:px-3 py-1 rounded-full ${socketConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
              {socketConnected ? <Wifi className="w-3 h-3 lg:w-4 lg:h-4" /> : <WifiOff className="w-3 h-3 lg:w-4 lg:h-4" />}
              <span>{socketConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Video Container */}
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

        {/* Video Grid */}
        <div className={`w-full h-full max-w-6xl flex items-center justify-center ${remoteStream
          ? 'grid grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1 gap-3 lg:gap-4'
          : 'flex'
          }`}>

          {/* Remote Video */}
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

          {/* Local Video */}
          <div className={`relative bg-black rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border-2 border-blue-500/30 ${remoteStream ? 'aspect-[4/3] w-full h-full' : 'aspect-[4/3] w-full max-w-md'
            }`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
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
              className={`p-3 lg:p-4 rounded-xl transition-all duration-200 transform hover:scale-105 ${
                isAudioEnabled
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
              className={`p-3 lg:p-4 rounded-xl transition-all duration-200 transform hover:scale-105 ${
                isVideoEnabled
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

            {/* Chat Button - Placed to the right of video toggle */}
            <ChatButton
              isChatOpen={isChatOpen}
              onToggleChat={handleToggleChat}
              chatMessages={chatMessages}
              connectionState={connectionState}
              newMessage={newMessage}
              onNewMessageChange={setNewMessage}
              onSendMessage={handleSendMessage}
              chatInputRef={chatInputRef}
              chatMessagesRef={chatMessagesRef}
              onKeyPress={handleKeyPress}
              isMyMessage={isMyMessage}
              formatTime={formatTime}
            />
          </div>

          {/* Status Text */}
          <div className="text-center mt-2 lg:mt-3">
            <p className="text-gray-300 text-xs lg:text-sm">
              {connectionState === 'connected' ? 'Connected securely via WebRTC © Shuvam Kumar' : getStatusText()}
            </p>
            {connectionState === 'idle' && (
              <p className="text-gray-400 text-xs mt-1">
                Auto-reconnect: {autoReconnect ? 'Enabled' : 'Disabled'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;