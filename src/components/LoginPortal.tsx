import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import ForgotPasswordForm from "./ForgotPasswordForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Shield, Users, FileCheck } from "lucide-react";
import pilgrimIcon from "@/assets/pilgrim-icon.jpg";
import { API_BASE_URL } from "@/lib/api";

interface LoginPortalProps {
  userType: 'admin' | 'agent' | 'pilgrim';
}

const LoginPortal = ({ userType }: LoginPortalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const userTypeConfig = {
    admin: {
      title: "Administrator Portal",
      description: "Access system-wide management and oversight",
      icon: Shield,
      color: "text-destructive"
    },
    agent: {
      title: "Travel Agent Portal", 
      description: "Manage Christian pilgrim registrations and payments",
      icon: Users,
      color: "text-primary"
    },
    pilgrim: {
      title: "Pilgrim Portal",
      description: "View your Christian pilgrimage registration status and documents",
      icon: FileCheck,
      color: "text-accent"
    }
  };

  const config = userTypeConfig[userType];
  const IconComponent = config.icon;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
  const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: userType })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed. Please try again.");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        if (userType === "admin") {
          localStorage.setItem("admin_token", "real_admin_token");
        } else if (userType === "agent") {
          // store real token and agent id returned by server
          try { if (data.token) localStorage.setItem('agent_token', data.token); else localStorage.setItem('agent_token','real_agent_token'); } catch (e) { localStorage.setItem('agent_token','real_agent_token'); }
          try { if (data.user && data.user.id) localStorage.setItem('agent_id', String(data.user.id)); } catch (e) {}
        } else if (userType === "pilgrim") {
          localStorage.setItem("pilgrim_token", "real_pilgrim_token");
          localStorage.setItem("pilgrim_id", data.user.id.toString());
        }
        window.location.href = `/${userType}-dashboard`;
      } else {
        setError(data.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Back Navigation */}
        <Button 
          variant="ghost" 
          className="mb-6 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => {
            const link = document.createElement('a');
            link.href = '/';
            link.click();
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        {/* Login Card */}
        <Card className="shadow-floating border-0">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center mb-4">
              <img 
                src={pilgrimIcon} 
                alt="Pilgrim Management System" 
                className="h-12 w-12 rounded-lg shadow-card mr-3"
              />
              <IconComponent className={`h-12 w-12 ${config.color}`} />
            </div>
            <CardTitle className="text-2xl font-heading">{config.title}</CardTitle>
            <CardDescription className="text-base">{config.description}</CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="text-red-500 text-center text-sm font-semibold">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-gradient-primary"
                disabled={isLoading || !email || !password}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>

              <div className="text-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="link" className="text-sm text-muted-foreground">
                      Forgot your password?
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md w-full">
                    <ForgotPasswordForm />
                  </DialogContent>
                </Dialog>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sign Up Section for admin/agent */}
        {(userType === "admin" || userType === "agent") && (
          <div className="text-center mt-6">
            <p className="text-sm text-primary-foreground/80 mb-2">
              Don&apos;t have an account?&nbsp;
              <Button variant="link" className="text-sm p-0" onClick={() => {
                window.location.href = `/signup?role=${userType}`;
              }}>
                Sign Up
              </Button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPortal;