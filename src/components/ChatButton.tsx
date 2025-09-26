import React from 'react';
import { MessageCircle, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  type: 'text' | 'system';
}

interface ChatButtonProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  chatMessages: ChatMessage[];
  connectionState: 'idle' | 'searching' | 'connecting' | 'connected';
  newMessage: string;
  onNewMessageChange: (message: string) => void;
  onSendMessage: () => void;
  chatInputRef: React.RefObject<HTMLInputElement>;
  chatMessagesRef: React.RefObject<HTMLDivElement>;
  onKeyPress: (e: React.KeyboardEvent) => void;
  isMyMessage: (message: ChatMessage) => boolean;
  formatTime: (timestamp: string) => string;
}

const ChatButton: React.FC<ChatButtonProps> = ({
  isChatOpen,
  onToggleChat,
  chatMessages,
  connectionState,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  chatInputRef,
  chatMessagesRef,
  onKeyPress,
  isMyMessage,
  formatTime
}) => {
  const unreadCount = chatMessages.filter(msg => msg.type === 'text').length;

  return (
    <>
      {/* Chat Button - Positioned next to video toggle */}
      {connectionState === 'connected' && (
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-xl transition-all duration-200 transform hover:scale-105 ${
            isChatOpen 
              ? 'bg-green-500 hover:bg-green-600 text-white' 
              : 'bg-gray-700/50 hover:bg-gray-600/50 text-white'
          } backdrop-blur-sm border border-white/10 relative`}
          title={isChatOpen ? "Close Chat" : "Open Chat"}
        >
          <MessageCircle className="w-5 h-5 lg:w-6 lg:h-6" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Modal */}
      {isChatOpen && connectionState === 'connected' && (
        <div className="absolute bottom-16 right-0 lg:right-auto lg:left-1/2 lg:transform lg:-translate-x-1/2 z-50 w-80 h-96 bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-semibold">Chat</h3>
            <button
              onClick={onToggleChat}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Chat Messages */}
          <div 
            ref={chatMessagesRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-8">
                No messages yet. Start a conversation!
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${
                    message.from === 'system' 
                      ? 'items-center'
                      : isMyMessage(message)
                        ? 'items-end' 
                        : 'items-start'
                  }`}
                >
                  <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl ${
                    message.type === 'system'
                      ? 'bg-yellow-500/20 text-yellow-300 text-xs italic'
                      : isMyMessage(message)
                        ? 'bg-green-500/20 text-white'
                        : 'bg-blue-500/20 text-white'
                  }`}>
                    <div className="text-sm">{message.text}</div>
                    <div className={`text-xs opacity-70 mt-1 ${
                      isMyMessage(message) ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex space-x-2">
              <input
                ref={chatInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => onNewMessageChange(e.target.value)}
                onKeyPress={onKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                disabled={connectionState !== 'connected'}
              />
              <button
                onClick={onSendMessage}
                disabled={!newMessage.trim() || connectionState !== 'connected'}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg p-2 transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatButton;