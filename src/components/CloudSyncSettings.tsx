import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  Key, 
  Settings, 
  Copy, 
  Check, 
  Save, 
  RefreshCw, 
  Info,
  X,
  Sparkles,
  HelpCircle,
  FilePlus,
  ArrowRight
} from 'lucide-react';
import { 
  FirebaseConfig, 
  getStoredFirebaseConfig, 
  getClassCode, 
  setClassCode, 
  isFirebaseEnabled, 
  initializeFirebase,
  testCloudConnection
} from '../firebase';

interface CloudSyncSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: () => void;
}

export default function CloudSyncSettings({ isOpen, onClose, onConfigChange }: CloudSyncSettingsProps) {
  const [classCode, setLocalClassCode] = useState(getClassCode());
  const [isCloudActive, setIsCloudActive] = useState(isFirebaseEnabled());
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [neonStatus, setNeonStatus] = useState<{ status: string; message: string; count?: number } | null>(null);
  const [neonLoading, setNeonLoading] = useState(false);
  const [counselingLogs, setCounselingLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const checkNeonStatus = async () => {
    setNeonLoading(true);
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      setNeonStatus(data);
    } catch (e) {
      console.error("Failed to check Neon status:", e);
      setNeonStatus({ status: "error", message: "서버 API 연결에 실패했습니다." });
    } finally {
      setNeonLoading(false);
    }
  };

  const loadCounselingLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/counseling-logs');
      const data = await res.json();
      setCounselingLogs(data);
    } catch (e) {
      console.error("Failed to fetch counseling logs:", e);
    } finally {
      setLogsLoading(false);
    }
  };
  
  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const code = classCode.trim() || getClassCode();
    return `${origin}${pathname}?code=${encodeURIComponent(code)}`;
  };

  const handleCopyShareUrl = () => {
    const url = getShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setStatusMsg({ 
      text: `기기간 자동 연동 주소(${classCode.trim() || getClassCode()})가 복사되었습니다! 이 링크를 스마트폰이나 다른 컴퓨터 창에 복사해 접속해주세요.`, 
      type: 'success' 
    });
    setTimeout(() => {
      setShareCopied(false);
    }, 4500);
  };
  
  // Custom Firebase fields config form
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');

  // Status message notice
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' | null }>({ text: '', type: null });

  // Load existing configuration on open
  useEffect(() => {
    if (isOpen) {
      setLocalClassCode(getClassCode());
      setIsCloudActive(isFirebaseEnabled());
      
      const config = getStoredFirebaseConfig();
      if (config) {
        setApiKey(config.apiKey || '');
        setAuthDomain(config.authDomain || '');
        setProjectId(config.projectId || '');
        setStorageBucket(config.storageBucket || '');
        setMessagingSenderId(config.messagingSenderId || '');
        setAppId(config.appId || '');
      }

      checkNeonStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveClassCode = () => {
    const trimmed = classCode.trim();
    if (!trimmed) {
      setStatusMsg({ text: '학급 코드를 입력해주세요.', type: 'error' });
      return;
    }
    setClassCode(trimmed);
    onConfigChange();
    setStatusMsg({ text: `학급 코드가 '${trimmed}'(으)로 변경되었습니다.`, type: 'success' });
    setTimeout(() => setStatusMsg({ text: '', type: null }), 3000);
  };

  const handleSaveCustomFirebase = () => {
    if (!apiKey.trim() || !projectId.trim()) {
      setStatusMsg({ text: 'API Key와 Project ID는 필수 항목입니다!', type: 'error' });
      return;
    }

    const newConfig: FirebaseConfig = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim()
    };

    localStorage.setItem('noah_firebase_config', JSON.stringify(newConfig));
    const ok = initializeFirebase();
    setIsCloudActive(ok);
    
    if (ok) {
      setStatusMsg({ text: '축하합니다! 클라우드 Firebase 데이터베이스가 성공적으로 설정되었습니다.', type: 'success' });
      onConfigChange();
    } else {
      setStatusMsg({ text: 'Firebase 연결에 실패했습니다. 키 값을 확인해주세요.', type: 'error' });
    }
    setTimeout(() => setStatusMsg({ text: '', type: null }), 4000);
  };

  const handleClearCustomFirebase = () => {
    localStorage.removeItem('noah_firebase_config');
    localStorage.removeItem('noah_unlocked');
    initializeFirebase();
    setIsCloudActive(isFirebaseEnabled());
    setApiKey('');
    setAuthDomain('');
    setProjectId('');
    setStorageBucket('');
    setMessagingSenderId('');
    setAppId('');
    setStatusMsg({ text: '설정된 사용자 정의 Firebase 세션이 해제되었습니다.', type: 'info' });
    onConfigChange();
    setTimeout(() => setStatusMsg({ text: '', type: null }), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusMsg({ text: '데이터베이스 연결 상태를 가상 쿼리로 점검하는 중입니다...', type: 'info' });
    const result = await testCloudConnection();
    if (result.success) {
      setStatusMsg({ text: result.message, type: 'success' });
    } else {
      setStatusMsg({ text: result.message, type: 'error' });
    }
    setTesting(false);
  };

  const handleCopyVercelEnv = () => {
    const envString = `VITE_FIREBASE_API_KEY="${apiKey}"\nVITE_FIREBASE_AUTH_DOMAIN="${authDomain}"\nVITE_FIREBASE_PROJECT_ID="${projectId}"\nVITE_FIREBASE_STORAGE_BUCKET="${storageBucket}"\nVITE_FIREBASE_MESSAGING_SENDER_ID="${messagingSenderId}"\nVITE_FIREBASE_APP_ID="${appId}"`;
    navigator.clipboard.writeText(envString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-scale-in text-slate-100">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl flex items-center justify-center ${isCloudActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-850 text-slate-400'}`}>
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base font-display">실시간 클라우드 동기화 제어</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                {isCloudActive ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-ping" />
                    <span className="text-emerald-400 font-semibold font-mono">LIVE CLOUD ACTIVE</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block" />
                    <span className="text-slate-400">오프라인 브라우저 및 로컬 모드</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explain Card */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 mb-5 text-xs text-slate-300 leading-relaxed space-y-2">
          <p className="font-semibold text-teal-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> 다른 기기, 모바일, 태블릿과 공유되는 원리
          </p>
          <p>
            Vercel과 같은 서버리스 주소나 모바일에서 접속할 경우, 로컬 서버 재부팅 시 데이터가 초기화될 수 있습니다. 
            아래에 <strong>나만의 학급 코드(방번호)</strong>를 개설하고 무료 <strong>Google Firebase(Firestore)</strong>를 연동해 두면, 전 세계 어디서든 학급 현황판의 아이콘을 드래그하는 즉시 여러 기기에서 실시간 동기화됩니다!
          </p>
        </div>

        {/* Form elements */}
        <div className="space-y-5">
          {/* Section 1: Room Key (Class Code) */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850/80">
            <label className="text-[11px] text-teal-400 font-bold tracking-wider uppercase block mb-1.5 flex items-center gap-1">
              <Key className="w-3.5 h-3.5" /> 1단계: 나만의 공유 학급 코드 (방 번호)
            </label>
            <p className="text-[10px] text-slate-500 mb-2.5">
              동일한 카카오톡방이나 다른 기기에서 이 코드를 똑같이 맞추면 실시간으로 학급 데이터가 하나로 전송/공유됩니다.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={classCode}
                onChange={(e) => setLocalClassCode(e.target.value)}
                placeholder="예: woojoeng-3-2"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
              />
              <button
                type="button"
                onClick={handleSaveClassCode}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-emerald-950/20"
              >
                코드 적용
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-900 flex flex-col gap-2.5">
              <div className="text-[10px] text-slate-400 flex justify-between items-center font-semibold">
                <span className="flex items-center gap-1">🔗 다른 기기 간 자동연동 공유 주소</span>
                {shareCopied && <span className="text-emerald-400 font-bold animate-pulse">복사되었습니다!</span>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-slate-900/60 border border-slate-850 rounded-xl px-3 py-2 text-[10px] text-slate-400 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>주소 복사</span>
                </button>
              </div>
              <p className="text-[10px] text-teal-400/80 leading-relaxed font-semibold">
                ※ 위 <strong className="text-teal-300">주소 복사</strong> 버튼을 눌러 다른 기기(스마트폰, 다른 환경 컴퓨터)에 복사하여 붙여넣어 접속하면 별도 세팅값을 타이핑하지 않고도 <strong className="text-white">실시간 점수판 양방향 동기화</strong>가 시작됩니다!
              </p>
            </div>
          </div>

          {/* Section 2: Firebase Connection Settings */}
          <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-850/60">
            <div className="flex justify-between items-center mb-1">
              <button
                type="button"
                onClick={() => setShowConfigDetails(!showConfigDetails)}
                className="text-xs text-slate-300 font-bold hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className={`w-3.5 h-3.5 text-amber-500 ${showConfigDetails ? 'rotate-45' : ''} transition-all`} />
                <span>2단계: Google Firebase 클라우드 DB 연동 설정</span>
              </button>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isCloudActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700/60'}`}>
                {isCloudActive ? "연결됨" : "로컬 브라우저 저장"}
              </span>
            </div>
            
            <p className="text-[10px] text-slate-500 mb-3 ml-5">
              사용자가 직접 발급받은 무료 Firebase 정보로 동기화합니다. Vercel이나 개인 깃허브 페이지에서 완벽한 영구 보관이 가능해집니다.
            </p>

            {/* Hidden Input drawer */}
            {showConfigDetails && (
              <div className="space-y-3 mt-4 pt-4 border-t border-slate-850/80 animate-fade-in text-xs">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-850/80 text-[10px] text-slate-400 leading-relaxed mb-4">
                  💡 <strong>Firebase 발급 방법:</strong> <br/>
                  1. <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">Firebase 콘솔</a>에 접속하여 새 프로젝트 개설 <br/>
                  2. <strong>Firestore Database</strong>를 추가하고 보안 규칙을 <span className="text-yellow-400 font-mono">allow read, write: if true;</span> 로 세팅<br/>
                  3. 프로젝트 앱 등록(웹) 후 발급되는 객체를 복사해서 아래에 붙여넣어주세요!
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 tracking-wide font-semibold block mb-1">PROJECT ID (프로젝트 ID) *</label>
                    <input
                      type="text"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      placeholder="예: woojoeng-high-counsel"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 tracking-wide font-semibold block mb-1">API KEY (고유 식별 키) *</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 tracking-wide font-semibold block mb-1">AUTH DOMAIN</label>
                    <input
                      type="text"
                      value={authDomain}
                      onChange={(e) => setAuthDomain(e.target.value)}
                      placeholder="*.firebaseapp.com"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 tracking-wide font-semibold block mb-1">STORAGE BUCKET</label>
                    <input
                      type="text"
                      value={storageBucket}
                      onChange={(e) => setStorageBucket(e.target.value)}
                      placeholder="*.appspot.com"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 tracking-wide font-semibold block mb-1">MESSAGING SENDER ID</label>
                    <input
                      type="text"
                      value={messagingSenderId}
                      onChange={(e) => setMessagingSenderId(e.target.value)}
                      placeholder="1049..."
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 tracking-wide font-semibold block mb-1">APP ID</label>
                    <input
                      type="text"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder="1:1049...:web:..."
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-650 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end pt-3 text-[11px] font-bold flex-wrap">
                  {isCloudActive && (
                    <>
                      <button
                        type="button"
                        onClick={handleClearCustomFirebase}
                        className="px-3 py-2 bg-slate-900 hover:bg-red-950/20 hover:border-red-500/30 text-rose-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
                      >
                        실시간 구동 해제
                      </button>
                      <button
                        type="button"
                        disabled={testing}
                        onClick={handleTestConnection}
                        title="Firebase 실시간 트랜잭션을 진단하고 규칙(Rules) 오류 여부를 점검합니다."
                        className="px-3 py-2 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold"
                      >
                        <Wifi className={`w-3.5 h-3.5 text-emerald-400 ${testing ? 'animate-bounce' : ''}`} />
                        <span>연결 상태 진단</span>
                      </button>
                    </>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleCopyVercelEnv}
                    title="Vercel이나 .env에 똑같이 붙여넣기 할 수 있는 환경 변수 텍스트를 복사합니다."
                    className="px-3 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Vercel 변수 복사</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCustomFirebase}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-orange-950/40"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>클라우드 활성화</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Neon PostgreSQL Counseling Database */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
            <label className="text-[11px] text-teal-400 font-bold tracking-wider uppercase block mb-1.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-500" /> 3단계: Neon PostgreSQL 상담 기록 연동 & 조회
            </label>
            <p className="text-[10px] text-slate-500 mb-2.5 leading-relaxed">
              AI 상담교사 '승환 쌤'과의 상담 대화 일지가 실시간으로 Neon 클라우드 데이터베이스에 안전하게 기록됩니다.
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 shrink-0">DB 엔드포인트:</span>
                  <span className="text-[10px] font-mono text-slate-500 truncate" title="ep-ancient-art-aomh7xrl...">
                    ep-ancient-art-aomh7xrl-pooler...
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-400 shrink-0">연결 상태:</span>
                  {neonLoading ? (
                    <span className="text-[10px] text-slate-400 animate-pulse">상태 점검 중...</span>
                  ) : neonStatus?.status === 'connected' ? (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      연결됨 (저장된 상담: {neonStatus.count}건)
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-400 font-bold">오프라인 / 연결 실패</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  checkNeonStatus();
                  if (showLogs) loadCounselingLogs();
                }}
                disabled={neonLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:text-white font-bold rounded-xl text-[10px] transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${neonLoading ? 'animate-spin' : ''}`} />
                연결 확인하기
              </button>
            </div>

            {/* Counseling logs expander */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  const nextState = !showLogs;
                  setShowLogs(nextState);
                  if (nextState) {
                    loadCounselingLogs();
                  }
                }}
                className="w-full py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-850 rounded-xl text-[10px] text-slate-300 font-semibold hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{showLogs ? "상담 기록 창 닫기" : "저장된 상담 기록 전체 보기 🔍"}</span>
              </button>

              {showLogs && (
                <div className="mt-2 bg-slate-950 rounded-xl border border-slate-850 p-2.5 max-h-[220px] overflow-y-auto space-y-2.5 animate-fade-in custom-scrollbar">
                  {logsLoading ? (
                    <div className="text-center py-6 text-slate-500 text-[10px] animate-pulse">상담 일지를 불러오는 중입니다...</div>
                  ) : counselingLogs.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-[10px]">아직 기록된 상담 데이터가 없습니다.</div>
                  ) : (
                    counselingLogs.map((log) => (
                      <div key={log.id} className="p-2.5 bg-slate-900 border border-slate-850 rounded-xl text-[10px] space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-slate-800 pb-1 mb-1 font-mono">
                          <span className="text-teal-400 font-semibold">{log.detected_pillar || "[미분류]"}</span>
                          <span>{new Date(log.created_at).toLocaleString('ko-KR')}</span>
                        </div>
                        <div>
                          <span className="text-amber-400 font-bold block text-[9px]">학생 고민 내용:</span>
                          <p className="text-slate-300 pl-1 leading-relaxed">{log.user_message}</p>
                        </div>
                        <div className="mt-1 pt-1 border-t border-slate-800/60">
                          <span className="text-emerald-400 font-bold block text-[9px]">이승환 선생님 답변:</span>
                          <p className="text-slate-300 pl-1 leading-relaxed whitespace-pre-wrap">{log.ai_response}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic status toast banner inside modal */}
        {statusMsg.text && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-semibold leading-relaxed animate-fade-in ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
              : statusMsg.type === 'error'
              ? 'bg-red-950/40 border-red-500/30 text-red-300'
              : 'bg-slate-950 border-slate-850 text-slate-300'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* Quick FAQ / Helper note */}
        <div className="mt-6 pt-5 border-t border-slate-850 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="text-[10px] text-slate-500 leading-relaxed">
            <strong>현재 로컬 개발 주소 상태:</strong> <br/>
            로컬 환경에서는 full-stack Express REST API를 이용해 <code className="text-slate-400 font-mono bg-slate-950 px-1 py-0.5 rounded">records_db.json</code> 파일에 데이터가 자동 백업됩니다. Vercel이나 외부 사이트로 빌드 이동을 하면 Firebase Cloud가 연계되는 시점부터 브라우저 갱신 없이 실시간으로 타 기기와 맞물립니다.
          </div>
        </div>

      </div>
    </div>
  );
}
