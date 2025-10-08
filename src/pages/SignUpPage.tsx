import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api';

const roles = [
	{ label: 'Pilgrim', value: 'pilgrim' },
	{ label: 'Agent', value: 'agent' },
	{ label: 'Admin', value: 'admin' },
];

const SignUpPage: React.FC = () => {
	const { toast } = useToast();
	// Determine initial role from query param
	const getInitialRole = () => {
		const params = new URLSearchParams(window.location.search);
		const roleParam = params.get('role');
		if (roleParam === 'agent' || roleParam === 'admin') return roleParam;
		return 'pilgrim';
	};
	const [role, setRole] = useState(getInitialRole());
	const [showRoleButtons, setShowRoleButtons] = useState(false);
	const [form, setForm] = useState({
		name: '',
		email: '',
		password: '',
		confirmPassword: '',
	});
	const [loading, setLoading] = useState(false);
	const [passportNumber, setPassportNumber] = useState('');
	const [agents, setAgents] = useState<any[]>([]);
	const [selectedAgentId, setSelectedAgentId] = useState<number | 'auto' | null>('auto');

	useEffect(() => {
		// Only show agent/admin signup buttons if navigated from login page
		const params = new URLSearchParams(window.location.search);
		const roleParam = params.get('role');
		setShowRoleButtons(roleParam === 'agent' || roleParam === 'admin');
		// fetch agents for pilgrim assignment (non-blocking)
		(async () => {
			try {
				const res = await fetch(`${API_BASE_URL}/agents`);
				if (!res.ok) return;
				const data = await res.json();
				setAgents(data || []);
			} catch (e) {
				// ignore
			}
		})();
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.name || !form.email || !form.password || !form.confirmPassword) {
			toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
			return;
		}
		if (form.password !== form.confirmPassword) {
			toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
			return;
		}
		setLoading(true);
		try {
			const payload: any = {
				name: form.name,
				email: form.email,
				password: form.password,
				role: role,
			};
			if (role === 'pilgrim') {
				payload.passportNumber = passportNumber || undefined;
				if (selectedAgentId && selectedAgentId !== 'auto') payload.agentId = selectedAgentId;
			}
			const res = await fetch(`${API_BASE_URL}/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			setLoading(false);
			if (data.success) {
				// Redirect pilgrims to a confirmation page that shows assigned agent (if any)
				if (role === 'pilgrim') {
					const params = new URLSearchParams();
					if (data.assignedAgentId) params.set('assignedAgentId', String(data.assignedAgentId));
					// look up agent name if we have agents loaded
					if (data.assignedAgentId) {
						const ag = agents.find(a => Number(a.id) === Number(data.assignedAgentId));
						if (ag && ag.name) params.set('agentName', ag.name);
					}
					window.location.href = `/signup-confirmation?${params.toString()}`;
				} else {
					toast({ title: 'Signup Successful', description: `Welcome, ${form.name}!` });
					setTimeout(() => { window.location.href = `/${role}-login`; }, 1200);
				}
			} else {
				toast({ title: 'Error', description: data.error || 'Signup failed', variant: 'destructive' });
			}
		} catch (err) {
			setLoading(false);
			toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
		}
	};

	// Paystack button handler (placeholder)
	const handlePaystack = () => {
		toast({ title: 'Paystack', description: 'Paystack payment initiated (mock). Integrate API next.' });
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-hero">
			<form onSubmit={handleSubmit} className="w-full max-w-md bg-card p-8 rounded shadow-card space-y-6">
				{/* Heading for Pilgrim signup */}
				{role === 'pilgrim' ? (
					<h2 className="text-2xl font-bold mb-2 text-center">Pilgrim Sign Up</h2>
				) : (
					<h2 className="text-2xl font-bold mb-2 text-center">Sign Up</h2>
				)}
				{/* Only show role buttons if agent/admin signup, otherwise only Pilgrim */}
				{showRoleButtons ? (
					<div className="flex justify-center gap-2 mb-4">
						{/* If admin, show only Admin button; if agent, show only Agent button; else show Pilgrim */}
						{(() => {
							const params = new URLSearchParams(window.location.search);
							const roleParam = params.get('role');
							if (roleParam === 'admin') {
								return (
									<Button
										key="admin"
										type="button"
										variant={role === 'admin' ? 'default' : 'outline'}
										onClick={() => setRole('admin')}
									>
										Admin
									</Button>
								);
							} else if (roleParam === 'agent') {
								return (
									<Button
										key="agent"
										type="button"
										variant={role === 'agent' ? 'default' : 'outline'}
										onClick={() => setRole('agent')}
									>
										Agent
									</Button>
								);
							} else if (roleParam === 'pilgrim') {
								return (
									<Button
										key="pilgrim"
										type="button"
										variant={role === 'pilgrim' ? 'default' : 'outline'}
										onClick={() => setRole('pilgrim')}
									>
										Pilgrim
									</Button>
								);
							} else {
								// Default: show only Pilgrim if no role param
								return (
									<Button
										key="pilgrim"
										type="button"
										variant={role === 'pilgrim' ? 'default' : 'outline'}
										onClick={() => setRole('pilgrim')}
									>
										Pilgrim
									</Button>
								);
							}
						})()}
					</div>
				) : null}
				<Input
					name="name"
					placeholder="Full Name"
					value={form.name}
					onChange={handleChange}
					autoComplete="name"
				/>
				<Input
					name="email"
					type="email"
					placeholder="Email"
					value={form.email}
					onChange={handleChange}
					autoComplete="email"
				/>
				<Input
					name="password"
					type="password"
					placeholder="Password"
					value={form.password}
					onChange={handleChange}
					autoComplete="new-password"
				/>
				<Input
					name="confirmPassword"
					type="password"
					placeholder="Confirm Password"
					value={form.confirmPassword}
					onChange={handleChange}
					autoComplete="new-password"
				/>
				{/* Passport number and agent selection for pilgrims */}
				{role === 'pilgrim' && (
					<>
						<Input
							name="passportNumber"
							placeholder="Passport Number"
							value={passportNumber}
							onChange={e => setPassportNumber(e.target.value)}
						/>
						<div>
							<label className="text-sm font-medium">Assign Agent</label>
							<select className="w-full border rounded px-2 py-1 mt-1" value={selectedAgentId === null ? 'auto' : selectedAgentId as any} onChange={e => setSelectedAgentId(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
								<option value="auto">Auto-assign (recommended)</option>
								{agents.map(a => (
									<option key={a.id} value={a.id}>{a.name} {a.status ? `(${a.status})` : ''}</option>
								))}
							</select>
						</div>
					</>
				)}
				{/* Paystack payment step for pilgrims only (to be implemented) */}
				{role === 'pilgrim' && (
					<div className="text-center mt-2">
						<Button type="button" variant="default" className="w-full font-bold bg-gradient-to-r from-blue-700 via-blue-500 to-blue-400 text-white" onClick={handlePaystack}>
							Pay with Paystack
						</Button>
					</div>
				)}
				<Button type="submit" className="w-full" disabled={loading}>
					{loading ? 'Signing Up...' : 'Sign Up'}
				</Button>
				<Button type="button" variant="outline" className="w-full" onClick={() => window.location.href = '/'}>
					Back to Main Dashboard
				</Button>
				<Button type="button" variant="link" className="w-full mt-2" onClick={() => window.location.href = `/${role}-login`}>
					Back to Login
				</Button>
			</form>
		</div>
	);
};

export default SignUpPage;
