import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Search, LogOut, Bell, FileText, TrendingUp, Calendar, MessageCircle, Paperclip, Loader2, Download, Settings, ListChecks } from "lucide-react";
import { Badge as StatusBadge } from "@/components/ui/badge";
import pilgrimIcon from "@/assets/pilgrim-icon.jpg";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import AgentCalendar from "./AgentCalendar";
import AgentTaskManager from "./AgentTaskManager";
import AgentPerformanceAnalytics from "./AgentPerformanceAnalytics";
import RegisterPilgrimModal from "./RegisterPilgrimModal";
import EditPilgrimModal from "./EditPilgrimModal";


const AgentDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const token = localStorage.getItem('agent_token');

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    if (!token) {
      navigate("/agent-login");
    }
  }, [navigate]);
  // State and hooks
  const [searchNIN, setSearchNIN] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pilgrims, setPilgrims] = useState<any[]>([]);
  const [selectedPilgrim, setSelectedPilgrim] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isPilgrimTyping, setIsPilgrimTyping] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [agentData, setAgentData] = useState<any>(null);
  // Document management state for agent
  const [documents, setDocuments] = useState<any[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("");
  // Add missing state for searchResults
  const [searchResults, setSearchResults] = useState<string | null>(null);
  const [openChat, setOpenChat] = useState("");
  const [chatMessagesInt, setChatMessagesInt] = useState<any[]>([]);
  const [chatTargetPilgrimId, setChatTargetPilgrimId] = useState<number | null>(null);
  // EventSource refs for SSE
  const agentEventSourceRef = useRef<EventSource | null>(null);
  const pilgrimEventSourceRef = useRef<EventSource | null>(null);
  const documentsEventSourceRef = useRef<EventSource | null>(null);
  // Deduplicate incoming messages
  const receivedMessageIdsRef = useRef<Set<number>>(new Set());

  // Use SSE for integrated chat (agent-level stream) and one-time fetch for history
  useEffect(() => {
    if (!openChat) return;
    const fetchHistory = async () => {
      try {
        let url = `${API_BASE_URL}/messages`;
        if (openChat === 'pilgrim') {
          const pid = chatTargetPilgrimId ?? (pilgrims[0]?.id ?? null);
          if (!pid) return;
          url += `?pilgrimId=${pid}`;
        }
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = data.map((m: any) => ({ id: m.id, from: m.sender || m.from, message: m.message, date: m.timestamp ? new Date(m.timestamp).toLocaleString() : (m.date || ''), fileUrl: m.fileUrl, fileType: m.fileType, pilgrimId: m.pilgrimId, agentId: m.agentId }));
        mapped.forEach((m: any) => receivedMessageIdsRef.current.add(Number(m.id)));
        setChatMessagesInt(mapped);
      } catch (e) { /* ignore */ }
    };
    fetchHistory();
    // The real-time updates will arrive via the agent-level EventSource (see effect below)
    return () => { setChatMessagesInt([]); };
  }, [openChat, chatTargetPilgrimId, pilgrims]);

  // Notification state
  const [notifications, setNotifications] = useState([
    { id: 1, type: "task", message: "New task assigned: Review documents" },
    { id: 2, type: "message", message: "New message from Admin" },
    { id: 3, type: "document", message: "Document status updated" }
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Profile & Settings state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profile, setProfile] = useState({ name: "Agent Smith", email: "agent@demo.com" });
  const [password, setPassword] = useState("");

  // Bulk Actions state
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);

  // Activity Log state
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // helper to post activity entries to backend
  const logActivity = async (userId: number | null, userType: string, action: string, details?: string) => {
    try {
      await fetch(`${API_BASE_URL}/activity-log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 0, userType, action, details: details || '' })
      });
    } catch (e) { /* ignore logging failures */ }
  };

  const fetchActivityLog = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/activity-log`);
      if (!res.ok) { setActivityLog([]); return; }
      const data = await res.json();
      setActivityLog(data || []);
    } catch (e) { setActivityLog([]); }
  };

  // Register/Edit Pilgrim modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPilgrim, setEditPilgrim] = useState<any>(null);
  const [registerInitialData, setRegisterInitialData] = useState<any>(null);

  // Fetch agent and pilgrims on mount
  useEffect(() => {
    // Use logged-in agent id from localStorage
    const agentId = Number(localStorage.getItem('agent_id') || '0') || null;
    const token = localStorage.getItem('agent_token');
    const authHeaders = token ? { headers: { 'Authorization': `Bearer ${token}` } } : {};
    if (!agentId) {
      // if no agent id stored, redirect to login
      navigate('/agent-login');
      return;
    }
    setDocLoading(true);
  fetch(`${API_BASE_URL}/agents/${agentId}`, authHeaders)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch agent');
        return res.json();
      })
      .then(data => setAgentData({
        ...data,
        totalPilgrims: data.pilgrims || 0,
        pendingRegistrations: 0,
        completedToday: 0
      }))
      .catch(() => {
        // Enhanced fallback demo agent
        setAgentData({
          id: agentId,
          name: "Esther Okafor",
          email: "esther.okafor@pilgrimsdemo.com",
          phone: "+234 801 234 5678",
          role: "Senior Pilgrimage Agent",
          totalPilgrims: 12,
          pendingRegistrations: 3,
          completedToday: 2,
          avatar: pilgrimIcon,
          agency: "Grace Travels Ltd.",
          location: "Lagos, Nigeria"
        });
      });
    // Fetch only pilgrims assigned to this agent (include token as query param for SSE and for servers that don't accept Authorization header)
    const pilgrimsUrl = `${API_BASE_URL}/pilgrims?agentId=${agentId}`;
    const headers = token ? { headers: { 'Authorization': `Bearer ${token}` } } : {};
    fetch(pilgrimsUrl, headers)
      .then(res => res.json())
      .then(data => {
        try {
          const normalized = data.map((p: any) => ({ ...p, registrationDate: p.registrationDate || p.date || null }));
          normalized.sort((a: any, b: any) => {
            const da = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
            const db = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
            if (db !== da) return db - da;
            return (b.id || 0) - (a.id || 0);
          });
          setPilgrims(normalized);
          setAgentData(prev => ({ ...prev, totalPilgrims: normalized.length }));
        } catch (e) {
          setPilgrims(data || []);
        }
      })
      .catch(() => {
        setPilgrims([]);
      });
    setDocLoading(false);
  }, [navigate, token]);

  // fetch activity log
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/activity-log`);
        if (!res.ok) { setActivityLog([]); return; }
        const data = await res.json();
        setActivityLog(data || []);
      } catch (e) {
        setActivityLog([]);
      }
    })();
  }, []);

  // Use SSE for messages for the selected pilgrim; do an initial fetch for history
  useEffect(() => {
    // Cleanup any previous pilgrim EventSource
    if (pilgrimEventSourceRef.current) {
      try { pilgrimEventSourceRef.current.close(); } catch (e) {}
      pilgrimEventSourceRef.current = null;
    }
    if (!selectedPilgrim) {
      setMessages([]);
      return;
    }
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/messages?pilgrimId=${selectedPilgrim.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = data.map((m: any) => ({
          id: m.id,
          pilgrimId: m.pilgrimId,
          from: m.sender || m.from,
          message: m.message,
          date: m.timestamp ? new Date(m.timestamp).toLocaleString() : (m.date || ''),
          fileUrl: m.fileUrl,
          fileType: m.fileType,
          read: m.read || false
        }));
        mapped.forEach((m: any) => receivedMessageIdsRef.current.add(Number(m.id)));
        setMessages(mapped);
      } catch (e) { /* ignore */ }
    };
    fetchHistory();

    // Open SSE for this pilgrim so incoming messages are real-time
    try {
  const token = localStorage.getItem('agent_token');
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const es = new EventSource(`${API_BASE_URL}/messages/stream?pilgrimId=${selectedPilgrim.id}${tokenParam}`);
      es.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (!m || !m.id) return;
          if (receivedMessageIdsRef.current.has(Number(m.id))) return;
          receivedMessageIdsRef.current.add(Number(m.id));
          const uiMsg = {
            id: m.id,
            pilgrimId: m.pilgrimId,
            from: m.sender || m.from,
            message: m.message,
            date: m.timestamp ? new Date(m.timestamp).toLocaleString() : '',
            fileUrl: m.fileUrl,
            fileType: m.fileType,
            read: false
          };
          setMessages(prev => [...prev, uiMsg]);
        } catch (e) { /* ignore parse errors */ }
      };
      es.onerror = (err) => {
        // close on error; EventSource will try to reconnect by default
        try { es.close(); } catch (e) {}
      };
      pilgrimEventSourceRef.current = es;
    } catch (e) {
      // ignore SSE creation errors
    }

    return () => {
      if (pilgrimEventSourceRef.current) try { pilgrimEventSourceRef.current.close(); } catch (e) {}
      pilgrimEventSourceRef.current = null;
    };
  }, [selectedPilgrim]);

  // Agent-level SSE: subscribe to agent stream once agentData is available to receive incoming messages directed to this agent
  useEffect(() => {
    if (!agentData?.id) return;
    // Cleanup previous
    if (agentEventSourceRef.current) try { agentEventSourceRef.current.close(); } catch (e) {}
    try {
      const agentId = agentData.id;
  const token = localStorage.getItem('agent_token');
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const es = new EventSource(`${API_BASE_URL}/messages/stream?agentId=${agentId}${tokenParam}`);
      es.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (!m || !m.id) return;
          if (receivedMessageIdsRef.current.has(Number(m.id))) return;
          receivedMessageIdsRef.current.add(Number(m.id));
          const uiMsg = {
            id: m.id,
            pilgrimId: m.pilgrimId,
            agentId: m.agentId,
            from: m.sender || m.from,
            message: m.message,
            date: m.timestamp ? new Date(m.timestamp).toLocaleString() : '',
            fileUrl: m.fileUrl,
            fileType: m.fileType,
            read: false
          };
          // If currently viewing this pilgrim, append to that view; otherwise append to integrated chat when appropriate
          if (selectedPilgrim && m.pilgrimId && Number(m.pilgrimId) === Number(selectedPilgrim.id)) {
            setMessages(prev => [...prev, uiMsg]);
          } else if (openChat) {
            // For integrated chat UI, only append messages that match the openChat target
            if (openChat === 'pilgrim') {
              const targetPid = chatTargetPilgrimId ?? pilgrims[0]?.id ?? null;
              if (targetPid && Number(m.pilgrimId) === Number(targetPid)) setChatMessagesInt(prev => [...prev, uiMsg]);
            } else {
              setChatMessagesInt(prev => [...prev, uiMsg]);
            }
          }
        } catch (e) { /* ignore */ }
      };
      es.onerror = (err) => {
        try { es.close(); } catch (e) {}
      };
      agentEventSourceRef.current = es;
    } catch (e) {
      // ignore
    }
    return () => { if (agentEventSourceRef.current) try { agentEventSourceRef.current.close(); } catch (e) {} };
  }, [agentData?.id, openChat, chatTargetPilgrimId, selectedPilgrim, pilgrims]);

  // Documents SSE for agent: receive real-time document uploads related to this agent
  useEffect(() => {
    if (!agentData?.id) return;
    // cleanup previous
    if (documentsEventSourceRef.current) try { documentsEventSourceRef.current.close(); } catch (e) {}
    try {
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const url = `${API_BASE_URL}/documents/stream?agentId=${agentData.id}${tokenParam}`;
      const es = new EventSource(url);
      es.onmessage = async (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (!payload || payload.type !== 'document' || !payload.document) return;
          // safer: re-fetch documents for this agent (backend will filter by agent token)
          const res = await fetch(`${API_BASE_URL}/documents`, fetchOptions);
          if (res.ok) {
            const docs = await res.json();
            // only show documents for this agent's pilgrims
            const pilgrimIds = pilgrims.map(p => p.id);
            setDocuments((docs || []).filter((d: any) => pilgrimIds.includes(d.pilgrimId)));
          }
          toast({ title: 'New Document', description: `${payload.document.name} uploaded by Pilgrim #${payload.document.pilgrimId}` });
          fetchActivityLog();
        } catch (e) { /* ignore parse errors */ }
      };
      es.onerror = (err) => { try { es.close(); } catch (e) {} };
      documentsEventSourceRef.current = es;
    } catch (e) {
      // ignore SSE errors
    }
    return () => { if (documentsEventSourceRef.current) try { documentsEventSourceRef.current.close(); } catch (e) {} documentsEventSourceRef.current = null; };
  }, [agentData?.id, pilgrims, token, toast]);

  // Fetch documents for agent's pilgrims
  useEffect(() => {
    if (!agentData || !pilgrims.length) return;
    setDocLoading(true);
    const tokenLocal = token;
    const headers = tokenLocal ? { headers: { 'Authorization': `Bearer ${tokenLocal}` } } : {};
    fetch(`${API_BASE_URL}/documents`, headers)
      .then(res => res.json())
      .then(data => {
        const pilgrimIds = pilgrims.map((p: any) => p.id);
        setDocuments(data.filter((doc: any) => pilgrimIds.includes(doc.pilgrimId)));
        setDocLoading(false);
      })
      .catch(() => setDocLoading(false));
  }, [agentData, pilgrims, token]);
  // Utility to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "default";
      case "Pending Documents": return "outline";
      case "Payment Confirmed": return "secondary";
      case "Pending": return "outline";
      case "Approved": return "default";
      case "Rejected": return "destructive";
      default: return "secondary";
    }
  };

  // Document status handler
  const handleDocumentStatus = async (docId: number, status: string) => {
    setDocLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/documents/${docId}` , {
        method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, status } : doc));
        toast({ title: `Document ${status}`, description: `Document has been marked as ${status}.` });
  // log activity
  await logActivity(agentData?.id || null, 'agent', `Document ${status}`, `Document ${docId} marked ${status}`);
  fetchActivityLog();
      } else {
        toast({ title: 'Error', description: 'Failed to update document status.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update document status.' });
    }
    setDocLoading(false);
  };

  // NIN search handler (mock)
  const handleNINSearch = async () => {
    setIsSearching(true);
    setTimeout(() => {
      const results = ["not-registered", "registered-other", "banned"];
      const randomResult = results[Math.floor(Math.random() * results.length)];
      setSearchResults(randomResult);
      setIsSearching(false);
    }, 1000);
  };

  // Register now handler (mock)
  const handleRegisterNow = () => {
    toast({ title: "Registration", description: "Proceeding to payment..." });
  };

  // Take over registration handler (mock)
  const handleTakeOverRegistration = async () => {
    // open the register modal prefilled with the selected pilgrim or search input
    const initial = selectedPilgrim ? { name: selectedPilgrim.name, passportNumber: selectedPilgrim.passportNumber || '' } : { name: searchNIN || 'vic', passportNumber: searchNIN || '' };
    setRegisterInitialData(initial);
    setShowRegisterModal(true);
  };
  const handleAppealBan = async () => {
    toast({
      title: "Appeal Submitted",
      description: "Ban appeal has been submitted to administrators for review.",
    });
    setSearchResults(null);
    setSearchNIN("");
  };

  // Filtered documents for search/filter UI (defensive: guard against missing fields)
  const normalizedDocSearch = (docSearch || '').toString().toLowerCase();
  const filteredDocuments = documents.filter((doc) => {
    const pilgrim = pilgrims.find((p) => p.id === doc.pilgrimId);
    const docName = (doc?.name || doc?.fileName || '').toString().toLowerCase();
    const pilgrimName = (pilgrim?.name || '').toString().toLowerCase();
    const matchesSearch = docName.includes(normalizedDocSearch) || pilgrimName.includes(normalizedDocSearch);
    const matchesStatus = docStatusFilter ? doc.status === docStatusFilter : true;
    return matchesSearch && matchesStatus;
  });
  // Utility to get pilgrim name by id
  const getPilgrimName = (id: number) => {
    const pilgrim = pilgrims.find((p) => p.id === id);
    return pilgrim ? pilgrim.name : "Unknown";
  };

  // Export Data handler
  const handleExport = () => {
    // Simulate export
    alert("Agent data exported as CSV!");
  };

  return (
    <>
      {agentData === null ? (
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-muted-foreground text-lg">Loading agent data...</span>
        </div>
      ) : agentData === undefined ? (
        <div className="flex items-center justify-center min-h-screen">
          <span className="text-destructive text-lg">Unable to load agent data. Please check your connection or try again later.</span>
        </div>
      ) : (
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="bg-card border-b border-border shadow-card">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <img 
                    src={pilgrimIcon} 
                    alt="Pilgrim Management System" 
                    className="h-10 w-10 rounded-lg shadow-card"
                  />
                  <div>
                    <h1 className="text-xl font-heading font-bold text-foreground">
                      Agent Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">{agentData.name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="sm">
                    <Bell className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('agent_token'); navigate('/agent-login'); }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <div className="container mx-auto px-4 sm:px-6 py-8">
            <div className="grid gap-6 lg:gap-8">
              {/* Statistics Cards */}
              <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
                {/* Total Pilgrims */}
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Pilgrims</p>
                        <p className="text-3xl font-bold text-foreground">{agentData.totalPilgrims}</p>
                      </div>
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                {/* Pending */}
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pending</p>
                        <p className="text-3xl font-bold text-warning">{agentData.pendingRegistrations ?? 0}</p>
                      </div>
                      <Loader2 className="h-8 w-8 text-warning" />
                    </div>
                  </CardContent>
                </Card>
                {/* Completed Today */}
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                        <p className="text-3xl font-bold text-success">{agentData.completedToday ?? 0}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-success" />
                    </div>
                  </CardContent>
                </Card>
                {/* This Month */}
                <Card className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">This Month</p>
                        <p className="text-3xl font-bold text-primary">43</p>
                      </div>
                      <Calendar className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Actions */}
              <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
                {/* Document Management */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <FileText className="mr-2 h-5 w-5 text-primary" />
                        Document Management
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Review, approve, reject, and download documents for your assigned pilgrims
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <Input
                        placeholder="Search by pilgrim name or document type..."
                        value={docSearch}
                        onChange={e => setDocSearch(e.target.value)}
                        className="sm:w-1/3"
                      />
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={docStatusFilter}
                        onChange={e => setDocStatusFilter(e.target.value)}
                      >
                        <option value="">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    {docLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        {filteredDocuments.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">No documents uploaded yet.</div>
                        )}
                        {filteredDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-foreground">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">Pilgrim: {getPilgrimName(doc.pilgrimId)}</p>
                              <p className="text-xs text-muted-foreground">Uploaded: {doc.date}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={doc.status === 'Approved' ? 'default' : doc.status === 'Rejected' ? 'destructive' : 'outline'}>{doc.status}</Badge>
                              {doc.fileUrl && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title="Download Document"
                                  onClick={() => {
                                    const normalize = (u: string) => {
                                      if (!u) return u;
                                      if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:')) return u;
                                      return `${API_BASE_URL.replace(/\/$/, '')}${u.startsWith('/') ? u : `/${u}`}`;
                                    };
                                    const link = document.createElement('a');
                                    link.href = normalize(doc.fileUrl);
                                    link.download = doc.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                >
                                  <Download className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={doc.status === 'Approved' || docLoading}
                                onClick={() => handleDocumentStatus(doc.id, 'Approved')}
                              >Approve</Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={doc.status === 'Rejected' || docLoading}
                                onClick={() => handleDocumentStatus(doc.id, 'Rejected')}
                              >Reject</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {/* Register New Pilgrim */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <UserPlus className="mr-2 h-5 w-5 text-primary" />
                      Register New Pilgrim
                    </CardTitle>
                    <CardDescription>
                      Search by SSN or International Passport Number to begin Christian pilgrimage registration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Enter SSN or Passport Number"
                        value={searchNIN}
                        onChange={(e) => setSearchNIN(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleNINSearch} 
                        disabled={!searchNIN || isSearching} 
                        className="sm:w-auto"
                      >
                        <Search className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">
                          {isSearching ? "Searching..." : "Search"}
                        </span>
                      </Button>
                    </div>

                    {/* Search Results */}
                    {searchResults && (
                      <div className="p-4 border rounded-lg bg-secondary/20">
                        {searchResults === "not-registered" && (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">Status: Not yet registered</p>
                            <Button onClick={handleRegisterNow} className="w-full bg-gradient-primary">
                              Register Now (Proceed to Payment)
                            </Button>
                          </div>
                        )}

                        {searchResults === "registered-other" && (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Status: Registration started with <strong>Holy Land Travel Agency</strong>
                            </p>
                            <Button onClick={handleTakeOverRegistration} variant="outline" className="w-full">
                              Take Over Registration
                            </Button>
                          </div>
                        )}

                        {searchResults === "banned" && (
                          <div className="space-y-3">
                            <p className="text-sm text-destructive">
                              Status: This pilgrim has been banned from Christian pilgrimage registration
                            </p>
                            <Button onClick={handleAppealBan} variant="outline" className="w-full">
                              Appeal Ban
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Pilgrims */}
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <Users className="mr-2 h-5 w-5 text-primary" />
                        Recent Pilgrims
                      </span>
                      <Button variant="outline" size="sm">View All</Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pilgrims.map((pilgrim) => (
                        <div key={pilgrim.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 cursor-pointer ${selectedPilgrim?.id === pilgrim.id ? 'bg-primary/10 border-primary' : ''}`}
                          onClick={() => setSelectedPilgrim(pilgrim)}
                        >
                          <div>
                            <p className="font-medium text-foreground">{pilgrim.name}</p>
                            <p className="text-sm text-muted-foreground">SSN: {pilgrim.nin}</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-2">
                            <StatusBadge variant={getStatusColor(pilgrim.status)}>
                              {pilgrim.status}
                            </StatusBadge>
                            <p className="text-xs text-muted-foreground">{pilgrim.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                  {/* Integrated Chat/Support for agents when no pilgrim selected */}
                  {!selectedPilgrim && (
                    <Card className="shadow-card mt-4">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <MessageCircle className="mr-2 h-5 w-5 text-primary" />
                          Integrated Chat/Support
                        </CardTitle>
                        <CardDescription>Direct chat with pilgrims or internal team</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 mb-3">
                          <Button variant="outline" size="sm" onClick={() => { setOpenChat('agent'); setChatMessagesInt([]); }}>Chat with Agent</Button>
                          <Button variant="outline" size="sm" onClick={() => { setOpenChat('pilgrim'); setChatMessagesInt([]); setChatTargetPilgrimId(pilgrims[0]?.id ?? null); }}>Chat with Pilgrim</Button>
                          <Button variant="outline" size="sm" onClick={() => { setOpenChat('admin'); setChatMessagesInt([]); }}>Internal Admin Chat</Button>
                        </div>
                        {openChat && (
                          <div>
                            {openChat === 'pilgrim' && (
                              <div className="mb-2">
                                <label className="text-sm mr-2">Select Pilgrim:</label>
                                <select value={chatTargetPilgrimId ?? ''} onChange={e => setChatTargetPilgrimId(Number(e.target.value))} className="border rounded px-2 py-1">
                                  {pilgrims.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              </div>
                            )}
                            <div ref={chatBoxRef} className="max-h-40 overflow-y-auto mb-2 space-y-1 bg-white rounded p-2">
                              {chatMessagesInt.length === 0 ? (
                                <div className="text-muted-foreground text-sm">No messages yet. Start the conversation!</div>
                              ) : (
                                chatMessagesInt.map((message, idx) => {
                                  const isMe = message.from === agentData?.name;
                                  return (
                                    <div key={message.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[70%] rounded-lg p-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-semibold text-xs">{isMe ? 'You' : message.from}</span>
                                          <span className="text-[10px] text-muted-foreground">{message.date}</span>
                                        </div>
                                        <div>{message.message}</div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <form className="flex items-center border-t bg-background px-2 py-2 gap-2" onSubmit={async (e) => {
                              e.preventDefault();
                              if (!chatInput.trim() && !attachment) return;
                              setUploading(true);
                              let fileUrl = null;
                              let fileType = null;
                              if (attachment) {
                                try {
                                  const formData = new FormData();
                                  formData.append('file', attachment);
                            const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
                                  const data = await res.json();
                                  fileUrl = data.fileUrl;
                                } catch (err) {
                                  toast({ title: 'Upload failed', description: 'Could not upload file.', variant: 'destructive' });
                                  setUploading(false);
                                  return;
                                }
                                fileType = attachment.type.startsWith('image') ? 'image' : (attachment.type === 'application/pdf' ? 'pdf' : null);
                              }
                              const targetPilgrimId = chatTargetPilgrimId ?? selectedPilgrim?.id ?? (pilgrims[0]?.id ?? 1);
                              const payload = {
                                pilgrimId: targetPilgrimId,
                                sender: agentData?.name || 'Agent',
                                message: chatInput,
                                fileUrl: fileUrl || null,
                                fileType: fileType || null
                              };
                          const resp = await fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                              if (resp.ok) {
                                setChatInput(''); setAttachment(null); setUploading(false);
                                setChatMessagesInt(prev => [...prev, { ...{
                                  id: Date.now(), from: payload.sender, message: payload.message, date: new Date().toLocaleString(), fileUrl: payload.fileUrl, fileType: payload.fileType
                                }}]);
                              } else {
                                setUploading(false); toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
                              }
                            }}>
                              <input className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring" placeholder="Type your message..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={uploading} />
                              <label className="cursor-pointer flex items-center">
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { if (e.target.files && e.target.files[0]) setAttachment(e.target.files[0]); }} disabled={uploading} />
                                <Paperclip className="h-5 w-5 text-muted-foreground" />
                              </label>
                              {attachment && <span className="text-xs text-muted-foreground ml-1">{attachment.name}</span>}
                              <Button type="submit" size="sm" disabled={uploading}>{uploading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Send'}</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => { setOpenChat(''); setChatMessagesInt([]); }}>Close</Button>
                            </form>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                {/* Chat with selected pilgrim */}
                {selectedPilgrim && (
                  <Card className="shadow-card flex flex-col h-[400px] mt-8">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MessageCircle className="mr-2 h-5 w-5 text-primary" />
                        Chat with {selectedPilgrim.name}
                      </CardTitle>
                      <CardDescription>Real-time messaging with this pilgrim</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0">
                      <div ref={chatBoxRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-muted rounded-t">
                        {messages.length === 0 && (
                          <div className="text-center text-muted-foreground mt-8">No messages yet. Start the conversation!</div>
                        )}
                        {messages.map((message) => {
                          const isMe = message.from === agentData.name;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[70%] px-3 py-2 rounded-lg shadow text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground border'} `}>
                                <div className="flex items-center mb-1">
                                  <span className="font-semibold text-xs mr-2">{isMe ? 'You' : message.from}</span>
                                  <span className="text-[10px] text-muted-foreground">{message.date}</span>
                                </div>
                                <div>{message.message}</div>
                                {message.fileUrl && message.fileType === 'image' && (
                                  <img src={message.fileUrl} alt="attachment" className="mt-2 max-h-32 rounded border" />
                                )}
                                {message.fileUrl && message.fileType === 'pdf' && (
                                  <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 underline block">View PDF Attachment</a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <form
                        className="flex items-center border-t bg-background px-2 py-2 gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!chatInput.trim() && !attachment) return;
                          setUploading(true);
                          let fileUrl = null;
                          let fileType = null;
                          if (attachment) {
                            // Upload file to backend
                            try {
                              const formData = new FormData();
                              formData.append('file', attachment);
                              const res = await fetch(`${API_BASE_URL}/upload`, {
                                method: 'POST',
                                body: formData
                              });
                              const data = await res.json();
                              fileUrl = data.fileUrl;
                            } catch (e) {
                              toast({ title: 'Upload failed', description: 'Could not upload file.', variant: 'destructive' });
                              setUploading(false);
                              return;
                            }
                            fileType = attachment.type.startsWith('image') ? 'image' : (attachment.type === 'application/pdf' ? 'pdf' : null);
                          }
                          const payload = {
                            pilgrimId: selectedPilgrim.id,
                            sender: agentData.name,
                            message: chatInput,
                            fileUrl: fileUrl || null,
                            fileType: fileType || null
                          };
                          const res = await fetch(`${API_BASE_URL}/messages`, {

                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                          });
                          if (res.ok) {
                            setChatInput("");
                            setAttachment(null);
                            setUploading(false);
                            // Append a UI-friendly message object
                            const uiMessage = {
                              id: Date.now(),
                              pilgrimId: selectedPilgrim.id,
                              from: agentData.name,
                              message: payload.message,
                              date: new Date().toLocaleString(),
                              fileUrl: payload.fileUrl,
                              fileType: payload.fileType,
                              read: false
                            };
                            setMessages(prev => [...prev, uiMessage]);
                          } else {
                            setUploading(false);
                            toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
                          }
                        }}
                      >
                        <input
                          className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring"
                          placeholder="Type your message..."
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          disabled={uploading}
                        />
                        <label className="cursor-pointer flex items-center">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) setAttachment(e.target.files[0]);
                            }}
                            disabled={uploading}
                          />
                          <Paperclip className="h-5 w-5 text-muted-foreground" />
                        </label>
                        {attachment && (
                          <span className="text-xs text-muted-foreground ml-1">{attachment.name}</span>
                        )}
                        <Button type="submit" size="sm" disabled={uploading}>{uploading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Send'}</Button>
                      </form>
                      {/* Typing indicator */}
                      {isPilgrimTyping && (
                        <div className="px-4 pb-2 text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="animate-spin h-3 w-3" /> {selectedPilgrim.name} is typing...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Agent Overview - New Section */}
              <div className="grid gap-6 lg:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {/* Agent Calendar */}
                <AgentCalendar />
                {/* Task Management */}
                <AgentTaskManager />
                {/* Performance Analytics */}
                {agentData && <AgentPerformanceAnalytics stats={{
                  totalPilgrims: agentData.totalPilgrims || 0,
                  approvals: agentData.approvals || 0,
                  revenue: agentData.revenue || 0
                }} />}
                {/* Document Center */}
                {/* Document Center - Bulk Actions version only */}
              </div>
            </div>
          </div>

          {/* Notifications & Profile/Settings - repositioned to avoid overlap */}
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
            <Button variant="outline" size="icon" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowProfileModal(true)}>
              <Settings className="h-5 w-5" />
            </Button>
            {showNotifications && (
              <div className="bg-card p-4 rounded shadow-lg w-80 mt-2">
                <h3 className="font-bold mb-2">Notifications</h3>
                <ul className="space-y-2">
                  {notifications.map(n => (
                    <li key={n.id} className="text-sm">{n.message}</li>
                  ))}
                </ul>
                <Button size="sm" className="mt-2" onClick={() => setShowNotifications(false)}>Close</Button>
              </div>
            )}
            {showProfileModal && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-card p-6 rounded shadow-lg w-full max-w-md relative">
                  <Button size="sm" className="absolute top-2 right-2" onClick={() => setShowProfileModal(false)}>Close</Button>
                  <h3 className="font-bold mb-2">Profile & Settings</h3>
                  <input className="w-full border rounded px-2 py-1 mb-2" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Name" />
                  <input className="w-full border rounded px-2 py-1 mb-2" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="Email" />
                  <input className="w-full border rounded px-2 py-1 mb-2" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Change Password" />
                  <Button size="sm" onClick={() => setShowProfileModal(false)}>Save</Button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk Actions for Document Center */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Document Center
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Input
                  placeholder="Search documents..."
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={() => setDocSearch(docSearch)}>
                  <Search className="h-4 w-4" />
                  Search
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedDocs([])} disabled={selectedDocs.length === 0}>Clear Selection</Button>
                <Button size="sm" variant="default" onClick={() => selectedDocs.forEach(id => handleDocumentStatus(id, 'Approved'))} disabled={selectedDocs.length === 0}>Approve Selected</Button>
                <Button size="sm" variant="destructive" onClick={() => selectedDocs.forEach(id => handleDocumentStatus(id, 'Rejected'))} disabled={selectedDocs.length === 0}>Reject Selected</Button>
              </div>
              <ul className="space-y-2">
                {filteredDocuments.map(doc => (
                  <li key={doc.id} className="p-2 rounded bg-secondary/30 flex items-center gap-2">
                    <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={e => {
                      if (e.target.checked) setSelectedDocs([...selectedDocs, doc.id]);
                      else setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                    }} />
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{doc.fileName}</span>
                    <Badge variant="outline">{doc.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => {
                      const normalize = (u: string | undefined | null) => {
                        if (!u) return null;
                        if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:')) return u;
                        return `${API_BASE_URL.replace(/\/$/, '')}${u.startsWith('/') ? u : `/${u}`}`;
                      };
                      const target = normalize(doc.fileUrl) || (doc.fileName ? normalize(`/uploads/${doc.fileName}`) : null) || (doc.id ? `${API_BASE_URL}/documents/${doc.id}` : null);
                      if (target) window.open(target, '_blank');
                    }}>Preview</Button>
                  </li>
                ))}
                {filteredDocuments.length === 0 && <li className="text-muted-foreground">No documents found.</li>}
              </ul>
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {activityLog.map(log => (
                  <li key={log.id} className="p-2 rounded bg-secondary/30 flex items-center gap-2">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-xs text-muted-foreground">{log.date}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Export Data */}
          <Button size="sm" variant="outline" className="mt-4" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export Data
          </Button>

          {/* Register Pilgrim Modal */}
          {showRegisterModal && (
            <RegisterPilgrimModal
              agentId={agentData?.id}
              agentName={agentData?.name}
              onRegistered={() => {
                // Refresh pilgrims list after registration
                fetch(`${API_BASE_URL}/pilgrims?agentId=${agentData?.id}`)
                  .then(res => res.json())
                  .then(data => setPilgrims(data));
              }}
              initialData={registerInitialData}
              onClose={() => { setShowRegisterModal(false); setRegisterInitialData(null); }}
            />
          )}

          {/* Edit Pilgrim Modal */}
          {showEditModal && editPilgrim && (
            <EditPilgrimModal
              pilgrim={editPilgrim}
              onUpdated={() => {
                // Refresh pilgrims list after update
                fetch(`${API_BASE_URL}/pilgrims?agentId=${agentData?.id}`)
                  .then(res => res.json())
                  .then(data => setPilgrims(data));
              }}
              onClose={() => { setShowEditModal(false); setEditPilgrim(null); }}
            />
          )}
        </div>
      )}
    </>
  );
};
export default AgentDashboard;