import { useState, useEffect } from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Users, 
  FileText, 
  LogOut, 
  Bell,
  TrendingUp,
  UserCheck,
  Ban,
  RefreshCw,
  DollarSign,
  MessageCircle,
  Paperclip,
  Loader2,
  Download
} from "lucide-react";
import pilgrimIcon from "@/assets/pilgrim-icon.jpg";
import AddAgentModal from "./AddAgentModal";
import Calendar from "./Calendar";
import { useToast } from "@/hooks/use-toast";
import ViewPilgrimsModal from "./ViewPilgrimsModal";
import ManageBansModal from "./ManageBansModal";
import SystemReportsModal from "./SystemReportsModal";
import EditPilgrimModal from "./EditPilgrimModal";
import { API_BASE_URL } from "@/lib/api";

const AdminDashboard = () => {
  const [settingsModal, setSettingsModal] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState(API_BASE_URL);
  const [theme, setTheme] = useState("light");

  const { toast } = useToast();
  const navigate = useNavigate();

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin-login");
      return;
    }
    document.body.classList.remove("theme-light", "theme-dark", "theme-gold");
    document.body.classList.add(`theme-${theme}`);
  }, [theme, navigate]);

  const [securityOption, setSecurityOption] = useState(false);
  const [profileModal, setProfileModal] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [allPilgrims, setAllPilgrims] = useState([]);
  // Safe fetch helper to avoid parsing HTML error pages as JSON
  const fetchJsonSafe = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      try {
        return await res.json();
      } catch (e) {
        return null;
      }
    } catch (e) {
      return null;
    }
  };
  const [takeoverRequests, setTakeoverRequests] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, bannedPilgrims: 0, activeRegistrations: 0 });
  const [showPilgrimsModal, setShowPilgrimsModal] = useState(false);
  const [showBansModal, setShowBansModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [docLoading, setDocLoading] = useState(false);
    const [activities, setActivities] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activitySearch, setActivitySearch] = useState("");
    const [adminRole, setAdminRole] = useState("superadmin");
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
  const [openChat, setOpenChat] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isTargetTyping, setIsTargetTyping] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [selectedChatPilgrimId, setSelectedChatPilgrimId] = useState<number | null>(null);
  const [selectedChatAgentId, setSelectedChatAgentId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPilgrim, setEditPilgrim] = useState<any>(null);
  useEffect(() => {
    // Fetch notifications (new documents, takeover requests)
      const fetchNotifications = async () => {
        // backend exposes /documents (no server-side status filter implemented), so fetch all and filter client-side
        const allDocs = await fetchJsonSafe(`${API_BASE_URL}/documents`);
        const takeoverReqs = await fetchJsonSafe(`${API_BASE_URL}/takeoverRequests`);
        const pendingDocs = (allDocs || []).filter((doc: any) => (doc.status || '').toString().toLowerCase() === 'pending');
        const docAlerts = pendingDocs.map((doc: any) => ({
          type: 'document',
          message: `New document uploaded by ${doc.pilgrimId ? 'Pilgrim #' + doc.pilgrimId : doc.agentId ? 'Agent #' + doc.agentId : 'Unknown'}`,
          date: doc.date
        }));
        const takeoverAlerts = (takeoverReqs || []).map((req: any) => ({
          type: 'takeover',
          message: `New takeover request for Pilgrim: ${req.pilgrimName || req.pilgrimId || 'Unknown'}`,
          date: req.date
        }));
        // combine and sort newest-first by date if available
        const combined = [...docAlerts, ...takeoverAlerts].sort((a: any, b: any) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });
        setNotifications(combined);
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // poll every 10s
      return () => clearInterval(interval);
    }, []);

    const handleDocumentStatus = async (docId, status) => {
      setDocLoading(true);
      try {
  const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) {
          setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, status } : doc));
          toast({ title: `Document ${status}`, description: 'Document status has been updated.' });
        } else {
          toast({ title: 'Error', description: 'Failed to update document status.', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to update document status.', variant: 'destructive' });
      } finally {
        setDocLoading(false);
      }
    };

  // fetch activities helper so we can refresh after actions
  const fetchActivities = async () => {
    const acts = await fetchJsonSafe(`${API_BASE_URL}/activity-log`);
    setActivities(acts || []);
  };

  // SSE for activity log
  useEffect(() => {
    let es: EventSource | null = null;
    const receivedIds = new Set();
    try {
      es = new EventSource(`${API_BASE_URL}/activity-log/stream`);
      es.onmessage = (ev) => {
        try {
          const a = JSON.parse(ev.data);
          if (!a || !a.id) return;
          if (receivedIds.has(a.id)) return;
          receivedIds.add(a.id);
          setActivities(prev => [a, ...prev]);
        } catch (e) { /* ignore */ }
      };
      es.onerror = () => { try { es && es.close(); } catch (e) {} };
    } catch (e) {
      // ignore
    }
    return () => { if (es) try { es.close(); } catch (e) {} };
  }, []);

  // SSE for document events (admin: global)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_BASE_URL}/documents/stream?agentId=0`); // admin opens a global-ish stream; backend allows agentId or pilgrimId - agentId=0 used as wildcard here
      es.onmessage = async (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (!payload || payload.type !== 'document' || !payload.document) return;
          // safer: re-fetch authoritative documents list
          const docs = await fetchJsonSafe(`${API_BASE_URL}/documents`);
          setDocuments(docs || []);
          // notify admins
          setNotifications(prev => [{ type: 'document', message: `New document uploaded by Pilgrim #${payload.document.pilgrimId}`, date: payload.document.date }, ...prev]);
        } catch (e) { /* ignore */ }
      };
      es.onerror = () => { try { es && es.close(); } catch (e) {} };
    } catch (e) {
      // ignore
    }
    return () => { if (es) try { es.close(); } catch (e) {} };
  }, []);

  useEffect(() => {
    (async () => {
      const fetchedAgents = await fetchJsonSafe(`${API_BASE_URL}/agents`);
      setAgents(fetchedAgents || []);

      const pilgrims = await fetchJsonSafe(`${API_BASE_URL}/pilgrims`);
      setAllPilgrims(pilgrims || []);

      const takeovers = await fetchJsonSafe(`${API_BASE_URL}/takeoverRequests`);
      setTakeoverRequests(takeovers || []);

      const s = await fetchJsonSafe(`${API_BASE_URL}/stats`);
      setStats(s || { totalRevenue: 0, bannedPilgrims: 0, activeRegistrations: 0 });

      // initial activity fetch
      fetchActivities();
    })();
  }, []);

  // Use Server-Sent Events for admin chat (real-time) instead of polling
  useEffect(() => {
    if (!openChat) return;
    let es: EventSource | null = null;

    const doInitialFetch = async () => {
      try {
        let url = `${API_BASE_URL}/messages`;
        if (openChat === 'pilgrim') {
          if (!selectedChatPilgrimId) return;
          url += `?pilgrimId=${selectedChatPilgrimId}`;
        } else if (openChat === 'agent') {
          if (!selectedChatAgentId) return;
          url += `?agentId=${selectedChatAgentId}`;
        }
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = data.map((m: any) => ({ id: m.id, from: m.sender || m.from, message: m.message, date: m.timestamp ? new Date(m.timestamp).toLocaleString() : (m.date || ''), fileUrl: m.fileUrl, fileType: m.fileType }));
        setChatMessages(mapped);
      } catch (e) {
        // ignore
      }
    };

    const startSSE = () => {
      try {
        let streamUrl = `${API_BASE_URL}/messages/stream`;
        if (openChat === 'pilgrim') streamUrl += `?pilgrimId=${selectedChatPilgrimId}`;
        else if (openChat === 'agent') streamUrl += `?agentId=${selectedChatAgentId}`;
        else streamUrl += ``; // admin team chat: no query

        es = new EventSource(streamUrl);
        es.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data);
            const mapped = { id: m.id, from: m.sender || m.from, message: m.message, date: m.timestamp ? new Date(m.timestamp).toLocaleString() : (m.date || ''), fileUrl: m.fileUrl, fileType: m.fileType };
            setChatMessages(prev => prev.find(p => p.id === mapped.id) ? prev : [...prev, mapped]);
          } catch (err) {
            // ignore parse errors
          }
        };
        es.onerror = (err) => {
          // If SSE fails, close and rely on initial fetch (no automatic backoff here)
          try { es && es.close(); } catch (e) {}
          es = null;
        };
      } catch (e) {
        // ignore
      }
    };

    // perform initial fetch then start SSE
    doInitialFetch().then(() => startSSE());

    return () => { if (es) try { es.close(); } catch (e) {} };
  }, [openChat, selectedChatPilgrimId, selectedChatAgentId]);

  // Dynamic admin data
  const adminStats = {
    totalAgents: agents.length,
    totalPilgrims: agents.reduce((sum: number, agent: any) => sum + (agent.pilgrims || 0), 0),
    pendingApprovals: takeoverRequests.length,
    totalRevenue: stats.totalRevenue,
    bannedPilgrims: stats.bannedPilgrims,
    activeRegistrations: stats.activeRegistrations
  };

  // Add Agent: POST to API
  const handleAddAgent = async (newAgent: any) => {
    try {
      // Backend expects a simple agent object: { name, email, password }
      const payload = {
        name: newAgent.name || newAgent.companyName || 'Unnamed Agency',
        email: newAgent.email,
        password: Math.random().toString(36).slice(2, 10)
      };
      const res = await fetch(`${API_BASE_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const created = await res.json();
        const createdAgent = { id: created.id, name: payload.name, email: payload.email, pilgrims: 0, joined: new Date().toISOString().split('T')[0] };
        setAgents(prev => [...prev, createdAgent]);
        toast({ title: 'Agent Added', description: 'New agent has been added.' });
      } else {
        const text = await res.text().catch(() => '');
        console.error('[ADD AGENT ERROR]', res.status, text);
        toast({ title: 'Error', description: 'Failed to add agent.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add agent.', variant: 'destructive' });
    }
  };

  // Approve an agent (set status to Active)
  const handleApproveAgent = async (agentId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Active' })
      });
      if (res.ok) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'Active' } : a));
        toast({ title: 'Agent Approved', description: 'Agent has been approved.' });
  try { await fetch(`${API_BASE_URL}/activity-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: agentId, userType: 'agent', action: 'Approved', details: 'Agent account approved by admin' }) }); await fetchActivities(); } catch (e) {}
      } else {
        toast({ title: 'Error', description: 'Failed to approve agent.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve agent.', variant: 'destructive' });
    }
  };

  // Deny an agent (set status to Denied)
  const handleDenyAgent = async (agentId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Denied' })
      });
      if (res.ok) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'Denied' } : a));
        toast({ title: 'Agent Denied', description: 'Agent has been denied.' });
  try { await fetch(`${API_BASE_URL}/activity-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: agentId, userType: 'agent', action: 'Denied', details: 'Agent account denied by admin' }) }); await fetchActivities(); } catch (e) {}
      } else {
        toast({ title: 'Error', description: 'Failed to deny agent.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to deny agent.', variant: 'destructive' });
    }
  };

  // Remove (delete) an agent account
  const handleRemoveAgent = async (agentId: number) => {
    if (!confirm('Are you sure you want to remove this agent account?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/agents/${agentId}`, { method: 'DELETE' });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== agentId));
        toast({ title: 'Agent Removed', description: 'Agent account has been removed.' });
  try { await fetch(`${API_BASE_URL}/activity-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: agentId, userType: 'agent', action: 'Removed', details: 'Agent account removed by admin' }) }); await fetchActivities(); } catch (e) {}
      } else {
        toast({ title: 'Error', description: 'Failed to remove agent.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove agent.', variant: 'destructive' });
    }
  };

  // Approve/Reject Takeover Request: DELETE from API
  const handleApproveRequest = async (requestId: number) => {
    try {
  const res = await fetch(`${API_BASE_URL}/takeoverRequests/${requestId}`, { method: 'DELETE' });
      if (res.ok) {
        setTakeoverRequests(prev => prev.filter(req => req.id !== requestId));
        toast({ title: 'Request Approved', description: 'Registration takeover request has been approved.' });
        // log activity
  try { await fetch(`${API_BASE_URL}/activity-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 0, userType: 'admin', action: 'Approved takeover request', details: `Request ${requestId}` }) }); await fetchActivities(); } catch (e) {}
      } else {
        toast({ title: 'Error', description: 'Failed to approve request.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve request.', variant: 'destructive' });
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
  const res = await fetch(`${API_BASE_URL}/takeoverRequests/${requestId}`, { method: 'DELETE' });
      if (res.ok) {
        setTakeoverRequests(prev => prev.filter(req => req.id !== requestId));
        toast({ title: 'Request Rejected', description: 'Registration takeover request has been rejected.', variant: 'destructive' });
  try { await fetch(`${API_BASE_URL}/activity-log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 0, userType: 'admin', action: 'Rejected takeover request', details: `Request ${requestId}` }) }); await fetchActivities(); } catch (e) {}
      } else {
        toast({ title: 'Error', description: 'Failed to reject request.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reject request.', variant: 'destructive' });
    }
  };

  // Suspend/Activate Agent: PATCH to API
  const handleAgentAction = async (agentId: number, action: string) => {
    const newStatus = action === 'suspend' ? 'Suspended' : 'Active';
    try {
  const res = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setAgents(prev => prev.map(agent => agent.id === agentId ? { ...agent, status: newStatus } : agent));
        toast({
          title: action === 'suspend' ? 'Agent Suspended' : 'Agent Activated',
          description: 'Agent status has been updated successfully.'
        });
      } else {
        toast({ title: 'Error', description: 'Failed to update agent status.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update agent status.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-card">
        <div className="container mx-auto px-6 py-2 flex justify-end">
          <label className="mr-2 text-sm font-medium">Role:</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={adminRole}
            onChange={e => setAdminRole(e.target.value)}
          >
            <option value="superadmin">Super Admin</option>
            <option value="moderator">Moderator</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>
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
                  Administrator Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">System-wide Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => setShowNotifications(!showNotifications)}>
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </Button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-64 bg-card border rounded shadow-lg z-10">
                    <div className="p-2 font-bold border-b">Notifications</div>
                    {notifications.length === 0 ? (
                      <div className="p-2 text-muted-foreground text-sm">No new notifications</div>
                    ) : (
                      notifications.map((n, idx) => (
                        <div key={idx} className="p-2 border-b text-sm">
                          <span className="font-medium">{n.message}</span>
                          <div className="text-xs text-muted-foreground">{n.date}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('admin_token'); navigate('/admin-login'); }}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-6 lg:gap-8">
          {/* Statistics Grid */}
          <div className="grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Agents</p>
                    <p className="text-3xl font-bold text-foreground">{adminStats.totalAgents}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Pilgrims</p>
                    <p className="text-3xl font-bold text-primary">{adminStats.totalPilgrims}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                    <p className="text-3xl font-bold text-warning">{adminStats.pendingApprovals}</p>
                  </div>
                  <RefreshCw className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold text-success">${adminStats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Banned</p>
                    <p className="text-3xl font-bold text-destructive">{adminStats.bannedPilgrims}</p>
                  </div>
                  <Ban className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Now</p>
                    <p className="text-3xl font-bold text-accent">{adminStats.activeRegistrations}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
            {/* Analytics Dashboard */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-primary" />
                  Analytics Dashboard
                </CardTitle>
                <CardDescription>
                  Visual charts for registrations, revenue, document status, and user activity trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Bar
                    data={{
                      labels: ['Registrations', 'Revenue', 'Approved Docs', 'Rejected Docs', 'Active Users'],
                      datasets: [
                        {
                          label: 'Count',
                          data: [adminStats.activeRegistrations, adminStats.totalRevenue, documents.filter(d => d.status === 'Approved').length, documents.filter(d => d.status === 'Rejected').length, agents.length],
                          backgroundColor: ['#3b82f6', '#10b981', '#6366f1', '#ef4444', '#f59e42'],
                        },
                      ],
                    }}
                    options={{ responsive: true, plugins: { legend: { display: false } } }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-primary" />
                  Bulk Actions
                </CardTitle>
                <CardDescription>
                  Approve/reject multiple documents, ban/unban users, or send bulk messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-2 font-semibold">Documents</div>
                <div className="space-y-2 mb-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={e => {
                        setSelectedDocs(e.target.checked ? [...selectedDocs, doc.id] : selectedDocs.filter(id => id !== doc.id));
                      }} />
                      <span>{doc.name} ({doc.status})</span>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mr-2" onClick={async () => {
                  for (const id of selectedDocs) await handleDocumentStatus(id, 'Approved');
                  setSelectedDocs([]);
                }}>Approve Selected</Button>
                <Button size="sm" variant="destructive" onClick={async () => {
                  for (const id of selectedDocs) await handleDocumentStatus(id, 'Rejected');
                  setSelectedDocs([]);
                }}>Reject Selected</Button>
                <div className="mt-4 mb-2 font-semibold">Agents</div>
                <div className="space-y-2 mb-4">
                  {agents.map(agent => (
                    <div key={agent.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedAgents.includes(agent.id)} onChange={e => {
                        setSelectedAgents(e.target.checked ? [...selectedAgents, agent.id] : selectedAgents.filter(id => id !== agent.id));
                      }} />
                      <span>{agent.name} ({agent.status})</span>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mr-2" onClick={async () => {
                  for (const id of selectedAgents) await handleAgentAction(id, 'activate');
                  setSelectedAgents([]);
                }}>Activate Selected</Button>
                <Button size="sm" variant="destructive" onClick={async () => {
                  for (const id of selectedAgents) await handleAgentAction(id, 'suspend');
                  setSelectedAgents([]);
                }}>Suspend Selected</Button>
                <Button size="sm" variant="outline" className="ml-4" onClick={() => {
                  setSelectedDocs([]); setSelectedAgents([]);
                }}>Clear Selection</Button>
              </CardContent>
            </Card>

            {/* Custom Reports Export */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-primary" />
                  Custom Reports Export
                </CardTitle>
                <CardDescription>
                  Export filtered data (CSV, PDF) for audits or presentations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="mr-2" onClick={() => {
                  // Export CSV
                  const csv = [
                    ['Name', 'Status', 'Type'],
                    ...documents.map(doc => [doc.name, doc.status, doc.pilgrimId ? 'Pilgrim' : doc.agentId ? 'Agent' : 'Unknown'])
                  ].map(row => row.join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'documents_report.csv';
                  link.click();
                }}>Export Documents as CSV</Button>
                <Button variant="outline" onClick={() => window.print()}>Export Page as PDF</Button>
              </CardContent>
            </Card>
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
            {/* User Profile Management */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserCheck className="mr-2 h-5 w-5 text-primary" />
                  User Profile Management
                </CardTitle>
                <CardDescription>
                  View and edit agent/pilgrim profiles, reset passwords, or update details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => { setProfileModal("view"); setSelectedProfile(null); }}>View Profiles</Button>
                  <Button variant="outline" size="sm" onClick={() => { setProfileModal("edit"); setSelectedProfile(null); }}>Edit Profile</Button>
                  <Button variant="outline" size="sm" onClick={() => { setProfileModal("reset"); setSelectedProfile(null); }}>Reset Password</Button>
                </div>
                {profileModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-card p-6 rounded shadow-lg w-full max-w-md relative">
                      <Button size="sm" className="absolute top-2 right-2" onClick={() => { setProfileModal(""); setSelectedProfile(null); }}>Close</Button>
                      {profileModal === "view" && (
                        <>
                          <div className="font-bold mb-2">Select a profile to view:</div>
                          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                            {[...agents, ...allPilgrims || []].map(user => (
                              <Button key={user.id} variant="outline" size="sm" className="w-full" onClick={() => setSelectedProfile(user)}>{user.name}</Button>
                            ))}
                          </div>
                          {selectedProfile && (
                            <div className="border rounded p-3 bg-muted mb-2">
                              <div className="font-semibold">Name: {selectedProfile.name}</div>
                              <div className="text-sm">Role: {selectedProfile.pilgrims !== undefined ? 'Agent' : 'Pilgrim'}</div>
                              <div className="text-sm">Joined: {selectedProfile.joined || selectedProfile.date || 'N/A'}</div>
                            </div>
                          )}
                        </>
                      )}
                      {profileModal === "edit" && (
                        <>
                          <div className="font-bold mb-2">Edit Profile</div>
                          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                            {[...agents, ...allPilgrims || []].map(user => (
                              <Button key={user.id} variant="outline" size="sm" className="w-full" onClick={() => setSelectedProfile(user)}>{user.name}</Button>
                            ))}
                          </div>
                          {selectedProfile && (
                            <form className="space-y-2" onSubmit={e => { e.preventDefault(); setProfileModal(""); setSelectedProfile(null); }}>
                              <input className="w-full border rounded px-2 py-1" defaultValue={selectedProfile.name} />
                              <Button type="submit" size="sm">Save</Button>
                            </form>
                          )}
                        </>
                      )}
                      {profileModal === "reset" && (
                        <>
                          <div className="font-bold mb-2">Reset Password</div>
                          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                            {[...agents, ...allPilgrims || []].map(user => (
                              <Button key={user.id} variant="outline" size="sm" className="w-full" onClick={() => setSelectedProfile(user)}>{user.name}</Button>
                            ))}
                          </div>
                          {selectedProfile && (
                            <form className="space-y-2" onSubmit={e => { e.preventDefault(); setProfileModal(""); setSelectedProfile(null); }}>
                              <input className="w-full border rounded px-2 py-1" type="password" placeholder="New Password" />
                              <Button type="submit" size="sm">Reset</Button>
                            </form>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Settings */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-primary" />
                  System Settings
                </CardTitle>
                <CardDescription>
                  Configure system-wide settings (API endpoints, themes, security options)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => setSettingsModal("api")}>API Endpoints</Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsModal("theme")}>Theme Settings</Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsModal("security")}>Security Options</Button>
                </div>
                {settingsModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-card p-6 rounded shadow-lg w-full max-w-md relative">
                      <Button size="sm" className="absolute top-2 right-2" onClick={() => setSettingsModal("")}>Close</Button>
                      {settingsModal === "api" && (
                        <form className="space-y-2" onSubmit={e => { e.preventDefault(); setSettingsModal(""); }}>
                          <div className="font-bold mb-2">API Endpoint</div>
                          <input className="w-full border rounded px-2 py-1" value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)} />
                          <Button type="submit" size="sm">Save</Button>
                        </form>
                      )}
                      {settingsModal === "theme" && (
                        <div className="space-y-2">
                          <div className="font-bold mb-2">Theme Settings</div>
                          <Button size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>Light</Button>
                          <Button size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>Dark</Button>
                          <Button size="sm" variant={theme === "gold" ? "default" : "outline"} onClick={() => setTheme("gold")}>Gold</Button>
                        </div>
                      )}
                      {settingsModal === "security" && (
                        <form className="space-y-2" onSubmit={e => { e.preventDefault(); setSettingsModal(""); }}>
                          <div className="font-bold mb-2">Security Option</div>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={securityOption} onChange={e => setSecurityOption(e.target.checked)} />
                            Enable 2FA (demo)
                          </label>
                          <Button type="submit" size="sm">Save</Button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Integrated Calendar */}
            <Calendar />
            {/* Integrated Chat/Support */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="mr-2 h-5 w-5 text-primary" />
                  Integrated Chat/Support
                </CardTitle>
                <CardDescription>
                  Direct chat with agents/pilgrims or internal admin team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => { setOpenChat("agent"); setChatMessages([]); setSelectedChatAgentId((agents && agents[0] && agents[0].id) || null); }}>Chat with Agent</Button>
                  <Button variant="outline" size="sm" onClick={() => { setOpenChat("pilgrim"); setChatMessages([]); setSelectedChatPilgrimId((allPilgrims && allPilgrims[0] && allPilgrims[0].id) || null); }}>Chat with Pilgrim</Button>
                  <Button variant="outline" size="sm" onClick={() => { setOpenChat("admin"); setChatMessages([]); setSelectedChatAgentId(null); setSelectedChatPilgrimId(null); }}>Internal Admin Chat</Button>
                </div>
                {/* select chat target (pilgrim/agent) when chat is opened */}
                {openChat && (
                  <div className="mt-2">
                    {openChat === 'pilgrim' && (
                      <select
                        value={selectedChatPilgrimId ?? ''}
                        onChange={e => setSelectedChatPilgrimId(Number(e.target.value))}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {(allPilgrims || []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name || `Pilgrim #${p.id}`}</option>
                        ))}
                      </select>
                    )}
                    {openChat === 'agent' && (
                      <select
                        value={selectedChatAgentId ?? ''}
                        onChange={e => setSelectedChatAgentId(Number(e.target.value))}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {(agents || []).map((a: any) => (
                          <option key={a.id} value={a.id}>{a.name || `Agent #${a.id}`}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {openChat && (
                  <div className="mt-4 border rounded p-3 bg-muted">
                    <div className="font-bold mb-2">{openChat === "agent" ? "Agent Chat" : openChat === "pilgrim" ? "Pilgrim Chat" : "Admin Team Chat"}</div>
                    <div ref={chatBoxRef} className="max-h-40 overflow-y-auto mb-2 space-y-1 bg-white rounded p-2">
                      {chatMessages.length === 0 ? (
                        <div className="text-muted-foreground text-sm">No messages yet. Start the conversation!</div>
                      ) : (
                        chatMessages.map((message, idx) => {
                          const isMe = message.from === 'Admin';
                          return (
                            <div key={message.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] rounded-lg p-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-xs">{isMe ? 'Admin (You)' : message.from}</span>
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
                        })
                      )}
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
                        const payload: any = {
                          sender: 'Admin',
                          message: chatInput,
                          fileUrl: fileUrl || null,
                          fileType: fileType || null
                        };
                        // attach explicit selected target ids
                        if (openChat === 'pilgrim' && selectedChatPilgrimId) payload.pilgrimId = selectedChatPilgrimId;
                        if (openChat === 'agent' && selectedChatAgentId) payload.agentId = selectedChatAgentId;
                        const res = await fetch(`${API_BASE_URL}/messages`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload)
                        });
                        if (res.ok) {
                          setChatInput("");
                          setAttachment(null);
                          setUploading(false);
                          setChatMessages(prev => [...prev, { ...{
                            id: Date.now(),
                            from: payload.sender,
                            message: payload.message,
                            date: new Date().toLocaleString(),
                            fileUrl: payload.fileUrl,
                            fileType: payload.fileType
                          }}]);
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
                      <div className="relative flex items-center">
                        <Button type="submit" size="sm" disabled={uploading || (openChat === 'pilgrim' && !selectedChatPilgrimId) || (openChat === 'agent' && !selectedChatAgentId)}>
                          {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Send'}
                        </Button>
                        {((openChat === 'pilgrim' && !selectedChatPilgrimId) || (openChat === 'agent' && !selectedChatAgentId)) && !uploading && (
                          <span className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded shadow z-10 whitespace-nowrap">Select a target to enable Send</span>
                        )}
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOpenChat("")}>Close</Button>
                    </form>
                    {/* Typing indicator */}
                    {isTargetTyping && (
                      <div className="px-4 pb-2 text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="animate-spin h-3 w-3" /> Target is typing...
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Activity Log & Audit Trail */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5 text-warning" />
                  Activity Log & Audit Trail
                </CardTitle>
                <CardDescription>
                  Track all admin/user actions for security and transparency
                </CardDescription>
                <div className="mt-4 flex w-full gap-2">
                  <input
                    type="text"
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    placeholder="Search activities by action, user, or details..."
                    value={activitySearch}
                    onChange={e => setActivitySearch(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActivitySearch(activitySearch)}
                  >
                    Search
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading activities...</div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {(() => {
                      const needle = (activitySearch || '').toString().toLowerCase();
                      const filteredActivities = (activities || []).filter(a => {
                        const act = (a.action || '').toString().toLowerCase();
                        const user = (a.userName || '').toString().toLowerCase();
                        const details = (a.details || '').toString().toLowerCase();
                        return act.includes(needle) || user.includes(needle) || details.includes(needle);
                      });
                      if (filteredActivities.length === 0) {
                        return <div className="text-center py-8 text-muted-foreground">No activity records found.</div>;
                      }
                      return filteredActivities.map((activity) => {
                        return (
                          <div key={activity.id} className="p-3 border rounded-lg flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-foreground">{activity.action}</span>
                              <span className="text-xs text-muted-foreground">{activity.date}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              By: {activity.userType} #{activity.userId} ({activity.userName})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Details: {activity.details}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
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
                  Review, approve, reject, and download all user documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {docLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {documents.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">No documents uploaded yet.</div>
                    )}
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">By: {doc.pilgrimId ? `Pilgrim #${doc.pilgrimId}` : doc.agentId ? `Agent #${doc.agentId}` : 'Unknown'}</p>
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
                                const link = document.createElement('a');
                                link.href = doc.fileUrl;
                                link.download = doc.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <DollarSign className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {adminRole === "superadmin" || adminRole === "moderator" ? (
                            <>
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
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Agent Management */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Users className="mr-2 h-5 w-5 text-primary" />
                    Manage Agents
                  </span>
                  <AddAgentModal onAddAgent={handleAddAgent} />
                </CardTitle>
                <CardDescription>
                  Create, edit, and manage travel agent accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.pilgrims} pilgrims • Joined {agent.joined}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={agent.status === "Active" ? "default" : "destructive"}>
                          {agent.status}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleAgentAction(agent.id, agent.status === "Active" ? "suspend" : "activate")}
                        >
                          {agent.status === "Active" ? "Suspend" : "Activate"}
                        </Button>
                        <Button size="sm" variant="default" onClick={() => handleApproveAgent(agent.id)} disabled={agent.status === 'Active'}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleDenyAgent(agent.id)} disabled={agent.status === 'Denied'}>Deny</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRemoveAgent(agent.id)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Registration Takeover Requests */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5 text-warning" />
                  Registration Takeover Requests
                </CardTitle>
                <CardDescription>
                  Review and approve agent transfer requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {takeoverRequests.map((request) => (
                    <div key={request.id} className="p-3 border rounded-lg space-y-2">
                      <div>
                        <p className="font-medium text-foreground">Pilgrim: {request.pilgrimName}</p>
                        <p className="text-sm text-muted-foreground">
                          From: <strong>{request.fromAgent}</strong> → To: <strong>{request.toAgent}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">Requested: {request.date}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleApproveRequest(request.id)}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                  {takeoverRequests.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending takeover requests
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5 text-primary" />
                Administrative Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setShowPilgrimsModal(true)}>
                  <FileText className="h-6 w-6 mb-2" />
                  View All Pilgrims
                </Button>
                <ViewPilgrimsModal open={showPilgrimsModal} onClose={() => setShowPilgrimsModal(false)} />
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setShowBansModal(true)}>
                  <Ban className="h-6 w-6 mb-2" />
                  Manage Bans
                </Button>
                <ManageBansModal open={showBansModal} onClose={() => setShowBansModal(false)} />
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setShowReportsModal(true)}>
                  <TrendingUp className="h-6 w-6 mb-2" />
                  System Reports
                </Button>
                <SystemReportsModal open={showReportsModal} onClose={() => setShowReportsModal(false)} />
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setSettingsModal('api')}>
                  <RefreshCw className="h-6 w-6 mb-2" />
                  System Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;