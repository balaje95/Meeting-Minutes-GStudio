import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Video, 
  Users, 
  User, 
  FileText, 
  LogOut, 
  RefreshCw, 
  Clipboard, 
  CheckCircle2, 
  Loader2,
  Calendar,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { generateMeetingMinutes } from './lib/gemini';

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration?: string;
  preview?: string;
  transcript?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [minutes, setMinutes] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Check auth on load
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch meetings when tab changes
  useEffect(() => {
    if (activeTab === 'my' || activeTab === 'team') {
      fetchMeetings();
    }
  }, [activeTab, authenticated]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setAuthenticated(data.authenticated);
    } catch (err) {
      console.error('Auth check failed', err);
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const type = activeTab === 'my' ? 'me' : 'team';
      const res = await fetch(`/api/meetings?type=${type}`);
      if (res.status === 401) {
        setAuthenticated(false);
        setMeetings([]);
        return;
      }
      const data = await res.json();
      setMeetings(data);
    } catch (err) {
      console.error('Failed to fetch meetings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      const popup = window.open(url, 'Fathom OAuth', 'width=600,height=700');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          setAuthenticated(true);
          window.removeEventListener('message', handleMessage);
          fetchMeetings();
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error('Failed to initiate OAuth', err);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setMeetings([]);
  };

  const handleGenerateFromMeeting = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setGenerating(true);
    setMinutes(null);
    try {
      let transcript = meeting.transcript;
      if (!transcript) {
        const res = await fetch(`/api/meetings/${meeting.id}/transcript`);
        const data = await res.json();
        transcript = data.transcript;
      }
      
      if (transcript) {
        const result = await generateMeetingMinutes(transcript);
        setMinutes(result || null);
      }
    } catch (err) {
      console.error('Generation failed', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateManual = async () => {
    if (!manualTranscript.trim()) return;
    setGenerating(true);
    setSelectedMeeting(null);
    setMinutes(null);
    try {
      const result = await generateMeetingMinutes(manualTranscript);
      setMinutes(result || null);
    } catch (err) {
      console.error('Generation failed', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6">
        
        {/* Header Section */}
        <header className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Video className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              MinutesGen <span className="text-indigo-600">for Fathom</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {authenticated ? (
              <>
                <div className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-100">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  Fathom Connected
                </div>
                <button 
                  onClick={handleLogout}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <button 
                onClick={handleConnect}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
              >
                Connect Fathom
              </button>
            )}
          </div>
        </header>

        {/* Main Bento Grid */}
        <div className="grid grid-cols-12 gap-6 min-h-[600px]">
          
          {/* Left Column: Meeting Lists (Tabs) */}
          <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden max-h-[700px]">
            <div className="flex border-b border-slate-100 bg-slate-50/30">
              <button 
                onClick={() => setActiveTab('my')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'my' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
              >
                My Calls
              </button>
              <button 
                onClick={() => setActiveTab('team')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'team' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Team Calls
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-1"
                >
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <span className="text-sm">Fetching meetings...</span>
                    </div>
                  ) : meetings.length > 0 ? (
                    meetings.map((meeting) => (
                      <div 
                        key={meeting.id}
                        onClick={() => handleGenerateFromMeeting(meeting)}
                        className={`flex items-center justify-between p-4 rounded-xl cursor-pointer group border transition-all ${selectedMeeting?.id === meeting.id ? 'bg-slate-50 border-slate-100' : 'border-transparent hover:bg-slate-50 hover:border-slate-100'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold transition-colors ${selectedMeeting?.id === meeting.id ? 'text-indigo-600' : 'text-slate-800'}`}>
                            {meeting.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(meeting.date).toLocaleDateString()} • {meeting.duration || 'N/A'}
                          </span>
                        </div>
                        {selectedMeeting?.id === meeting.id ? (
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md">Selected</span>
                        ) : (
                          <button className="opacity-0 group-hover:opacity-100 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm">
                            Process
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-slate-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p className="text-sm font-medium">Select a tab or connect Fathom</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right Section: Manual Action & Generator status */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            
            {/* Manual Input Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Manual Transcript</h3>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded">Optional</span>
              </div>
              <textarea 
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
                className="w-full h-40 bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600 transition-all"
                placeholder="Paste your meeting transcript here if not using Fathom sync..."
              ></textarea>
              <button 
                onClick={handleGenerateManual}
                disabled={!manualTranscript.trim() || generating}
                className="w-full bg-slate-50 text-slate-600 border border-slate-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Process Manual Transcript
              </button>
            </div>

            {/* Action Card */}
            <div className={`flex-1 min-h-[250px] rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between transition-all ${generating ? 'bg-indigo-700 animate-pulse' : 'bg-indigo-600 shadow-indigo-200'}`}>
              <div>
                <h3 className="text-lg font-bold mb-2">
                  {generating ? 'Processing AI Magic...' : selectedMeeting ? 'Ready to process' : 'Select a Meeting'}
                </h3>
                <p className="text-indigo-100 text-sm leading-relaxed mb-4">
                  {generating 
                    ? 'Our assistant is analyzing the transcript to extract key takeaways and action items.' 
                    : selectedMeeting 
                      ? `Processing: ${selectedMeeting.title}. Your professional summary will appear below.`
                      : 'Choose a recording from the left list or paste a transcript to begin.'}
                </p>
                
                {(generating || selectedMeeting) && (
                  <div className="bg-indigo-700/50 rounded-2xl p-4 border border-indigo-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-xs font-bold">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-white rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: generating ? "100%" : selectedMeeting ? "100%" : "0%" }}
                          transition={{ duration: generating ? 10 : 0.5 }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">
                      {generating ? 'Status: Synthesizing notes' : 'Status: Ready to Generate'}
                    </span>
                  </div>
                )}
              </div>

              {!generating && selectedMeeting && (
                <button 
                  onClick={() => handleGenerateFromMeeting(selectedMeeting)}
                  className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-bold text-base shadow-xl shadow-indigo-900/10 active:scale-95 transition-all"
                >
                  Regenerate Minutes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Output Section (Bento Box for Result) */}
        <AnimatePresence>
          {minutes && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-12 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm"
            >
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Synthesized Minutes</h2>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(minutes);
                    alert("Copied to clipboard!");
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  <Clipboard className="w-4 h-4" />
                  Copy Text
                </button>
              </div>

              <div className="whitespace-pre-wrap font-sans text-slate-600 leading-relaxed max-w-none prose prose-slate">
                {minutes.split('\n').map((line, i) => {
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return (
                      <div key={i} className="flex gap-3 mb-2 ml-4">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span>{line.substring(2)}</span>
                      </div>
                    );
                  }
                  if (line.endsWith(':')) {
                    return <h3 key={i} className="text-sm font-bold mt-6 mb-3 text-indigo-600 uppercase tracking-widest">{line}</h3>;
                  }
                  if (line.trim() === '') return <div key={i} className="h-4" />;
                  return <p key={i} className="mb-4">{line}</p>;
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Area */}
        <footer className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="flex-1 bg-slate-200/40 rounded-2xl p-4 flex items-center justify-between border border-slate-200">
             <div className="flex items-center gap-4">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">ANALYSIS CREDITS</div>
               <div className="text-lg font-mono font-bold text-slate-700 leading-none">Unlimited</div>
             </div>
             <div className="h-1.5 w-32 bg-slate-300 rounded-full overflow-hidden">
               <div className="w-full h-full bg-indigo-500"></div>
             </div>
          </div>
          <div className="flex-none md:w-64 bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold text-sm cursor-not-allowed opacity-80">
             <RefreshCw className="w-4 h-4" />
             AI Assistant Active
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </div>
  );
}
