import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, Compass, HelpCircle } from 'lucide-react';
import { ChatMessage } from '../types';

interface AINoahChatProps {
  onTriggerResultPage: () => void;
}

export default function AINoahChat({ onTriggerResultPage }: AINoahChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '안녕, 찾아와 줘서 고마워. 난 여기 늘 머무르는 편안한 고민 상담가 승환이야. 😉\n오늘 마음 복잡한 일이나, 남들에겐 꺼내놓기 힘든 속상함이 있었다면 편하게 털어놔 봐. 가만히 경청하고 네 마음에 따뜻한 온기가 스밀 수 있도록 차분하게 들어줄게. 언제든 네 곁에 있을 테니까 너무 걱정하지 마.',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    // User message
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // If matches exactly "결과 보여줘" or similar local triggers
    if (trimmed === "결과 보여줘" || trimmed.includes("결과 보여줘")) {
      setTimeout(() => {
        // Automatically route to Tab 2
        onTriggerResultPage();
        const autoReply: ChatMessage = {
          id: Math.random().toString(),
          role: 'assistant',
          content: '알겠어. 지정한 활성화 구문이 인식되었어. 소통 쉼터의 비공개 관리 전용 채널에 연결해 줄게. 아래 발판을 활용해도 좋아.',
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          pillar: '[자기이해 및 자아상]'
        };
        setMessages(prev => [...prev, autoReply]);
        setLoading(false);
      }, 800);
      return;
    }

    try {
      // Map prior messages into correct history shape for Express
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history })
      });

      const data = await res.json();
      
      // Separate pillar classification if appended in brackets e.g. [자기이해 및 자아상]
      let replyContent = data.reply || '미안, 잠시 멍을 때렸네... 다시 말해줄래? [자기이해 및 자아상]';
      let detectedPillar = undefined;
      
      const pillarRegex = /\[([^\]]+)\]$/;
      const match = replyContent.match(pillarRegex);
      if (match) {
        detectedPillar = `[${match[1]}]`;
        replyContent = replyContent.replace(pillarRegex, '').trim();
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        pillar: detectedPillar
      };

      setMessages(prev => [...prev, assistantMsg]);

      // If backend marks triggerResult
      if (data.triggerResult) {
        setTimeout(() => {
          onTriggerResultPage();
        }, 1100);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev, 
        {
          id: Math.random().toString(),
          role: 'assistant',
          content: '아이고 무안해라.. 인터넷 신호가 어른어른하네! 형/누나한테 다시 한 번만 똑바로 얘기해 줄래?',
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          pillar: '[힘들고 우울한 마음]'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const sampleScenarios = [
    { title: "💤 피로와 아침 잠 걱정", text: "요새 매일 늦게 자서 아침에 등교할 때 너무 피곤하고 무기력해. 개운하게 일어나는 형만의 꿀팁 있을까?" },
    { title: "🤝 친구 관계 오해 풀기", text: "친한 친구랑 어제 사소한 오해로 약간 어색해졌어. 먼저 자연스럽게 말을 건네며 풀고 싶은데 대충 어케 운을 떼지?" },
    { title: "🎨 내 진로와 꿈에 대하여", text: "막상 공부하려니 집중이 잘 안 되고 내 진짜 적성이 뭔지 깊은 회의감이 들어. 자아 성찰 중이야." }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[640px] bg-slate-900/50 rounded-2xl border border-slate-800/80 overflow-hidden backdrop-blur-md">
      {/* Sidebar: Recommended Prompt scenarios */}
      <div className="w-full lg:w-80 bg-slate-950/45 p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Compass className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 font-display">추천 소통 생각거리</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            아래 평범한 고민 주제 예시를 가볍게 터치해 보세요. 마음 멘토 승환이가 조용히 경청하고 가슴 따뜻한 차분한 조언을 건네 드립니다.
          </p>
          
          <div className="space-y-3">
            {sampleScenarios.map((scen, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInput(scen.text);
                  handleSend(scen.text);
                }}
                disabled={loading}
                className="w-full text-left p-3 rounded-xl border text-xs transition-all duration-200 cursor-pointer bg-slate-900/70 border-slate-800/60 hover:bg-slate-800 text-slate-300 hover:scale-[1.01]"
              >
                <div className="font-bold flex items-center justify-between mb-1">
                  <span>{scen.title}</span>
                  <Sparkles className="w-3.5 h-3.5 text-slate-500 opacity-80" />
                </div>
                <p className="text-slate-400 line-clamp-2 leading-relaxed">{scen.text}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-900 text-[11px] text-slate-500 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
          <span>차분하고 아늑한 일상 소통 쉼터</span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col bg-slate-950/20">
        {/* Header bar */}
        <div className="p-4 px-6 border-b border-slate-800/50 bg-slate-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-900 shadow-md">
                승환
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
                동네 멘토 이승환 <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              </div>
              <span className="text-xs text-slate-400">마음을 위로하는 차분한 경청 대화방</span>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-[11px] text-slate-300 flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-emerald-400" />
            실시간 소통 중
          </div>
        </div>

        {/* Message window */}
        <div 
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end gap-2 max-w-[85%]">
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-emerald-600/30 font-bold text-[11px] flex items-center justify-center text-emerald-300 border border-emerald-500/10 mb-1 flex-shrink-0">
                    S
                  </div>
                )}
                
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none shadow-sm shadow-emerald-500/10'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800/40 rounded-tl-none shadow-md'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {msg.content}
                </div>
                
                <span className="text-[10px] text-slate-500 mb-1 flex-shrink-0">
                  {msg.timestamp}
                </span>
              </div>

              {/* Optional classification pillar */}
              {msg.pillar && (
                <div className="text-[10px] mt-1 text-teal-400 font-mono flex items-center gap-1.5 pl-9">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400/95 animate-ping" />
                  <span>공감 탐지 기둥: {msg.pillar}</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 pl-9">
              <div className="flex space-x-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-500 font-medium">승환이가 조용히 생각을 정리하는 중...</span>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="p-4 bg-slate-900/35 border-t border-slate-800/60 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={loading}
            placeholder={loading ? "글을 다듬는 중..." : "오늘 마주한 너의 속상함, 혹은 가만히 들려주고 싶은 매일의 일상을 편하게 남겨줘."}
            className="flex-1 bg-slate-950/80 text-sm border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 focus:border-emerald-500/80 transition-all"
            id="chat-input"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            id="chat-send-btn"
          >
            <span>전송</span>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
