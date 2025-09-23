import { useState, useEffect, useRef } from "react";
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
  Clock,
  Eye,
  Download,
  X,
  Paperclip,
  Loader2
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import pilgrimIcon from "@/assets/pilgrim-icon.jpg";
import DocumentUploadModal from "./DocumentUploadModal";
// import SendMessageModal from "./SendMessageModal";
import { useToast } from "@/hooks/use-toast";

const REQUIRED_DOCS = [
  "Passport Copy",
  "Health Certificate",
  "Baptism Certificate",
  "Photo ID",
  "NIN",
  "Passport Photograph"
];

const PilgrimDashboard = () => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pilgrimData, setPilgrimData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [docUploading, setDocUploading] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);

  const navigate = useNavigate();
  // Assume pilgrimId 1 for now
  const pilgrimId = 1;

  // Initial fetch
  useEffect(() => {
  fetch(`https://agent-pilgrims-api.onrender.com/pilgrims/${pilgrimId}`)
      .then(res => {
        if (!res.ok) throw new Error('Pilgrim not found');
        return res.json();
      })
      .then(data => setPilgrimData(data))
      .catch(() => setPilgrimData(undefined));

  fetch(`https://agent-pilgrims-api.onrender.com/documents?pilgrimId=${pilgrimId}`)
      .then(res => res.json())
      .then(data => setDocuments(data));

  fetch(`https://agent-pilgrims-api.onrender.com/messages?pilgrimId=${pilgrimId}`)
      .then(res => res.json())
      .then(data => setMessages(data));
  }, []);

  // Polling for real-time notifications, chat, and agent typing (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Check for new messages
  const msgRes = await fetch(`https://agent-pilgrims-api.onrender.com/messages?pilgrimId=${pilgrimId}`);
      const latestMessages = await msgRes.json();
      if (latestMessages.length > messages.length) {
        const newMsgs = latestMessages.slice(messages.length);
        newMsgs.forEach(msg => {
          toast({
            title: 'New Message',
            description: msg.message,
            variant: 'default',
          });
        });
        setMessages(latestMessages);
      } else if (latestMessages.length < messages.length) {
        setMessages(latestMessages);
      }
      // Simulate agent typing randomly (for demo)
      setIsAgentTyping(Math.random() < 0.2); // 20% chance agent is typing
      // Check for document status changes
  const docRes = await fetch(`https://agent-pilgrims-api.onrender.com/documents?pilgrimId=${pilgrimId}`);
      const latestDocs = await docRes.json();
      latestDocs.forEach((doc, idx) => {
        const prevDoc = documents.find((d) => d.id === doc.id);
        if (prevDoc && prevDoc.status !== doc.status) {
          toast({
            title: 'Document Status Updated',
            description: `${doc.name} is now ${doc.status}`,
            variant: 'default',
          });
        }
      });
      setDocuments(latestDocs);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages, documents, pilgrimId, toast]);

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Robust document upload per row
  const handleDocumentUpload = async (docName: string) => {
    setDocUploading(docName);
    // Find if doc exists
    const doc = documents.find((d: any) => d.name === docName);
    if (doc) {
      // PATCH status to Uploaded
  await fetch(`https://agent-pilgrims-api.onrender.com/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Uploaded", date: new Date().toISOString().slice(0, 10) })
      });
    } else {
      // POST new document
  await fetch(`https://agent-pilgrims-api.onrender.com/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilgrimId,
          name: docName,
          status: "Uploaded",
          date: new Date().toISOString().slice(0, 10)
        })
      });
    }
    // Refresh docs
  const d = await fetch(`https://agent-pilgrims-api.onrender.com/documents?pilgrimId=${pilgrimId}`).then(r => r.json());
    setDocuments(d);
    setDocUploading(null);
    toast({ title: 'Document Uploaded', description: `${docName} uploaded.` });
  };

  const handleSendMessage = async (newMessage: any) => {
    // POST to mock API
  const res = await fetch('https://agent-pilgrims-api.onrender.com/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMessage, pilgrimId })
    });
    if (res.ok) {
      const created = await res.json();
      setMessages(prev => [...prev, created]);
      toast({ title: 'Message Sent', description: 'Message sent to agent.' });
    } else {
      toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
    }
  };

  const handleSubmitRegistration = async () => {
    setSubmitting(true);
    // PATCH pilgrim to set registrationSubmitted: true
  const res = await fetch(`https://agent-pilgrims-api.onrender.com/pilgrims/${pilgrimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationSubmitted: true })
    });
    if (res.ok) {
      setPilgrimData((prev: any) => ({ ...prev, registrationSubmitted: true }));
      toast({ title: 'Registration Submitted', description: 'Your registration has been submitted to your agent.' });
    } else {
      toast({ title: 'Error', description: 'Failed to submit registration.', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const calculateProgress = () => {
    const completedDocs = REQUIRED_DOCS.filter(docName => {
      const doc = documents.find((d: any) => d.name === docName);
      return doc && doc.status === "Uploaded";
    }).length;
    return Math.round((completedDocs / REQUIRED_DOCS.length) * 100);
  };

  const handleSignOut = () => {
    navigate("/pilgrim-login");
  };

  const getDocumentStatusIcon = (status: string) => {
    switch (status) {
      case "Uploaded": return <CheckCircle className="h-4 w-4 text-success" />;
      case "Under Review": return <Clock className="h-4 w-4 text-warning" />;
      case "Pending": return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getDocumentStatusVariant = (status: string) => {
    switch (status) {
      case "Uploaded": return "default";
      case "Under Review": return "outline";
      case "Pending": return "secondary";
      default: return "secondary";
    }
  };

  if (pilgrimData === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span>Loading pilgrim dashboard...</span>
      </div>
    );
  }
  if (pilgrimData === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-red-500">Pilgrim not found. Please check your data or contact support.</span>
      </div>
    );
  }

  return (
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
                  Pilgrim Portal
                </h1>
                <p className="text-sm text-muted-foreground">Welcome, {pilgrimData.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
                {messages.filter(m => !m.read).length > 0 && (
                  <span className="ml-1 text-xs bg-destructive text-destructive-foreground rounded-full px-1">
                    {messages.filter(m => !m.read).length}
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-6 lg:gap-8">
          {/* Registration Status Overview */}
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <FileCheck className="mr-2 h-5 w-5 text-primary" />
                  Registration Status
                </span>
                <Badge variant="outline" className="text-base px-4 py-1">
                  {pilgrimData.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Pilgrim Name</p>
                  <p className="font-semibold">{pilgrimData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SSN/NIN</p>
                  <p className="font-semibold">{pilgrimData.nin}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registered By</p>
                  <p className="font-semibold">{pilgrimData.registeredBy}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registration Date</p>
                  <p className="font-semibold">{pilgrimData.registrationDate}</p>
                </div>
              </div>
              {/* Milestone Steps */}
              <div className="space-y-4 mt-4">
                <div className="flex flex-col gap-3">
                  {/* Step 1: Profile Complete */}
                  <div className="flex items-center gap-3">
                    <User className={`h-5 w-5 ${pilgrimData.name && pilgrimData.nin ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-medium">Profile Complete</span>
                    {pilgrimData.name && pilgrimData.nin ? (
                      <CheckCircle className="h-4 w-4 text-success ml-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground ml-2" />
                    )}
                  </div>
                  {/* Step 2: Documents Uploaded */}
                  <div className="flex items-center gap-3">
                    <Upload className={`h-5 w-5 ${calculateProgress() === 100 ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-medium">Documents Uploaded</span>
                    {calculateProgress() === 100 ? (
                      <CheckCircle className="h-4 w-4 text-success ml-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground ml-2" />
                    )}
                  </div>
                  {/* Step 3: Registration Submitted */}
                  <div className="flex items-center gap-3">
                    <Shield className={`h-5 w-5 ${pilgrimData.registrationSubmitted ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="font-medium">Registration Submitted</span>
                    {pilgrimData.registrationSubmitted ? (
                      <CheckCircle className="h-4 w-4 text-success ml-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground ml-2" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Registration Progress</span>
                    <span>{calculateProgress()}% Complete</span>
                  </div>
                  <Progress value={calculateProgress()} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
            {/* Document Management */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Upload className="mr-2 h-5 w-5 text-primary" />
                    Required Documents
                  </span>
                </CardTitle>
                <CardDescription>
                  Upload and manage your required Christian pilgrimage documents
                </CardDescription>
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
                            {doc && doc.date && (
                              <p className="text-xs text-muted-foreground">Uploaded: {doc.date}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getDocumentStatusVariant(doc?.status || "Pending")}> 
                            {doc?.status || "Pending"}
                          </Badge>
                          {/* Preview Button */}
                          {doc && doc.fileUrl && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Preview Document"
                              onClick={() => {
                                // Determine file type
                                const ext = doc.fileUrl.split('.').pop()?.toLowerCase();
                                if (ext === 'pdf') {
                                  setPreviewType('pdf');
                                } else if (["jpg","jpeg","png","gif","bmp","webp"].includes(ext || '')) {
                                  setPreviewType('image');
                                } else {
                                  setPreviewType(null);
                                }
                                setPreviewUrl(doc.fileUrl);
                              }}
                            >
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {/* Download Button */}
                          {doc && doc.fileUrl && (
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
                          <DocumentUploadModal
                            onDocumentUpload={async (newDoc) => {
                              // Save to backend
                              await fetch(doc
                                ? `https://agent-pilgrims-api.onrender.com/documents/${doc.id}`
                                : `https://agent-pilgrims-api.onrender.com/documents`, {
                                method: doc ? "PATCH" : "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  ...newDoc,
                                  pilgrimId,
                                  name: docName,
                                  status: "Uploaded",
                                  date: new Date().toISOString().slice(0, 10)
                                })
                              });
                              // Refresh docs
                              const d = await fetch(`https://agent-pilgrims-api.onrender.com/documents?pilgrimId=${pilgrimId}`).then(r => r.json());
                              setDocuments(d);
                              toast({ title: 'Document Uploaded', description: `${docName} uploaded.` });
                            }}
                            defaultName={docName}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Real-Time Chat */}
            <Card className="shadow-card flex flex-col h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="mr-2 h-5 w-5 text-primary" />
                  Chat with Agent
                </CardTitle>
                <CardDescription>Real-time messaging with your travel agent</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <div ref={chatBoxRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-muted rounded-t">
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground mt-8">No messages yet. Start the conversation!</div>
                  )}
                  {messages.map((message) => {
                    const isMe = message.from === pilgrimData.name;
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
                      // Simulate upload: create a local object URL (replace with real upload in prod)
                      fileUrl = URL.createObjectURL(attachment);
                      fileType = attachment.type.startsWith('image') ? 'image' : (attachment.type === 'application/pdf' ? 'pdf' : null);
                    }
                    const newMessage = {
                      from: pilgrimData.name,
                      message: chatInput,
                      date: new Date().toLocaleString(),
                      pilgrimId,
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
                {isAgentTyping && (
                  <div className="px-4 pb-2 text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="animate-spin h-3 w-3" /> Agent is typing...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Submit Registration Button BELOW the form */}
          <div>
            {!pilgrimData.registrationSubmitted && (
              <Button className="mt-4 w-full" onClick={handleSubmitRegistration} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </Button>
            )}
          </div>

          {/* Quick Actions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Travel Details")}>
                  <Calendar className="h-6 w-6 mb-2" />
                  Travel Details
                </Button>
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Itinerary")}>
                  <MapPin className="h-6 w-6 mb-2" />
                  Itinerary
                </Button>
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Appeal Status")}>
                  <Shield className="h-6 w-6 mb-2" />
                  Appeal Status
                </Button>
                <Button variant="outline" className="h-16 flex flex-col" onClick={() => setQuickAction("Contact Agent")}>
                  <MessageCircle className="h-6 w-6 mb-2" />
                  Contact Agent
                </Button>
              </div>
              {quickAction && (
                <div className="mt-6 p-4 border rounded-lg bg-muted">
                  <b>{quickAction}</b>
                  <div className="mt-2">
                    {quickAction === "Travel Details" && <div>Your travel details will appear here.</div>}
                    {quickAction === "Itinerary" && <div>Your itinerary will appear here.</div>}
                    {quickAction === "Appeal Status" && <div>No active appeals.</div>}
                    {quickAction === "Contact Agent" && <div>Contact your agent at: <b>{pilgrimData.registeredBy || "N/A"}</b></div>}
                  </div>
                  <Button className="mt-2" size="sm" onClick={() => setQuickAction(null)}>Close</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Document Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={open => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Document Preview</span>
            <Button size="icon" variant="ghost" onClick={() => setPreviewUrl(null)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {previewType === 'image' && previewUrl && (
            <img src={previewUrl} alt="Document Preview" className="max-h-[60vh] mx-auto rounded shadow" />
          )}
          {previewType === 'pdf' && previewUrl && (
            <iframe src={previewUrl} title="PDF Preview" className="w-full min-h-[60vh] rounded shadow" />
          )}
          {!previewType && previewUrl && (
            <div className="text-center text-muted-foreground">Cannot preview this file type. <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="underline">Open in new tab</a></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PilgrimDashboard;