import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ManageBansModalProps {
  open: boolean;
  onClose: () => void;
}

const ManageBansModal = ({ open, onClose }: ManageBansModalProps) => {
  const [pilgrims, setPilgrims] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setLoading(true);
      (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/pilgrims`);
          if (!res.ok) throw new Error('Failed to fetch pilgrims');
          const data = await res.json();
          setPilgrims(data || []);
        } catch (e: any) {
          setPilgrims([]);
          toast({ title: 'Error', description: 'Unable to load pilgrims for bans.', variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open, toast]);

  const handleBanToggle = async (id: number, isBanned: boolean) => {
    const newStatus = isBanned ? "Active" : "Banned";
    try {
      const res = await fetch(`${API_BASE_URL}/pilgrims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      setPilgrims((prev: any) => prev.map((p: any) => p.id === id ? { ...p, status: newStatus } : p));
      toast({ title: 'Success', description: `Pilgrim ${isBanned ? 'unbanned' : 'banned'}.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update ban status.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Bans</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pilgrims.filter((p: any) => p.status === "Banned").length === 0 && <div>No banned pilgrims.</div>}
            {pilgrims.map((p: any) => (
              <div key={p.id} className="border rounded p-2 flex items-center justify-between">
                <div>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">Status: {p.status}</span>
                </div>
                <Button size="sm" variant={p.status === "Banned" ? "default" : "outline"} onClick={() => handleBanToggle(p.id, p.status === "Banned")}>{p.status === "Banned" ? "Unban" : "Ban"}</Button>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onClose} className="mt-4 w-full">Close</Button>
      </DialogContent>
    </Dialog>
  );
};

export default ManageBansModal;
