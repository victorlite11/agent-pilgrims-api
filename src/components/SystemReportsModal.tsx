import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SystemReportsModalProps {
  open: boolean;
  onClose: () => void;
}

const SystemReportsModal = ({ open, onClose }: SystemReportsModalProps) => {
  const [stats, setStats] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [pilgrims, setPilgrims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
  fetch("https://agent-pilgrims-api.onrender.com/stats").then(res => res.json()),
  fetch("https://agent-pilgrims-api.onrender.com/agents").then(res => res.json()),
  fetch("https://agent-pilgrims-api.onrender.com/pilgrims").then(res => res.json())
      ]).then(([statsData, agentsData, pilgrimsData]) => {
        setStats(statsData);
        setAgents(agentsData);
        setPilgrims(pilgrimsData);
      }).finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>System Reports</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div>Loading...</div>
        ) : stats ? (
          <div className="space-y-4">
            <div>
              <strong>Total Agents:</strong> {agents.length}
            </div>
            <div>
              <strong>Total Pilgrims:</strong> {pilgrims.length}
            </div>
            <div>
              <strong>Revenue:</strong> ${stats.totalRevenue?.toLocaleString()}
            </div>
            <div>
              <strong>Banned Pilgrims:</strong> {stats.bannedPilgrims}
            </div>
            <div>
              <strong>Active Registrations:</strong> {stats.activeRegistrations}
            </div>
            <div>
              <strong>Active Agents:</strong> {agents.filter(a => a.status === "Active").length}
            </div>
            <div>
              <strong>Suspended Agents:</strong> {agents.filter(a => a.status === "Suspended").length}
            </div>
            <div>
              <strong>Banned Pilgrims List:</strong>
              <ul className="list-disc ml-6">
                {pilgrims.filter((p: any) => p.status === "Banned").map((p: any) => (
                  <li key={p.id}>{p.name}</li>
                ))}
                {pilgrims.filter((p: any) => p.status === "Banned").length === 0 && <li>None</li>}
              </ul>
            </div>
          </div>
        ) : (
          <div>No report data found.</div>
        )}
        <Button onClick={onClose} className="mt-4 w-full">Close</Button>
      </DialogContent>
    </Dialog>
  );
};

export default SystemReportsModal;
