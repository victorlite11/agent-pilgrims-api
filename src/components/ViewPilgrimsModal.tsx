import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ViewPilgrimsModalProps {
  open: boolean;
  onClose: () => void;
}

const ViewPilgrimsModal = ({ open, onClose }: ViewPilgrimsModalProps) => {
  const [pilgrims, setPilgrims] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
  fetch("https://agent-pilgrims-api.onrender.com/pilgrims")
        .then((res) => res.json())
        .then((data) => setPilgrims(data))
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>All Pilgrims</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pilgrims.length === 0 && <div>No pilgrims found.</div>}
            {pilgrims.map((p: any) => (
              <div key={p.id} className="border rounded p-2 flex flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">Status: {p.status}</span>
                <span className="text-xs text-muted-foreground">Agent ID: {p.agentId}</span>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onClose} className="mt-4 w-full">Close</Button>
      </DialogContent>
    </Dialog>
  );
};

export default ViewPilgrimsModal;
