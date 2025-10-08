import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api";

interface DocumentUploadModalProps {
  onDocumentUpload: (document: any) => void;
  defaultName?: string;
}

const DocumentUploadModal = ({ onDocumentUpload, defaultName }: DocumentUploadModalProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(defaultName || "");
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const documentTypes = [
    "Passport Copy",
    "NIN",
    "Health Certificate",
    "Baptism Certificate",
    "Photo ID",
    "Passport Photograph",
    "Travel Insurance",
    "Emergency Contact Form"
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPG, PNG, or PDF file.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !documentType) {
      toast({
        title: "Missing information",
        description: "Please select both a document type and file.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Upload file to backend
    let fileUrl = null;
    try {
      const formData = new FormData();
      formData.append('file', selectedFile as File);
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('[UPLOAD ERROR]', res.status, txt);
        toast({ title: 'Upload failed', description: 'Server rejected the file upload.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      fileUrl = data.fileUrl;
      // normalize to absolute URL if backend returned a relative path
      if (fileUrl && fileUrl.startsWith('/')) {
        fileUrl = `${API_BASE_URL.replace(/\/$/, '')}${fileUrl}`;
      }
    } catch (e) {
      console.error('[UPLOAD EXCEPTION]', e);
      toast({ title: 'Upload failed', description: 'Could not upload file.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const newDocument = {
      id: Date.now(),
      name: documentType,
      status: "Under Review",
      date: new Date().toISOString().split('T')[0],
      fileName: selectedFile.name,
      fileSize: (selectedFile.size / 1024).toFixed(1) + " KB",
      fileUrl
    };

    onDocumentUpload(newDocument);

    toast({
      title: "Document uploaded successfully!",
      description: `${documentType} has been submitted for review.`,
    });

    // Reset form
    setSelectedFile(null);
    setDocumentType(defaultName || "");
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-primary">
          <Upload className="mr-2 h-4 w-4" />
          {t("Upload New")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary" />
            {t("Upload Document")}
          </DialogTitle>
          <DialogDescription>
            Upload a required document for your Christian pilgrimage registration.
          </DialogDescription>
        </DialogHeader>
        {/* Language Switcher */}
        <div className="mb-4 flex gap-2 justify-end">
          <Button size="sm" variant={i18n.language === "en" ? "default" : "outline"} onClick={() => i18n.changeLanguage("en")}>EN</Button>
          <Button size="sm" variant={i18n.language === "fr" ? "default" : "outline"} onClick={() => i18n.changeLanguage("fr")}>FR</Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="documentType">{t("Document Type")} *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder={t("Select document type")} />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">{t("Select File")} *</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                id="file"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file" className="cursor-pointer">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  {t("Click to select a file or drag and drop")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("JPG, PNG, or PDF (max 5MB)")}
                </p>
              </label>
            </div>
            {selectedFile && (
              <div className="flex items-center space-x-2 p-3 bg-secondary/20 rounded-lg">
                <FileText className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-start space-x-2 p-3 bg-warning/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-xs text-warning">
              <p className="font-medium mb-1">{t("Important Notes")}</p>
              <ul className="space-y-1">
                <li>• {t("Documents must be clear and legible")}</li>
                <li>• {t("All text must be in English or translated")}</li>
                <li>• {t("Processing may take 2-3 business days")}</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {t("Cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !selectedFile || !documentType}
              className="bg-gradient-primary"
            >
              {isLoading ? "Uploading..." : t("Upload Document")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentUploadModal;