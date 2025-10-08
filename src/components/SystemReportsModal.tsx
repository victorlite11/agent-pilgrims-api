import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface SystemReportsModalProps {
  open: boolean;
  onClose: () => void;
}

const SystemReportsModal = ({ open, onClose }: SystemReportsModalProps) => {
  const [stats, setStats] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [pilgrims, setPilgrims] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setLoading(true);
      (async () => {
        try {
          const [statsRes, agentsRes, pilgrimsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/stats`),
            fetch(`${API_BASE_URL}/agents`),
            fetch(`${API_BASE_URL}/pilgrims`)
          ]);
          if (!statsRes.ok || !agentsRes.ok || !pilgrimsRes.ok) throw new Error('Failed to fetch report data');
          const [statsData, agentsData, pilgrimsData] = await Promise.all([statsRes.json(), agentsRes.json(), pilgrimsRes.json()]);
          setStats(statsData);
          setAgents(agentsData);
          setPilgrims(pilgrimsData);
        } catch (e) {
          toast({ title: 'Error', description: 'Unable to load system reports.', variant: 'destructive' });
          setStats(null);
          setAgents([]);
          setPilgrims([]);
        } finally {
          setLoading(false);
        }
      })();
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
