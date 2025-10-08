import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileCheck,
  LogOut,
  Bell,
  Upload,
  MessageCircle,
  Calendar,
  MapPin,
  User,
  Shield,
  CheckCircle,
  AlertCircle,
  Eye,
  Download,
  X,
  Paperclip,
  Loader2
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import pilgrimIcon from "@/assets/pilgrim-icon.jpg";
import DocumentUploadModal from "./DocumentUploadModal";
import { useToast } from "@/hooks/use-toast";

const REQUIRED_DOCS = ["Passport", "Visa", "Medical Certificate", "Proof of Accommodation"];

const PilgrimDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pilgrimId, setPilgrimId] = useState<number | null>(null);
  const [pilgrimData, setPilgrimData] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docUploading, setDocUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = Number(localStorage.getItem("pilgrim_id") || 0) || null;
    if (!id) {
      navigate('/pilgrim-login');
      return;
    }
    setPilgrimId(id);
  }, [navigate]);

  useEffect(() => {
    if (!pilgrimId) return;
    const load = async () => {
      try {
        const [pRes, docsRes, msgsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/pilgrims/${pilgrimId}`),
          fetch(`${API_BASE_URL}/documents?pilgrimId=${pilgrimId}`),
          fetch(`${API_BASE_URL}/messages?pilgrimId=${pilgrimId}`)
        ]);
        if (pRes.ok) setPilgrimData(await pRes.json());
        const docs = docsRes.ok ? await docsRes.json() : [];
        setDocuments(docs || []);
        const msgs = msgsRes.ok ? await msgsRes.json() : [];
        const mapped = (msgs || []).map((m: any) => ({ id: m.id, from: m.sender || m.from, message: m.message, date: m.timestamp ? new Date(m.timestamp).toLocaleString() : (m.date || ''), fileUrl: m.fileUrl, fileType: m.fileType, read: m.read || false }));
        setMessages(mapped);
      } catch (e) {
        console.error('Failed to load pilgrim data', e);
      }
    };
    load();
  }, [pilgrimId]);

  useEffect(() => {
    if (!pilgrimId) return;
    let es: EventSource | null = null;
    try {
      const esUrl = `${API_BASE_URL}/messages/stream?pilgrimId=${pilgrimId}`;
      es = new EventSource(esUrl);
      es.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          const mapped = { id: m.id, from: m.sender || m.from, message: m.message, date: m.timestamp ? new Date(m.timestamp).toLocaleString() : (m.date || ''), fileUrl: m.fileUrl, fileType: m.fileType, read: m.read || false };
          setMessages(prev => {
            if (prev.find(p => p.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
          toast({ title: 'New Message', description: mapped.message });
        } catch (e) {
          console.error('SSE parse error', e);
        }
      };
      es.onerror = (err) => { console.error('SSE error', err); if (es) es.close(); };
    } catch (e) {
      console.error('SSE setup failed', e);
    }
    return () => { if (es) es.close(); };
  }, [pilgrimId, toast]);

  // SSE for documents uploaded specifically for this pilgrim
  useEffect(() => {
    if (!pilgrimId) return;
    let es: EventSource | null = null;
    try {
      const url = `${API_BASE_URL}/documents/stream?pilgrimId=${pilgrimId}`;
      es = new EventSource(url);
      es.onmessage = async (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (!payload || payload.type !== 'document' || !payload.document) return;
          // refetch authoritative documents list for this pilgrim
          const docs = await fetch(`${API_BASE_URL}/documents?pilgrimId=${pilgrimId}`).then(r => r.ok ? r.json() : []);
          setDocuments(docs || []);
          toast({ title: 'Document Uploaded', description: `${payload.document.name} has been uploaded.` });
        } catch (e) { /* ignore */ }
      };
      es.onerror = (err) => { console.error('Document SSE error', err); if (es) es.close(); };
    } catch (e) {
      console.error('Document SSE setup failed', e);
    }
    return () => { if (es) es.close(); };
  }, [pilgrimId, toast]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const calculateProgress = () => {
    const completedDocs = REQUIRED_DOCS.filter(docName => {
      const doc = documents.find((d: any) => d.name === docName);
      return doc && doc.status === "Uploaded";
    }).length;
    return Math.round((completedDocs / REQUIRED_DOCS.length) * 100);
  };

  const handleSignOut = () => {
    localStorage.removeItem('pilgrim_token');
    localStorage.removeItem('pilgrim_id');
    navigate('/pilgrim-login');
  };

  const getDocumentStatusIcon = (status: string) => {
    switch (status) {
      case 'Uploaded': return <CheckCircle className="h-5 w-5 text-success" />;
      case 'Pending': return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
      default: return <FileCheck className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getDocumentStatusVariant = (status: string) => {
    switch (status) {
      case 'Uploaded': return 'default';
      case 'Pending': return 'outline';
      default: return 'secondary';
    }
  };

  const handleDocumentUpload = async (docName: string) => {
    setDocUploading(docName);
    try {
      const doc = documents.find((d: any) => d.name === docName);
      if (doc) {
        await fetch(`${API_BASE_URL}/documents/${doc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Uploaded', date: new Date().toISOString().slice(0,10) }) });
      } else {
        await fetch(`${API_BASE_URL}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pilgrimId, name: docName, status: 'Uploaded', date: new Date().toISOString().slice(0,10) }) });
      }
      const d = await fetch(`${API_BASE_URL}/documents?pilgrimId=${pilgrimId}`).then(r => r.json());
      setDocuments(d || []);
      toast({ title: 'Document Uploaded', description: `${docName} uploaded.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to upload document.', variant: 'destructive' });
    }
    setDocUploading(null);
  };

  const handleSendMessage = async (payload: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, pilgrimId }) });
      if (res.ok) {
        const created = await res.json();
        setMessages(prev => [...prev, { id: created.id || Date.now(), from: created.sender || payload.sender, message: created.message || payload.message, date: created.timestamp ? new Date(created.timestamp).toLocaleString() : new Date().toLocaleString(), fileUrl: created.fileUrl || payload.fileUrl, fileType: created.fileType || payload.fileType, read: false }]);
        toast({ title: 'Message Sent', description: 'Message sent.' });
      } else {
        toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  const handleSubmitRegistration = async () => {
    if (!pilgrimId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pilgrims/${pilgrimId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationSubmitted: true }) });
      if (res.ok) {
        setPilgrimData((prev:any) => ({ ...prev, registrationSubmitted: true }));
        toast({ title: 'Registration Submitted', description: 'Your registration has been submitted to your agent.' });
      } else {
        toast({ title: 'Error', description: 'Failed to submit registration.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  if (pilgrimData === null) return (<div className="flex items-center justify-center min-h-screen"><span>Loading pilgrim dashboard...</span></div>);
  if (pilgrimData === undefined) return (<div className="flex items-center justify-center min-h-screen"><span className="text-red-500">Pilgrim not found. Please check your data or contact support.</span></div>);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={pilgrimIcon} alt="Pilgrim Management System" className="h-10 w-10 rounded-lg shadow-card" />
              <div>
                <h1 className="text-xl font-heading font-bold text-foreground">Pilgrim Portal</h1>
                <p className="text-sm text-muted-foreground">Welcome, {pilgrimData.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
                {messages.filter(m => !m.read).length > 0 && <span className="ml-1 text-xs bg-destructive text-destructive-foreground rounded-full px-1">{messages.filter(m => !m.read).length}</span>}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-6 lg:gap-8">
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center"><FileCheck className="mr-2 h-5 w-5 text-primary"/>Registration Status</span>
                <Badge variant="outline" className="text-base px-4 py-1">{pilgrimData.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm text-muted-foreground">Pilgrim Name</p><p className="font-semibold">{pilgrimData.name}</p></div>
                <div><p className="text-sm text-muted-foreground">SSN/NIN</p><p className="font-semibold">{pilgrimData.nin}</p></div>
                <div><p className="text-sm text-muted-foreground">Registered By</p><p className="font-semibold">{pilgrimData.registeredBy}</p></div>
                <div><p className="text-sm text-muted-foreground">Registration Date</p><p className="font-semibold">{pilgrimData.registrationDate}</p></div>
              </div>

              <div className="space-y-4 mt-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <User className={`h-5 w-5 ${pilgrimData.name && pilgrimData.nin ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-medium">Profile Complete</span>
                    {pilgrimData.name && pilgrimData.nin ? <CheckCircle className="h-4 w-4 text-success ml-2" /> : <AlertCircle className="h-4 w-4 text-muted-foreground ml-2" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <Upload className={`h-5 w-5 ${calculateProgress() === 100 ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-medium">Documents Uploaded</span>
                    {calculateProgress() === 100 ? <CheckCircle className="h-4 w-4 text-success ml-2" /> : <AlertCircle className="h-4 w-4 text-muted-foreground ml-2" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className={`h-5 w-5 ${pilgrimData.registrationSubmitted ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-medium">Registration Submitted</span>
                    {pilgrimData.registrationSubmitted ? <CheckCircle className="h-4 w-4 text-success ml-2" /> : <AlertCircle className="h-4 w-4 text-muted-foreground ml-2" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Registration Progress</span><span>{calculateProgress()}% Complete</span></div>
                  <Progress value={calculateProgress()} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between"><span className="flex items-center"><Upload className="mr-2 h-5 w-5 text-primary"/>Required Documents</span></CardTitle>
                <CardDescription>Upload and manage your required pilgrimage documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {REQUIRED_DOCS.map(docName => {
                    const doc = documents.find((d: any) => d.name === docName);
                    return (
                      <div key={docName} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getDocumentStatusIcon(doc?.status || "Pending")}
                          <div>
                            <p className="font-medium text-foreground">{docName}</p>
                            {doc && doc.date && (<p className="text-xs text-muted-foreground">Uploaded: {doc.date}</p>)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={(getDocumentStatusVariant(doc?.status || "Pending") as any)}>{doc?.status || "Pending"}</Badge>
                          {doc && doc.fileUrl && (
                            <Button size="icon" variant="ghost" title="Preview Document" onClick={() => {
                              const normalize = (u: string) => {
                                if (!u) return u;
                                if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:')) return u;
                                return `${API_BASE_URL.replace(/\/$/, '')}${u.startsWith('/') ? u : `/${u}`}`;
                              };
                              const resolved = normalize(doc.fileUrl);
                              const ext = resolved.split('.').pop()?.toLowerCase();
                              if (ext === 'pdf') setPreviewType('pdf');
                              else if (["jpg","jpeg","png","gif","bmp","webp"].includes(ext || '')) setPreviewType('image');
                              else setPreviewType(null);
                              setPreviewUrl(resolved);
                            }}>
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {doc && doc.fileUrl && (
                            <Button size="icon" variant="ghost" title="Download Document" onClick={() => {
                              const normalize = (u: string) => {
                                if (!u) return u;
                                if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('blob:')) return u;
                                return `${API_BASE_URL.replace(/\/$/, '')}${u.startsWith('/') ? u : `/${u}`}`;
                              };
                              const link = document.createElement('a'); link.href = normalize(doc.fileUrl); link.download = doc.name; document.body.appendChild(link); link.click(); document.body.removeChild(link);
                            }}>
                              <Download className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          <DocumentUploadModal onDocumentUpload={async (newDoc) => {
                            try {
                              await fetch(`${API_BASE_URL}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newDoc, pilgrimId, name: docName, status: 'Uploaded', date: new Date().toISOString().slice(0,10) }) });
                              const d = await fetch(`${API_BASE_URL}/documents?pilgrimId=${pilgrimId}`).then(r => r.json()); setDocuments(d || []); toast({ title: 'Document Uploaded', description: `${docName} uploaded.` });
                            } catch (e) {
                              toast({ title: 'Error', description: 'Failed to upload document.', variant: 'destructive' });
                            }
                          }} defaultName={docName} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card flex flex-col h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center"><MessageCircle className="mr-2 h-5 w-5 text-primary"/>Chat with Agent</CardTitle>
                <CardDescription>Real-time messaging with your travel agent</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <div ref={chatBoxRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-muted rounded-t">
                  {messages.length === 0 && (<div className="text-center text-muted-foreground mt-8">No messages yet. Start the conversation!</div>)}
                  {messages.map((message) => {
                    const isMe = message.from === pilgrimData.name;
                    return (
                      <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-lg shadow text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground border'} `}>
                          <div className="flex items-center mb-1"><span className="font-semibold text-xs mr-2">{isMe ? 'You' : message.from}</span><span className="text-[10px] text-muted-foreground">{message.date}</span></div>
                          <div>{message.message}</div>
                          {message.fileUrl && message.fileType === 'image' && (<img src={message.fileUrl} alt="attachment" className="mt-2 max-h-32 rounded border" />)}
                          {message.fileUrl && message.fileType === 'pdf' && (<a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 underline block">View PDF Attachment</a>)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form className="flex items-center border-t bg-background px-2 py-2 gap-2" onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatInput.trim() && !attachment) return;
                  setUploading(true);
                  let fileUrl = null; let fileType = null;
                  if (attachment) {
                    try {
                      const formData = new FormData(); formData.append('file', attachment);
                      const upl = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/upload`, { method: 'POST', body: formData });
                      const uplData = await upl.json(); fileUrl = uplData.fileUrl;
                    } catch (e) { toast({ title: 'Upload failed', description: 'Could not upload file.', variant: 'destructive' }); setUploading(false); return; }
                    fileType = attachment.type.startsWith('image') ? 'image' : (attachment.type === 'application/pdf' ? 'pdf' : null);
                  }
                  const payload = { sender: pilgrimData.name, message: chatInput, pilgrimId, fileUrl: fileUrl || null, fileType: fileType || null };
                  await handleSendMessage(payload);
                  setChatInput(''); setAttachment(null); setUploading(false);
                }}>
                  <input className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring" placeholder="Type your message..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={uploading} />
                  <label className="cursor-pointer flex items-center">
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const file = e.target.files && e.target.files.length ? e.target.files[0] : null; setAttachment(file); }} />
                    <Button type="button" variant="ghost" size="icon"><Paperclip className="h-4 w-4"/></Button>
                    {attachment && <span className="ml-2 text-sm">{attachment.name}</span>}
                  </label>
                  <Button type="submit" disabled={uploading} className="ml-2">{uploading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Send'}</Button>
                </form>

              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                  <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Travel Details")}><Calendar className="h-6 w-6 mb-2"/>Travel Details</Button>
                  <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Itinerary")}><MapPin className="h-6 w-6 mb-2"/>Itinerary</Button>
                  <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Appeal Status")}><Shield className="h-6 w-6 mb-2"/>Appeal Status</Button>
                  <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Contact Agent")}><MessageCircle className="h-6 w-6 mb-2"/>Contact Agent</Button>
                </div>
                {quickAction && (<div className="mt-6 p-4 border rounded-lg bg-muted"><b>{quickAction}</b><div className="mt-2">{quickAction === "Travel Details" && <div>Your travel details will appear here.</div>}{quickAction === "Itinerary" && <div>Your itinerary will appear here.</div>}{quickAction === "Appeal Status" && <div>No active appeals.</div>}{quickAction === "Contact Agent" && <div>Contact your agent at: <b>{pilgrimData.registeredBy || "N/A"}</b></div>}</div><Button className="mt-2" size="sm" onClick={() => setQuickAction(null)}>Close</Button></div>)}
              </CardContent>
            </Card>

          </div>

          <Dialog open={!!previewUrl} onOpenChange={open => { if (!open) setPreviewUrl(null); }}>
            <DialogContent className="max-w-2xl">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Document Preview</span>
                <Button size="icon" variant="ghost" onClick={() => setPreviewUrl(null)}><X className="h-5 w-5"/></Button>
              </div>
              {previewType === 'image' && previewUrl && (<img src={previewUrl} alt="Document Preview" className="max-h-[60vh] mx-auto rounded shadow" />)}
              {previewType === 'pdf' && previewUrl && (<iframe src={previewUrl} title="PDF Preview" className="w-full min-h-[60vh] rounded shadow" />)}
              {!previewType && previewUrl && (<div className="text-center text-muted-foreground">Cannot preview this file type. <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="underline">Open in new tab</a></div>)}
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </div>
  );
};

export default PilgrimDashboard;