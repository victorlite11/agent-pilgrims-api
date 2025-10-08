import React, { useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const defaultFields = {
  name: "",
  email: "",
  password: "",
  passportNumber: "",
  status: "pending",
  progress: 0,
  rejectionCount: 0,
  acceptanceCount: 0,
  travelHistory: "",
  currentJourneyStatus: "not started"
};

const RegisterPilgrimModal = ({ agentId, agentName, onRegistered, onClose, initialData = null }) => {
  const [fields, setFields] = useState(initialData ? { ...defaultFields, ...initialData } : defaultFields);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = e => {
    setFields({ ...fields, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
  const res = await fetch(`${API_BASE_URL}/pilgrims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // include agentName as registeredBy so pilgrim shows who registered/approved them
        body: JSON.stringify({ ...fields, agentId, registeredBy: agentName || '' })
      });
      const data = await res.json();
      setLoading(false);
      if (data.id) {
        onRegistered && onRegistered();
        onClose && onClose();
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setLoading(false);
      setError("Network error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register Pilgrim</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <Input name="name" placeholder="Full Name" value={fields.name} onChange={handleChange} required />
            <Input name="email" type="email" placeholder="Email" value={fields.email} onChange={handleChange} required />
            <Input name="password" type="password" placeholder="Password" value={fields.password} onChange={handleChange} required />
            <Input name="passportNumber" placeholder="Passport Number" value={fields.passportNumber} onChange={handleChange} required />
            <Input name="status" placeholder="Status" value={fields.status} onChange={handleChange} />
            <Input name="progress" type="number" placeholder="Progress (%)" value={fields.progress} onChange={handleChange} />
            <Input name="rejectionCount" type="number" placeholder="Rejection Count" value={fields.rejectionCount} onChange={handleChange} />
            <Input name="acceptanceCount" type="number" placeholder="Acceptance Count" value={fields.acceptanceCount} onChange={handleChange} />
            <Input name="travelHistory" placeholder="Travel History" value={fields.travelHistory} onChange={handleChange} />
            <Input name="currentJourneyStatus" placeholder="Current Journey Status" value={fields.currentJourneyStatus} onChange={handleChange} />
            <div className="flex gap-2 mt-4">
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Registering..." : "Register"}</Button>
              <Button type="button" variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPilgrimModal;
