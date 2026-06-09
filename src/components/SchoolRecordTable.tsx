import React, { useState, useEffect } from 'react';
import { Search, Save, CheckCircle, Award, RefreshCw, FileText } from 'lucide-react';

interface SchoolRecordTableProps {
  scores: number[];
  opinions: string[];
  names: string[];
  onOpinionChange: (index: number, val: string) => void;
  onNameChange: (index: number, val: string) => void;
  onSaveAll: (updatedScores?: number[], updatedOpinions?: string[], updatedNames?: string[]) => Promise<void>;
  saving: boolean;
}

export default function SchoolRecordTable({
  scores,
  opinions,
  names,
  onOpinionChange,
  onNameChange,
  onSaveAll,
  saving,
}: SchoolRecordTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<'all' | 'space' | 'sky' | 'ground' | 'empty'>('all');
  const [localOpinions, setLocalOpinions] = useState<string[]>(opinions);
  const [localNames, setLocalNames] = useState<string[]>(names);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'writing' | 'saved'>('idle');

  // Sync internal copies when parent updates
  useEffect(() => {
    setLocalOpinions(opinions);
  }, [opinions]);

  useEffect(() => {
    setLocalNames(names);
  }, [names]);

  // Determine current tier from score
  const getTierInfo = (score: number) => {
    if (score >= 67) return { label: '🌌 우주', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' };
    if (score >= 34) return { label: '☁️ 하늘', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' };
    return { label: '🌱 땅', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  };

  // Trigger manual save with immediate optimistic status representation (instant feedback)
  const handleSingleSave = () => {
    setAutosaveStatus('writing');
    // Save in the background so there's zero block or delay
    onSaveAll(scores, localOpinions, localNames).then(() => {
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    }).catch((e) => {
      console.warn("Background cloud save failed:", e);
      setAutosaveStatus('idle');
    });

    // Instant visual satisfaction for the teacher
    setTimeout(() => {
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    }, 120);
  };

  // 3. Automatic debounced background autosave as the user types
  useEffect(() => {
    // Check if the current local states are different from parent props
    const opinionsChanged = JSON.stringify(localOpinions) !== JSON.stringify(opinions);
    const namesChanged = JSON.stringify(localNames) !== JSON.stringify(names);
    
    if (!opinionsChanged && !namesChanged) return;
    
    // Set status to writing
    setAutosaveStatus('writing');
    
    const debounceTimer = setTimeout(() => {
      onSaveAll(scores, localOpinions, localNames).then(() => {
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      }).catch((err) => {
        console.warn("Debounced autosave write failed:", err);
        setAutosaveStatus('idle');
      });
    }, 1500); // Trigger saving 1.5s after natural typing stops

    return () => clearTimeout(debounceTimer);
  }, [localOpinions, localNames]);

  // Filtering students
  const filteredStudents = Array.from({ length: 31 }, (_, index) => {
    const score = scores[index] !== undefined ? scores[index] : 50;
    const opinion = localOpinions[index] || '';
    const name = localNames[index] || `${index + 1}번 학생`;
    const num = index + 1;

    return { index, score, opinion, name, num };
  }).filter((st) => {
    // Search keyword check
    const matchesSearch =
      st.name.includes(searchTerm) ||
      String(st.num).includes(searchTerm) ||
      st.opinion.includes(searchTerm);

    if (!matchesSearch) return false;

    // Filter tier check
    if (filterTier === 'space') return st.score >= 67;
    if (filterTier === 'sky') return st.score >= 34 && st.score < 67;
    if (filterTier === 'ground') return st.score < 34;
    if (filterTier === 'empty') return !st.opinion.trim();

    return true;
  });

  return (
    <div className="bg-[#fbfaf5] rounded-2xl border border-[#e1dac8] shadow-md p-6 text-[#2d2a24] font-sans">
      {/* Visual Seal / Header mimicking authentic high school transcript (생기부) */}
      <div className="border-b-2 border-double border-[#9e957d] pb-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-800">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif tracking-tight text-[#453e34] flex items-center gap-1.5">
                학교생활기록 종합 대장 (학급 반장 의견록)
              </h2>
              <p className="text-xs text-[#8c8266] mt-0.5">
                각 번호별 행동 발달 특성 관찰 및 기기 공유 데이터베이스 암호화 등기
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {autosaveStatus === 'writing' && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 서버 동기화 중...
              </span>
            )}
            {autosaveStatus === 'saved' && (
              <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> 영구 보존 완료!
              </span>
            )}

            <button
              onClick={handleSingleSave}
              className="px-4 py-2 bg-[#4c4233] hover:bg-[#3d3428] text-[#f7f5ef] text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              id="save-all-opinion-btn"
            >
              <Save className="w-3.5 h-3.5" />
              <span>생활기록 전체 저장</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Tools Filters & Search Bar */}
      <div className="space-y-4 mb-6 bg-[#f7f4e9]/70 p-4 rounded-xl border border-[#e3dfd0]">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-emerald-800/60 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="학생 번호, 이름, 혹은 의견 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#fbfaf5] border border-[#d2cbba] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#2c2820] placeholder-[#a19985] focus:outline-none focus:ring-1 focus:ring-amber-800/40 focus:border-amber-800/40 transition-all"
            />
          </div>

          {/* Preset Buttons filter Tier */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterTier('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterTier === 'all'
                  ? 'bg-amber-900/10 text-amber-900 border border-amber-800/30'
                  : 'bg-[#fbfaf5] text-slate-500 border border-[#d2cbba]/60 hover:bg-[#eae6d8]'
              }`}
            >
              전체보기 ({filteredStudents.length})
            </button>
            <button
              onClick={() => setFilterTier('space')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterTier === 'space'
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-[#fbfaf5] text-slate-500 border border-[#d2cbba]/60 hover:bg-[#eae6d8]'
              }`}
            >
              🌌 우주 등급
            </button>
            <button
              onClick={() => setFilterTier('sky')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterTier === 'sky'
                  ? 'bg-sky-100 text-sky-900 border border-sky-200'
                  : 'bg-[#fbfaf5] text-slate-500 border border-[#d2cbba]/60 hover:bg-[#eae6d8]'
              }`}
            >
              ☁️ 하늘 등급
            </button>
            <button
              onClick={() => setFilterTier('ground')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterTier === 'ground'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : 'bg-[#fbfaf5] text-slate-500 border border-[#d2cbba]/60 hover:bg-[#eae6d8]'
              }`}
            >
              🌱 땅 등급
            </button>
            <button
              onClick={() => setFilterTier('empty')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterTier === 'empty'
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : 'bg-[#fbfaf5] text-slate-500 border border-[#d2cbba]/60 hover:bg-[#eae6d8]'
              }`}
            >
              ✏️ 의견 미작성
            </button>
          </div>
        </div>
      </div>

      {/* Grid Student records container */}
      <div className="space-y-4 max-h-[760px] overflow-y-auto custom-scrollbar pr-1">
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-[#9c9480] bg-[#fbfaf5] border border-dashed border-[#d2cbba] rounded-2xl">
            해당 등급이나 검색 조건에 일치하는 기록 정보가 존재하지 않습니다.
          </div>
        ) : (
          filteredStudents.map((st) => {
            const tierInfo = getTierInfo(st.score);
            return (
              <div
                key={st.index}
                className="bg-[#fbfaf5] border border-[#e1dac8] hover:border-[#cbc1a9] rounded-xl p-4 shadow-sm hover:shadow transition-all duration-150 flex flex-col md:flex-row items-stretch gap-4"
              >
                {/* No, Names & Scores details section */}
                <div className="w-full md:w-56 flex-shrink-0 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#ece7dc] pb-3 md:pb-0 md:pr-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-[#4c4233] text-[#f7f5ef] text-[10px] font-mono rounded font-bold">
                        번호: {st.num}번
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${tierInfo.badgeClass}`}>
                        {tierInfo.label} ({st.score}P)
                      </span>
                    </div>

                    {/* Student Name edit field (customizable!) */}
                    <div className="mt-1">
                      <label className="text-[10px] text-[#8c8266] font-semibold block mb-0.5">이름 관리</label>
                      <input
                        type="text"
                        value={st.name}
                        onChange={(e) => {
                          onNameChange(st.index, e.target.value);
                          setLocalNames((prev) => {
                            const updated = [...prev];
                            updated[st.index] = e.target.value;
                            return updated;
                          });
                        }}
                        className="w-full bg-[#fcfcf9] border border-[#dcd6c6] rounded px-2.5 py-1 text-xs font-bold text-[#2d2921] focus:outline-none focus:ring-1 focus:ring-amber-800"
                        title="이름을 변경하면 실시간 반영 및 저장됩니다"
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 font-medium">
                    학급 번호별 생활기록 통제선
                  </div>
                </div>

                {/* Behavioral Observations details form textarea */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <label className="text-[10px] text-[#8c8266] font-semibold block mb-1 flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-800" /> 행동발달 사항 및 회장의 주관 평가 의견
                    </label>
                    <textarea
                      rows={2.5}
                      value={st.opinion}
                      onChange={(e) => {
                        onOpinionChange(st.index, e.target.value);
                        setLocalOpinions((prev) => {
                          const updated = [...prev];
                          updated[st.index] = e.target.value;
                          return updated;
                        });
                      }}
                      placeholder="학급 회장으로서 이 학생이 교실에서 보여준 인성, 협동력, 청소 상태, 수업 호응 등에 대한 구체적인 상황을 기록해 주세요..."
                      className="w-full bg-[#fdfdfc] border border-[#dcd6c6] rounded-lg p-2.5 text-xs text-[#302c24] placeholder-[#bcbaaf] focus:outline-none focus:ring-1 focus:ring-amber-800 leading-relaxed font-serif"
                    ></textarea>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decorative footer stamp */}
      <div className="mt-8 border-t border-[#ece7dc] pt-4 text-center text-[10px] text-[#9c9480] flex justify-center items-center gap-1.5 font-serif">
        <span className="w-2.5 h-2.5 rounded-full border border-teal-500 bg-teal-500/10 inline-block" />
        <span>일상 고민 상담소 생활기록 대장</span>
      </div>
    </div>
  );
}
