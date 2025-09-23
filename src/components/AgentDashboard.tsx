import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Search, LogOut, Bell, FileText, TrendingUp, Calendar, MessageCircle, Paperclip, Loader2, Download, Settings, ListChecks } from "lucide-react";
import { Badge as StatusBadge } from "@/components/ui/badge";
import pilgrimIcon from "@/assets/pilgrim-icon.jpg";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import AgentCalendar from "./AgentCalendar";
import AgentTaskManager from "./AgentTaskManager";
import AgentPerformanceAnalytics from "./AgentPerformanceAnalytics";


const AgentDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const [activityLog, setActivityLog] = useState([
    { id: 1, action: "Uploaded document", date: "2025-08-22" },
    { id: 2, action: "Approved registration", date: "2025-08-21" },
    { id: 3, action: "Sent message", date: "2025-08-20" }
  ]);

  // Fetch agent and pilgrims on mount
  useEffect(() => {
    // For demo, use agentId 1
    const agentId = 1;
    setDocLoading(true);
  fetch(`https://agent-pilgrims-api.onrender.com/agents/${agentId}`)
      .then(res => res.json())
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
  fetch(`https://agent-pilgrims-api.onrender.com/pilgrims?agentId=${agentId}`)
      .then(res => res.json())
      .then(data => setPilgrims(data))
      .catch(() => {
        // Enhanced fallback demo pilgrims
        setPilgrims([
          { id: 1, name: "John Doe", status: "Completed", registrationDate: "2025-09-01", destination: "Jerusalem", documents: ["Passport", "Visa"], contact: "+234 801 111 2222" },
          { id: 2, name: "Jane Smith", status: "Pending Documents", registrationDate: "2025-09-10", destination: "Rome", documents: ["Passport"], contact: "+234 801 333 4444" },
          { id: 3, name: "Samuel Johnson", status: "In Review", registrationDate: "2025-09-15", destination: "Bethlehem", documents: [], contact: "+234 801 555 6666" },
          { id: 4, name: "Maryam Musa", status: "Completed", registrationDate: "2025-08-28", destination: "Nazareth", documents: ["Passport", "Visa", "Medical"], contact: "+234 801 777 8888" },
          { id: 5, name: "Chinedu Eze", status: "Pending Payment", registrationDate: "2025-09-18", destination: "Jerusalem", documents: ["Passport"], contact: "+234 801 999 0000" }
        ]);
      });
    setDocLoading(false);
  }, []);

  // Fetch documents for agent's pilgrims
  useEffect(() => {
    if (!agentData || !pilgrims.length) return;
    setDocLoading(true);
  fetch('https://agent-pilgrims-api.onrender.com/documents')
      .then(res => res.json())
      .then(data => {
        const pilgrimIds = pilgrims.map((p: any) => p.id);
        setDocuments(data.filter((doc: any) => pilgrimIds.includes(doc.pilgrimId)));
        setDocLoading(false);
      })
      .catch(() => setDocLoading(false));
  }, [agentData, pilgrims]);
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
  const res = await fetch(`https://agent-pilgrims-api.onrender.com/documents/${docId}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, status } : doc));
        toast({ title: `Document ${status}`, description: `Document has been marked as ${status}.` });
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
    if (!selectedPilgrim || !agentData) return;
    const request = {
      agentId: agentData.id,
      agentName: agentData.name,
      pilgrimId: selectedPilgrim.id,
      pilgrimName: selectedPilgrim.name,
      date: new Date().toISOString(),
      status: "pending"
    };
  const res = await fetch("https://agent-pilgrims-api.onrender.com/takeoverRequests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    if (res.ok) {
      toast({
        title: "Takeover Request Sent",
        description: "Takeover request sent to previous agent. You will be notified when approved.",
      });
    } else {
      toast({ title: "Error", description: "Failed to send takeover request.", variant: "destructive" });
    }
    setSearchResults(null);
    setSearchNIN("");
  };

  // Appeal ban handler (mock)
  const handleAppealBan = async () => {
    toast({
      title: "Appeal Submitted",
      description: "Ban appeal has been submitted to administrators for review.",
    });
    setSearchResults(null);
    setSearchNIN("");
  };

  // Filtered documents for search/filter UI
  const filteredDocuments = documents.filter((doc) => {
    const pilgrim = pilgrims.find((p) => p.id === doc.pilgrimId);
    const matchesSearch =
      doc.name.toLowerCase().includes(docSearch.toLowerCase()) ||
      (pilgrim && pilgrim.name.toLowerCase().includes(docSearch.toLowerCase()));
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
                  <Button variant="outline" size="sm" onClick={() => navigate('/agent-login')}>
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
                                    const link = document.createElement('a');
                                    link.href = doc.fileUrl;
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
                            fileUrl = URL.createObjectURL(attachment);
                            fileType = attachment.type.startsWith('image') ? 'image' : (attachment.type === 'application/pdf' ? 'pdf' : null);
                          }
                          const newMessage = {
                            from: agentData.name,
                            message: chatInput,
                            date: new Date().toLocaleString(),
                            pilgrimId: selectedPilgrim.id,
                            read: false,
                            fileUrl,
                            fileType
                          };
                          const res = await fetch('https://agent-pilgrims-api.onrender.com/messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newMessage)
                          });
                          if (res.ok) {
                            setChatInput("");
                            setAttachment(null);
                            setUploading(false);
                            setMessages(prev => [...prev, { ...newMessage, id: Date.now() }]);
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
                {documents.filter(doc => doc.fileName.toLowerCase().includes(docSearch.toLowerCase())).map(doc => (
                  <li key={doc.id} className="p-2 rounded bg-secondary/30 flex items-center gap-2">
                    <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={e => {
                      if (e.target.checked) setSelectedDocs([...selectedDocs, doc.id]);
                      else setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                    }} />
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{doc.fileName}</span>
                    <Badge variant="outline">{doc.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => window.open(`/documents/${doc.fileName}`, "_blank")}>Preview</Button>
                  </li>
                ))}
                {documents.filter(doc => doc.fileName.toLowerCase().includes(docSearch.toLowerCase())).length === 0 && <li className="text-muted-foreground">No documents found.</li>}
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
        </div>
      )}
    </>
  );
};
export default AgentDashboard;