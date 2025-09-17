import React, { useState, useRef } from 'react';
import { PaperClipIcon, FaceSmileIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import EmojiPicker from 'emoji-picker-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  channelName: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  channelName,
  onTyping,
  onStopTyping,
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
      handleStopTyping();
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping?.();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      onStopTyping?.();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      handleTyping();
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  return (
    <div className="px-4 pb-4">
      <div className="relative">
        <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:border-slack-active focus-within:ring-1 focus-within:ring-slack-active">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyPress}
            placeholder={`Message #${channelName}`}
            className="w-full px-3 py-2 resize-none focus:outline-none"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
            <div className="flex items-center space-x-2">
              <button className="p-1 hover:bg-gray-200 rounded">
                <PaperClipIcon className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                className="p-1 hover:bg-gray-200 rounded"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <FaceSmileIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="inline-flex items-center px-3 py-1 bg-slack-green text-white rounded-md hover:bg-slack-greenHover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-4 h-4 mr-1" />
              Send
            </button>
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-full mb-2 right-0 z-10">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              height={350}
              width={300}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
