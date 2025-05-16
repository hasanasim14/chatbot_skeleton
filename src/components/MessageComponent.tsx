"use client";

import React, { useState, useRef, useEffect, memo, useCallback } from "react";
import type { Components } from "react-markdown";
import { Send } from "lucide-react";
import debounce from "lodash.debounce";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
};

const YouTubeEmbed = memo(function YouTubeEmbed({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  let videoId = "";
  if (href.includes("v=")) {
    videoId = href.split("v=")[1].split("&")[0];
  } else if (href.includes("youtu.be")) {
    videoId = href.split("youtu.be/")[1].split("?")[0];
  }

  if (!videoId) return null;

  return (
    <div className="video-embed my-6">
      <div className="aspect-w-16 aspect-h-9">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
          className="w-full h-[400px] rounded-lg"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          key={`yt-embed-${videoId}`}
          title={`YouTube video ${videoId}`}
          frameBorder="0"
        />
      </div>
      {children && <p className="text-center text-sm mt-2">{children}</p>}
    </div>
  );
});

const MessageComponent = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState("");

  const markdownComponents: Components = React.useMemo(() => {
    return {
      a: ({ href, children, ...props }) => {
        if (
          href &&
          (href.includes("youtube.com/watch") || href.includes("youtu.be"))
        ) {
          return <YouTubeEmbed href={href}>{children}</YouTubeEmbed>;
        }

        if (href && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(href)) {
          return (
            <div className="image-container my-6">
              <img
                src={href}
                alt={typeof children === "string" ? children : ""}
                className="max-w-[50%] h-auto rounded-lg mx-auto transition-transform duration-300 transform hover:scale-105 cursor-pointer"
                onClick={() => setFullscreenImage(href)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/fallback-image.jpg";
                }}
              />
            </div>
          );
        }

        return (
          <a
            href={href}
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        );
      },

      img: ({ src, alt, ...props }) => (
        <div className="my-4">
          <img
            src={src}
            alt={alt || ""}
            className="max-w-full h-auto rounded-lg mx-auto transition-transform duration-300 transform hover:scale-105 cursor-pointer"
            onClick={() => setFullscreenImage(String(src || ""))}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/fallback-image.jpg";
            }}
            {...props}
          />
          {alt && <p className="text-center text-sm mt-2">{alt}</p>}
        </div>
      ),

      h1: (props) => <h1 className="text-3xl font-bold my-0" {...props} />,
      h2: (props) => <h2 className="text-2xl font-bold my-0" {...props} />,
      h3: (props) => <h3 className="text-xl font-bold my-0" {...props} />,

      pre: (props) => (
        <pre
          className="bg-gray-100 p-0 rounded-lg my-1 overflow-x-auto text-sm"
          {...props}
        />
      ),
      code: (props) => (
        <code
          className="bg-gray-100 rounded px-2 py-1 font-mono text-sm"
          {...props}
        />
      ),

      strong: (props) => <strong className="font-semibold" {...props} />,
      em: (props) => <em className="italic" {...props} />,
      blockquote: (props) => (
        <blockquote
          className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-600"
          {...props}
        />
      ),
      hr: (props) => <hr className="my-6 border-gray-200" {...props} />,
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
          className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-3xl rounded-lg px-4 py-3 ${
              message.isUser
                ? "bg-[#564673] text-white"
                : "bg-white text-gray-800 border border-gray-200"
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
    <div className="min-h-screen bg-[#eaeaea] flex flex-col">
      <header className="bg-gradient-to-r from-[#564673] to-[#56a9c8] shadow-md py-4 px-6 sticky top-0 z-50">
        <div className="container mx-auto">
          <h1 className="font-semibold text-xl text-white">Bonfire</h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 pb-24 overflow-y-auto">
        <div className="max-w-xl mx-auto">
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-xs rounded-lg px-4 py-3 bg-white text-gray-800 border border-gray-200">
                  <div className="flex space-x-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div
                      className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
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

      <div className="fixed bottom-0 left-0 right-0 bg-transparent px-4 pb-4 flex justify-center">
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-xl shadow-lg p-1 border border-gray-200">
            <div className="flex items-end">
              <textarea
                ref={inputRef}
                placeholder="Type your message..."
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none w-full text-sm resize-none max-h-32 p-3"
                disabled={isLoading}
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className={`mr-2 p-3 rounded-full ${
                  isLoading || !inputMessage.trim()
                    ? "text-gray-400"
                    : "text-white bg-[#564673] hover:bg-[#3d3557] transition-colors"
                }`}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            src={fullscreenImage}
            alt="Fullscreen"
            className="max-w-[90%] max-h-[90%] rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
};

export default MessageComponent;
