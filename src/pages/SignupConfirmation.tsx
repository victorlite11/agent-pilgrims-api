import React from 'react';
import { Button } from '@/components/ui/button';
import { useLocation, useNavigate } from 'react-router-dom';

const SignupConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const assignedAgentId = params.get('assignedAgentId');
  const agentName = params.get('agentName');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
      <div className="w-full max-w-lg bg-card p-8 rounded shadow-card text-center">
        <h2 className="text-2xl font-bold mb-4">Signup Complete</h2>
        {assignedAgentId ? (
          <>
            <p className="mb-2">You have been assigned to agent {agentName ? `${agentName} (ID ${assignedAgentId})` : `#${assignedAgentId}` }.</p>
            <p className="text-sm text-muted-foreground mb-4">An agent will contact you soon to help complete your registration.</p>
            <Button onClick={() => navigate('/pilgrim-login')}>Go to Login</Button>
          </>
        ) : (
          <>
            <p className="mb-2">No agents are currently available.</p>
            <p className="text-sm text-muted-foreground mb-4">Your registration is saved and will be assigned when an agent becomes available. We'll notify you via email when an agent picks up your registration.</p>
            <Button onClick={() => navigate('/')}>Return to Home</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default SignupConfirmation;
