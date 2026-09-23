'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
  Trash2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { UserRole } from '@ongc/shared-types';

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.GATE_OPERATOR);
  const [gateId, setGateId] = useState('');
  const [password, setPassword] = useState('OngcPass@2026');

  const loadData = async () => {
    try {
      setLoading(true);
      const [staffData, gatesData] = await Promise.all([
        fetchApi('/admin/staff'),
        fetchApi('/admin/gates'),
      ]);
      setStaffList(staffData || []);
      setGates(gatesData || []);
      if (gatesData && gatesData.length > 0 && !gateId) {
        setGateId(gatesData[0].id);
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to load staff list', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          role,
          gateId: gateId || undefined,
          password,
        }),
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      loadData();
      setMsg({ text: 'Staff member created successfully', type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Failed to create staff member');
    }
  };

  const handleAssignGate = async (userId: string, targetGateId: string) => {
    try {
      await fetchApi(`/admin/staff/${userId}/assign-gate`, {
        method: 'POST',
        body: JSON.stringify({ gateId: targetGateId }),
      });
      loadData();
      setMsg({ text: 'Gate assigned successfully', type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Failed to assign gate');
    }
  };

  const handleUnassignGate = async (userId: string, targetGateId: string) => {
    try {
      await fetchApi(`/admin/staff/${userId}/gates/${targetGateId}`, {
        method: 'DELETE',
      });
      loadData();
      setMsg({ text: 'Gate unassigned successfully', type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Failed to unassign gate');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-red-500" />
            Staff & Operator Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage turnstile gate operators, supervisors, and help desk staff assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Staff Member</th>
                <th className="px-6 py-4">Staff ID</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Assigned Gates</th>
                <th className="px-6 py-4">Assign New Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-800/30">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-sm">{staff.name}</div>
                    <div className="text-slate-400 text-[11px]">{staff.email}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-amber-400">
                    {staff.staffId || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold">
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {staff.assignedGates && staff.assignedGates.length > 0 ? (
                        staff.assignedGates.map((ag: any) => (
                          <span
                            key={ag.assignmentId}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700"
                          >
                            <span>Gate {ag.gateNumber}</span>
                            <button
                              onClick={() => handleUnassignGate(staff.id, ag.gateId)}
                              className="text-slate-500 hover:text-red-400"
                              title="Unassign Gate"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">None assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignGate(staff.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="" disabled>
                        + Assign Gate...
                      </option>
                      {gates.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create Staff Member</h3>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="suresh@ongcnavratri.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value={UserRole.GATE_OPERATOR}>Gate Scanner Operator</option>
                  <option value={UserRole.GATE_SUPERVISOR}>Gate Supervisor</option>
                  <option value={UserRole.HELP_DESK}>Help Desk Staff</option>
                  <option value={UserRole.ADMIN}>Event Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Initial Gate Assignment
                </label>
                <select
                  value={gateId}
                  onChange={(e) => setGateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value="">No Gate Assigned</option>
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
