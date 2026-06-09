import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Sparkles, 
  Sliders, 
  ClipboardList, 
  MessageSquare, 
  CheckCircle2, 
  BarChart3, 
  AlertCircle,
  HelpCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  Trash2,
  Database
} from 'lucide-react';
import { StudentRecord } from './types';
import AINoahChat from './components/AINoahChat';
import StudentTrack from './components/StudentTrack';
import SchoolRecordTable from './components/SchoolRecordTable';
import CloudSyncSettings from './components/CloudSyncSettings';
import { 
  isFirebaseEnabled, 
  saveRecordsToCloud, 
  setupCloudSyncListener, 
  loadRecordsFromCloud 
} from './firebase';

export default function App() {
  // Navigation & Gate state
  const [activeTab, setActiveTab] = useState<'chat' | 'scores' | 'record'>('chat');
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  
  // Magic trigger animation message
  const [magicAlert, setMagicAlert] = useState<string | null>(null);

  // Student States (Default 31 students)
  const [scores, setScores] = useState<number[]>(Array(31).fill(50));
  const [opinions, setOpinions] = useState<string[]>(Array(31).fill(''));
  const [names, setNames] = useState<string[]>(Array.from({ length: 31 }, (_, i) => `${i + 1}번 학생`));
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);

  // Reset entire evaluation board back to default values
  const handleResetAll = async () => {
    const defaultScores = Array(31).fill(50);
    const defaultOpinions = Array(31).fill('');
    const defaultNames = Array.from({ length: 31 }, (_, i) => `${i + 1}번 학생`);
    
    setScores(defaultScores);
    setOpinions(defaultOpinions);
    setNames(defaultNames);
    
    await saveRecords(defaultScores, defaultOpinions, defaultNames);
    setShowResetConfirmModal(false);
  };

  // Load records on start, integrating cloud, API, and LocalStorage
  const fetchRecords = async () => {
    setLoading(true);
    try {
      // 1. Force state recovery from local browser immediately for zero latency
      const localScores = localStorage.getItem('noah_scores');
      const localOpinions = localStorage.getItem('noah_opinions');
      const localNames = localStorage.getItem('noah_names');
      const localUnlocked = localStorage.getItem('noah_unlocked');

      if (localScores) setScores(JSON.parse(localScores));
      if (localOpinions) setOpinions(JSON.parse(localOpinions));
      if (localNames) setNames(JSON.parse(localNames));
      if (localUnlocked) setUnlocked(localUnlocked === 'true');

      // 2. Try loading from Google Firebase Firestore if enabled
      if (isFirebaseEnabled()) {
        const cloudData = await loadRecordsFromCloud();
        if (cloudData) {
          setScores(cloudData.scores);
          setOpinions(cloudData.opinions);
          setNames(cloudData.names);
          
          localStorage.setItem('noah_scores', JSON.stringify(cloudData.scores));
          localStorage.setItem('noah_opinions', JSON.stringify(cloudData.opinions));
          localStorage.setItem('noah_names', JSON.stringify(cloudData.names));
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to full-stack Express API
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        
        let hasCustomServerData = false;
        if (data.opinions && data.opinions.some((o: string) => o !== "")) {
          hasCustomServerData = true;
        }
        if (data.scores && data.scores.some((s: number) => s !== 50)) {
          hasCustomServerData = true;
        }
        if (data.names && data.names.some((n: string, i: number) => n !== `${i + 1}번 학생`)) {
          hasCustomServerData = true;
        }

        if (hasCustomServerData) {
          // Sync state with custom backend values
          if (data.scores) {
            setScores(data.scores);
            localStorage.setItem('noah_scores', JSON.stringify(data.scores));
          }
          if (data.opinions) {
            setOpinions(data.opinions);
            localStorage.setItem('noah_opinions', JSON.stringify(data.opinions));
          }
          if (data.names) {
            setNames(data.names);
            localStorage.setItem('noah_names', JSON.stringify(data.names));
          }
        } else {
          // Sync server back to local state if server restarted fresh
          if (localScores || localOpinions || localNames) {
            const finalScores = localScores ? JSON.parse(localScores) : Array(31).fill(50);
            const finalOpinions = localOpinions ? JSON.parse(localOpinions) : Array(31).fill('');
            const finalNames = localNames ? JSON.parse(localNames) : Array.from({ length: 31 }, (_, i) => `${i + 1}번 학생`);
            
            fetch('/api/records', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scores: finalScores,
                opinions: finalOpinions,
                names: finalNames
              })
            }).catch(e => console.error("Auto sync to ephemeral server failed:", e));
          }
        }
      }
    } catch (err) {
      console.warn('Backend server unreachable or static deployment mode. Using localStorage:', err);
    } finally {
      setLoading(false);
    }
  };

  // Synchronise firebase state toggle reactive to configuration changes
  useEffect(() => {
    setCloudConnected(isFirebaseEnabled());
    fetchRecords();
  }, []);

  // Monitor Firebase live sync listener if cloud mode active
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    if (cloudConnected) {
      console.log("Setting up real-time live database sync listener...");
      unsubscribe = setupCloudSyncListener((data) => {
        setScores(data.scores);
        setOpinions(data.opinions);
        setNames(data.names);
        
        // Ensure local values are updated
        localStorage.setItem('noah_scores', JSON.stringify(data.scores));
        localStorage.setItem('noah_opinions', JSON.stringify(data.opinions));
        localStorage.setItem('noah_names', JSON.stringify(data.names));
      }) || null;
    }

    return () => {
      if (unsubscribe) {
        console.log("Cleaning up live database sync listener.");
        unsubscribe();
      }
    };
  }, [cloudConnected]);

  // Monitor unlocked state changes to persist unlock status in local browser
  useEffect(() => {
    localStorage.setItem('noah_unlocked', String(unlocked));
  }, [unlocked]);

  // Post records database to physical resources
  const saveRecords = async (updatedScores = scores, updatedOpinions = opinions, updatedNames = names) => {
    setSaving(true);
    
    // Always persist to localStorage immediately
    localStorage.setItem('noah_scores', JSON.stringify(updatedScores));
    localStorage.setItem('noah_opinions', JSON.stringify(updatedOpinions));
    localStorage.setItem('noah_names', JSON.stringify(updatedNames));

    // Try cloud write if active
    if (cloudConnected) {
      const ok = await saveRecordsToCloud(updatedScores, updatedOpinions, updatedNames);
      if (ok) {
        setSaving(false);
        return;
      }
    }

    // Otherwise fallback REST API save
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: updatedScores,
          opinions: updatedOpinions,
          names: updatedNames
        })
      });
      if (!res.ok) {
        throw new Error('Server response was not ok');
      }
    } catch (err) {
      console.log('Dual-mode save: API unsaved (standard for standalone client/static deployments like GitHub Pages/Vercel). Local storage preserved.', err);
    } finally {
      setSaving(false);
    }
  };

  // Updaters (local state and queue save)
  const handleScoreChange = (index: number, newScore: number) => {
    const nextScores = [...scores];
    nextScores[index] = newScore;
    setScores(nextScores);
    // Debounced or direct call onPointerUp, see StudentTrack's onSave property
  };

  const handleOpinionChange = (index: number, val: string) => {
    const nextOpinions = [...opinions];
    nextOpinions[index] = val;
    setOpinions(nextOpinions);
    // Instant save trigger handled inside SchoolRecordTable via debounced or bulk save trigger
  };

  const handleNameChange = (index: number, val: string) => {
    const nextNames = [...names];
    nextNames[index] = val;
    setNames(nextNames);
  };

  const handleBulkSave = async () => {
    await saveRecords(scores, opinions, names);
  };

  // Track password door submit (PASSWORD: 960309)
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '960309') {
      setUnlocked(true);
      setShowUnlockModal(false);
      setPasswordError('');
      setPasswordInput('');
      setActiveTab('scores'); // Navigate straight into score board
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다. 다시 입력해 주세요.');
    }
  };

  // AI bypass command "결과 보여줘"
  const handleAITriggerResultPage = () => {
    if (!unlocked) {
      setUnlocked(true);
      setMagicAlert('🔑 [시스템 승인] "결과 보여줘" 기능이 작동하여 심층 관리 공간이 개방되었습니다.');
      setTimeout(() => {
        setMagicAlert(null);
      }, 5500);
    }
    setActiveTab('scores');
  };

  const handleTabClick = (tab: 'chat' | 'scores' | 'record') => {
    if (tab === 'chat') {
      setActiveTab('chat');
    } else {
      if (unlocked) {
        setActiveTab(tab);
      } else {
        setShowUnlockModal(true);
      }
    }
  };

  // Statistics summaries
  const countSpace = scores.filter(s => s >= 67).length;
  const countSky = scores.filter(s => s >= 34 && s < 67).length;
  const countGround = scores.filter(s => s < 34).length;
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / 31);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Dynamic Floating Magic Alert Notification */}
      {magicAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-bounce">
          <div className="bg-gradient-to-r from-purple-900 to-indigo-950 border border-purple-500 rounded-2xl p-4 shadow-2xl shadow-purple-500/20 text-slate-100 flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-purple-400 flex-shrink-0 animate-pulse mt-0.5" />
            <div>
              <h5 className="font-bold text-sm text-purple-300">비공개 관리 구역 개방</h5>
              <p className="text-xs text-slate-300 mt-1">{magicAlert}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header with warm and welcoming counselor branding instead of evaluation words */}
      <header className="border-b border-slate-920 bg-slate-900/30 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center font-black text-slate-950 tracking-tighter">
              SH
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight font-display flex items-center gap-2">
                이승환의 일상 고민 상담소 <span className="text-xs font-normal text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/10">v1.2</span>
              </h1>
              <p className="text-[11px] text-slate-400">동네 형, 누나 이승환이 들려주는 따뜻한 진심의 이야기 공간</p>
            </div>
          </div>

          {/* Time and Active status section */}
          <div className="flex items-center gap-3">
            {/* Real-time Cloud sync toggle button */}
            <button
              onClick={() => setShowCloudSettings(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all duration-250 cursor-pointer ${
                cloudConnected 
                  ? 'bg-emerald-950/45 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-500/60 shadow-md shadow-emerald-950/20' 
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="다른 기기/Vercel과 데이터를 실시간으로 동기화하는 클라우드 설정을 엽니다."
            >
              <Database className={`w-3.5 h-3.5 ${cloudConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span>{cloudConnected ? '클라우드 ON' : '클라우드 미연동'}</span>
            </button>

            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-900/45 rounded-lg border border-slate-800 text-[10px] text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>2026-06-08 12:30:00</span>
            </div>

            {unlocked && (
              <button
                onClick={() => {
                  setUnlocked(false);
                  setActiveTab('chat');
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/40 transition-all cursor-pointer"
                title="관리자 권한을 즉시 수동 잠금합니다"
              >
                <Unlock className="w-3.5 h-3.5 text-purple-400" />
                <span>관리 모드 해제</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Structural Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Navigation Tab Rails - ONLY VISIBLE when unlocked! */}
        {unlocked && (
          <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80 max-w-md animate-scale-in">
            <button
              onClick={() => handleTabClick('chat')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>1. 소통 상담실 (승환)</span>
            </button>

            <button
              onClick={() => handleTabClick('scores')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                activeTab === 'scores'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-slate-950 shadow-md shadow-purple-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>2. 실시간 점수 대판</span>
            </button>

            <button
              onClick={() => handleTabClick('record')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                activeTab === 'record'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-slate-950 shadow-md shadow-purple-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>3. 생기부 종합 대장</span>
            </button>
          </div>
        )}

        {/* Dynamic Inner Tab Display Container */}
        {loading ? (
          <div className="flex-1 min-h-[480px] bg-slate-900/20 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm text-slate-400 font-medium">상담 환경 안전 확인 중...</p>
          </div>
        ) : (
          <div className="flex-1 transition-all duration-300">
            {activeTab === 'chat' && (
              <div className="animate-fade-in">
                {/* Clean, sweet and non-evaluative welcoming banner for students */}
                <div className="bg-gradient-to-r from-emerald-950/40 to-teal-950/25 border border-emerald-900/40 rounded-xl p-4 mb-6 text-xs text-emerald-300 flex items-start gap-3 animate-fade-in">
                  <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold mb-1">[공지] 승환이 소통 편지함 이용 안내</h5>
                    <span>이곳은 청소년 여러분들이 마음껏 하소연하거나 매일의 소소한 재미, 친구 오해 등 말 못 할 사연들을 안전하게 이야기하는 우체통방입니다. 승환이 형/누나가 완전히 네 편이 되어 유쾌하고 따스한 격려의 말을 매일 아낌없이 전해 줍니다!</span>
                  </div>
                </div>

                <AINoahChat onTriggerResultPage={handleAITriggerResultPage} />
              </div>
            )}

            {activeTab === 'scores' && unlocked && (
              <div className="space-y-6">
                
                {/* Scoreboard Control Bar with Reset Button */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-4xl bg-slate-900/10 p-2 rounded-xl">
                  <div>
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      실시간 점수 대판 (교사 전용 현황판)
                    </h2>
                    <p className="text-[11px] text-slate-400">학생들의 행동 상태를 원으로 드래그해 실시간 위상 상태를 조정할 수 있습니다.</p>
                  </div>
                  
                  <button
                    onClick={() => setShowResetConfirmModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-red-950/20 to-rose-950/25 hover:from-red-900/30 hover:to-rose-900/35 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-950/20"
                    title="학생들의 모든 상태값과 상담 대장을 초기화합니다."
                  >
                    <RotateCcw className="w-3.5 h-3.5 animate-spin-hover" />
                    <span>전체 점수 초기화</span>
                  </button>
                </div>

                {/* Score summary panel */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/60 max-w-4xl">
                  <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-900 flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-pink-400" />
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono">평균 평가점수</p>
                      <h5 className="text-base font-bold text-slate-100">{averageScore}점</h5>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-900 flex items-center gap-3">
                    <span className="text-lg">🌌</span>
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono">우주 등급 (67P+)</p>
                      <h5 className="text-base font-bold text-slate-100">{countSpace}명</h5>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-900 flex items-center gap-3">
                    <span className="text-lg">☁️</span>
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono">하늘 등급 (34~66P)</p>
                      <h5 className="text-base font-bold text-slate-100">{countSky}명</h5>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-900 flex items-center gap-3">
                    <span className="text-lg">🌱</span>
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono">땅 등급 (~33P)</p>
                      <h5 className="text-base font-bold text-slate-100">{countGround}명</h5>
                    </div>
                  </div>
                </div>

                {/* Vertical runway board matching Ground, Sky, Universe style */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden shadow-xl shadow-slate-950/60">
                  
                  {/* Backdrop Background layers with labels showing the 3 realms of evaluating */}
                  <div className="absolute inset-0 flex flex-col pointer-events-none select-none z-0">
                    {/* Space zone layer */}
                    <div className="h-[33%] border-b border-purple-500/20 bg-gradient-to-b from-[#0e0024] to-[#040113]/30 p-4 flex justify-between items-start">
                      <div className="flex items-center gap-1.5 opacity-65">
                        <span className="text-lg">🌌</span>
                        <span className="text-xs uppercase text-purple-400 font-bold font-display tracking-widest">Space Zone (우주 영역 67-100점)</span>
                      </div>
                      <span className="text-[9px] text-purple-600 font-mono">극도로 우수한 리더십과 봉사 정신</span>
                    </div>

                    {/* Sky zone layer */}
                    <div className="h-[33%] border-b border-sky-500/10 bg-gradient-to-b from-[#031d2b]/40 to-[#020d1c]/30 p-4 flex justify-between items-start">
                      <div className="flex items-center gap-1.5 opacity-65">
                        <span className="text-lg">☁️</span>
                        <span className="text-xs uppercase text-sky-400 font-bold font-display tracking-widest">Sky Zone (하늘 영역 34-66점)</span>
                      </div>
                      <span className="text-[9px] text-sky-600 font-mono">단정하고 주도적인 모범 생활 태도</span>
                    </div>

                    {/* Ground zone layer */}
                    <div className="h-[34%] bg-gradient-to-b from-[#01140e]/30 to-[#0c1813]/25 p-4 flex justify-between items-start">
                      <div className="flex items-center gap-1.5 opacity-65">
                        <span className="text-lg">🌱</span>
                        <span className="text-xs uppercase text-emerald-500 font-bold font-display tracking-widest">Ground Zone (땅 영역 0-33점)</span>
                      </div>
                      <span className="text-[9px] text-emerald-800 font-mono">보호와 관심이 필요한 새싹 행동</span>
                    </div>
                  </div>

                  {/* Horizontal scrolling rack playground */}
                  <div className="relative z-10 p-6 overflow-x-auto custom-scrollbar flex gap-4 min-h-[460px]">
                    {Array.from({ length: 31 }, (_, i) => {
                      const scoreVal = scores[i] !== undefined ? scores[i] : 50;
                      const nameVal = names[i] || `${i + 1}번 학생`;
                      return (
                        <StudentTrack
                          key={i}
                          index={i}
                          score={scoreVal}
                          name={nameVal}
                          onScoreChange={handleScoreChange}
                          onSave={handleBulkSave}
                        />
                      );
                    })}
                  </div>

                  {/* Action prompt footer of runway */}
                  <div className="relative z-10 px-6 py-3 border-t border-slate-900 bg-slate-900/60 text-[11px] text-slate-400 flex flex-wrap justify-between items-center gap-2">
                    <span className="flex items-center gap-1 text-purple-400">
                      <Sparkles className="w-3.5 h-3.5" /> 각 기둥의 동그라미를 마우스로 자유롭게 드래그해 올려서 하늘을 거쳐 우주로 인도해 주세요.
                    </span>
                    <span className="text-slate-500">
                      * 마우스를 놓으면 다른 디바이스 연동을 위해 실시간 자동 백업 동기화가 이루어집니다.
                    </span>
                  </div>

                </div>

              </div>
            )}

            {activeTab === 'record' && unlocked && (
              <div className="animate-fade-in">
                <SchoolRecordTable
                  scores={scores}
                  opinions={opinions}
                  names={names}
                  onOpinionChange={handleOpinionChange}
                  onNameChange={handleNameChange}
                  onSaveAll={saveRecords}
                  saving={saving}
                />
              </div>
            )}
          </div>
        )}

      </main>

      {/* Admin Unlock Gate Password modal popup */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in">
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-950/60 text-purple-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-display">학급 심층 관리 권한 해제</h3>
                <p className="text-xs text-slate-400">교사 전용 평가 실시간 등급판 및 생기부 관리</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-900">
              보안 및 학생들의 심리 안정을 위해 비공개로 유지됩니다.<br />
              지정된 6자리 임무 전용 보안 코드를 정확히 입력하세요.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">비밀 코드 번호 입력</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="6자리 숫자 입력..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-center tracking-widest font-bold"
                  autoFocus
                  id="admin-pass-field"
                />
                {passwordError && (
                  <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setPasswordError('');
                    setPasswordInput('');
                  }}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 font-semibold rounded-lg text-xs transition-all cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 font-black rounded-lg text-xs transition-all cursor-pointer shadow-md shadow-purple-500/10"
                >
                  심층 관리 활성화
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scoreboard Reset Double Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in">
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-950/60 text-red-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-display">현황판 점수 전체 초기화</h3>
                <p className="text-xs text-rose-400 font-semibold">경고: 이 작업은 실시간으로 저장되며 취소할 수 없습니다.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/65">
              학급 실시간 점수 대판의 모든 학생(31명) 점수가 기본값인 <strong className="text-emerald-400 font-bold">50점(하늘 영역)</strong>으로 복구되며, 기록해둔 행동 평가 의견 대장도 모두 초기화됩니다.<br/><br/>
              정말로 전체 초기화를 진행하시겠습니까?
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 font-semibold rounded-lg text-xs transition-all cursor-pointer"
              >
                취소 (유지하기)
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-md shadow-red-500/10"
              >
                들대판 초기화 승인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Triggerable Footer Row */}
      <footer 
        onClick={() => {
          if (!unlocked) {
            setShowUnlockModal(true);
          }
        }}
        title="학급 관리 콘솔 도킹 구역"
        className="mt-auto border-t border-slate-920 bg-slate-950 hover:bg-slate-900/25 py-6 text-center text-xs text-slate-500 transition-all duration-300 cursor-pointer select-none"
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 이승환의 힐링 상담 공간. All Rights Reserved.</p>
          <p className="text-[10px] font-mono select-none text-slate-700 hover:text-slate-500 transition-colors">시스템 모니터 | PORT: 3000 | RE records_db.json | NODE CONTAINER</p>
        </div>
      </footer>

      {/* Cloud Sync Settings Modal */}
      <CloudSyncSettings 
        isOpen={showCloudSettings} 
        onClose={() => setShowCloudSettings(false)} 
        onConfigChange={() => {
          setCloudConnected(isFirebaseEnabled());
        }} 
      />

    </div>
  );
}
