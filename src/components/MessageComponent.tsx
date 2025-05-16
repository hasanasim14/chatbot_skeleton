"use client";

import React, { useState, useRef, useEffect, memo, useCallback } from "react";
import type { Components } from "react-markdown";
import { Brain, Send } from "lucide-react";
import debounce from "lodash.debounce";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
};

const MessageComponent = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState("");

  const markdownComponents: Components = React.useMemo(() => {
    return {
      a: ({ href, children, ...props }) => (
        <a
          href={href}
          className="text-blue-400 hover:text-blue-300 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      ),
      h1: (props) => (
        <h1 className="text-3xl font-bold my-2 text-white" {...props} />
      ),
      h2: (props) => (
        <h2 className="text-2xl font-bold my-2 text-white" {...props} />
      ),
      h3: (props) => (
        <h3 className="text-xl font-bold my-2 text-white" {...props} />
      ),
      pre: (props) => (
        <pre
          className="bg-gray-800 p-4 rounded-lg my-3 overflow-x-auto text-sm text-gray-100"
          {...props}
        />
      ),
      code: (props) => (
        <code
          className="bg-gray-800 rounded px-2 py-1 font-mono text-sm text-gray-100"
          {...props}
        />
      ),
      strong: (props) => (
        <strong className="font-semibold text-white" {...props} />
      ),
      em: (props) => <em className="italic" {...props} />,
      blockquote: (props) => (
        <blockquote
          className="border-l-4 border-gray-500 pl-4 italic my-4 text-gray-300"
          {...props}
        />
      ),
      hr: (props) => <hr className="my-6 border-gray-700" {...props} />,
      p: (props) => <p className="my-2 text-gray-100" {...props} />,
      ul: (props) => (
        <ul className="list-disc pl-5 my-2 text-gray-100" {...props} />
      ),
      ol: (props) => (
        <ol className="list-decimal pl-5 my-2 text-gray-100" {...props} />
      ),
      li: (props) => <li className="my-1" {...props} />,
    };
  }, []);

  const cleanMarkdownContent = React.useCallback((content: string): string => {
    if (!content) return "";
    return content.replace(/\n{3,}/g, " ").trim();
  }, []);

  const ChatMessage = memo(
    function ChatMessage({ message }: { message: Message }) {
      return (
        <div
          className={`flex ${
            message.isUser ? "justify-end" : "justify-start"
          } my-2`}
        >
          <div
            className={`max-w-3xl rounded-2xl px-4 py-3 ${
              message.isUser
                ? "bg-blue-500 text-white"
                : "bg-[#303030] text-gray-100"
            }`}
          >
            <ReactMarkdown components={markdownComponents}>
              {cleanMarkdownContent(message.content)}
            </ReactMarkdown>
          </div>
        </div>
      );
    },
    (prevProps, nextProps) => {
      return (
        prevProps.message.id === nextProps.message.id &&
        prevProps.message.content === nextProps.message.content &&
        prevProps.message.isUser === nextProps.message.isUser
      );
    }
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    debounce(async () => {
      const currentMessage = inputMessage.trim();
      if (!currentMessage || isLoading) return;

      // Add user message immediately
      const userMessage = {
        id: Date.now().toString(),
        content: currentMessage,
        isUser: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputMessage("");
      setIsLoading(true);

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: currentMessage,
            sessionid: sessionId,
          }),
        });

        if (!res.ok)
          throw new Error(`API responded with status: ${res.status}`);

        const data = await res.json();
        setSessionId(data?.data?.session_id || "");

        const assistantMessage = {
          id: Date.now().toString(),
          content: data.data?.Message || "I couldn't process that request.",
          isUser: false,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("API Error:", error);
        const errorMessage = {
          id: Date.now().toString(),
          content: "Sorry, there was an error processing your request.",
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [inputMessage, isLoading, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-[#212121] flex flex-col">
      <header className="sticky top-0 z-50 bg-[#212121] border-b border-gray-900 shadow-md">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 cursor-pointer transition-transform hover:scale-105">
            <Brain className="text-white w-6 h-6" />
            <h1 className="text-white text-2xl font-bold tracking-wide">
              Aiva
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 pb-24 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <h2 className="text-2xl font-bold text-gray-300 mb-2">
                  Welcome to Aiva
                </h2>
                <p className="text-gray-400 max-w-md">
                  Ask me anything and I&apos;ll do my best to help you out.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {/* For the loading indicator, update to match your theme: */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-xs rounded-lg px-4 py-3 bg-[#303030] border border-gray-700">
                  <div className="flex space-x-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div
                      className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 rounded-full bg-gray-600 animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-[#212121] backdrop-blur-sm px-4 pb-6 pt-2 border-t border-gray-800">
        <div className="w-full max-w-3xl mx-auto">
          <div className="bg-[#303030] rounded-xl p-1 border border-gray-800">
            <div className="flex items-end">
              <textarea
                ref={inputRef}
                placeholder="Ask Aiva..."
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none w-full text-gray-100 placeholder-gray-400 resize-none max-h-32 p-3 focus:ring-0"
                disabled={isLoading}
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className={`mr-2 mb-2 p-2 rounded-full transition-colors ${
                  isLoading || !inputMessage.trim()
                    ? "text-gray-500 cursor-not-allowed"
                    : "text-gray-300 hover:text-white hover:bg-gray-700 active:bg-gray-600"
                }`}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageComponent;
