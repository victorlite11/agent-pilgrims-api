import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ManageBansModalProps {
  open: boolean;
  onClose: () => void;
}

const ManageBansModal = ({ open, onClose }: ManageBansModalProps) => {
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

  const handleBanToggle = async (id: number, isBanned: boolean) => {
    const newStatus = isBanned ? "Active" : "Banned";
  await fetch(`https://agent-pilgrims-api.onrender.com/pilgrims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    setPilgrims((prev: any) => prev.map((p: any) => p.id === id ? { ...p, status: newStatus } : p));
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
