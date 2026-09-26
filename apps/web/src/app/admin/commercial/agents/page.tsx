'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Trash2,
  UserX,
  UserCheck,
  Eye,
  Ticket,
  Calendar,
  Phone,
  Mail,
  X,
  AlertTriangle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

const PASS_TYPES = [
  { code: 'COMMERCIAL_DAILY', name: 'Daily Pass' },
  { code: 'COMMERCIAL_SEASON', name: 'Season Pass' },
  { code: 'COMMERCIAL_MANDLI', name: 'Mandli Pass' },
  { code: 'COMMERCIAL_ANY_DAY', name: 'Any Day Pass' },
];

type FilterType = 'ALL' | 'MASTER' | 'SUB' | 'HAS_SALES' | 'HAS_AVAILABLE' | 'ACTIVE' | 'INACTIVE';

export default function CommercialAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Expanded Master Agents Set
  const [expandedMasterIds, setExpandedMasterIds] = useState<Set<string>>(new Set());

  // Overflow action menu state: agentId -> boolean
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Register Agent Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    staffId: '',
  });
  const [registering, setRegistering] = useState(false);

  // Allocate Modal
  const [selectedAgentForAlloc, setSelectedAgentForAlloc] = useState<any>(null);
  const [allocPassType, setAllocPassType] = useState('COMMERCIAL_DAILY');
  const [allocQuantity, setAllocQuantity] = useState<number>(50);
  const [allocating, setAllocating] = useState(false);

  // Reclaim Modal
  const [selectedAgentForReclaim, setSelectedAgentForReclaim] = useState<any>(null);
  const [reclaimPassType, setReclaimPassType] = useState('COMMERCIAL_DAILY');
  const [reclaimQuantity, setReclaimQuantity] = useState<number>(10);
  const [reclaimNotes, setReclaimNotes] = useState('');
  const [reclaiming, setReclaiming] = useState(false);

  // Agent Details Drawer / Modal
  const [detailsAgentId, setDetailsAgentId] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Delete Agent Modal
  const [agentToDelete, setAgentToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deactivate/Activate Confirmation Modal
  const [agentToToggle, setAgentToToggle] = useState<any | null>(null);
  const [toggling, setToggling] = useState(false);

  // Close open menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
        if (detailsAgentId) setDetailsAgentId(null);
        if (agentToDelete) setAgentToDelete(null);
        if (agentToToggle) setAgentToToggle(null);
        if (showRegisterModal) setShowRegisterModal(false);
        if (selectedAgentForAlloc) setSelectedAgentForAlloc(null);
        if (selectedAgentForReclaim) setSelectedAgentForReclaim(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsAgentId, agentToDelete, agentToToggle, showRegisterModal, selectedAgentForAlloc, selectedAgentForReclaim]);

  // Load all agents from backend
  const loadAgents = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await fetchApi('/admin/commercial/agents?limit=100');
      const list = res.agents || [];
      setAgents(list);

      // Auto-expand all master agents initially
      const masterIds = new Set<string>();
      list.forEach((ag: any) => {
        if (!ag.parentAgent) {
          masterIds.add(ag.id);
        }
      });
      setExpandedMasterIds(masterIds);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load agents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Auto-expand parent master agent when a sub-agent matches search
  useEffect(() => {
    if (search.trim() !== '') {
      const q = search.trim().toLowerCase();
      const newExpanded = new Set(expandedMasterIds);
      agents.forEach((ag) => {
        if (ag.parentAgent) {
          const matchSub =
            ag.name.toLowerCase().includes(q) ||
            ag.email.toLowerCase().includes(q) ||
            (ag.phone && ag.phone.toLowerCase().includes(q)) ||
            (ag.staffId && ag.staffId.toLowerCase().includes(q));
          if (matchSub) {
            newExpanded.add(ag.parentAgent.id);
          }
        }
      });
      setExpandedMasterIds(newExpanded);
    }
  }, [search, agents]);

  // Fetch Agent Details for Drawer
  const openAgentDetails = async (agentId: string) => {
    setOpenMenuId(null);
    setDetailsAgentId(agentId);
    setLoadingDetails(true);
    setAgentDetails(null);
    try {
      const res = await fetchApi(`/admin/commercial/agents/${agentId}/details`);
      setAgentDetails(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load agent details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Toggle Master Agent expansion
  const toggleMasterExpand = (masterId: string) => {
    setExpandedMasterIds((prev) => {
      const next = new Set(prev);
      if (next.has(masterId)) {
        next.delete(masterId);
      } else {
        next.add(masterId);
      }
      return next;
    });
  };

  // Handle Register Agent
  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      await fetchApi('/admin/commercial/agents', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      });
      setShowRegisterModal(false);
      setRegisterForm({ name: '', email: '', phone: '', password: '', staffId: '' });
      setActionSuccessMsg('Agent registered successfully.');
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to register agent.');
    } finally {
      setRegistering(false);
    }
  };

  // Handle Allocate Passes
  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForAlloc) return;
    setAllocating(true);
    try {
      await fetchApi(`/admin/commercial/agents/${selectedAgentForAlloc.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          passType: allocPassType,
          quantity: allocQuantity,
        }),
      });
      setSelectedAgentForAlloc(null);
      setActionSuccessMsg('Inventory allocated successfully.');
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to allocate inventory.');
    } finally {
      setAllocating(false);
    }
  };

  // Handle Reclaim Passes
  const handleReclaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForReclaim) return;
    setReclaiming(true);
    try {
      await fetchApi(`/admin/commercial/agents/${selectedAgentForReclaim.id}/reclaim`, {
        method: 'POST',
        body: JSON.stringify({
          passType: reclaimPassType,
          quantity: reclaimQuantity,
          notes: reclaimNotes || undefined,
        }),
      });
      setSelectedAgentForReclaim(null);
      setReclaimNotes('');
      setActionSuccessMsg('Inventory reclaimed successfully.');
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to reclaim inventory.');
    } finally {
      setReclaiming(false);
    }
  };

  // Handle Toggle Status (Activate / Deactivate)
  const handleConfirmToggleStatus = async () => {
    if (!agentToToggle) return;
    setToggling(true);
    try {
      const res = await fetchApi(`/admin/commercial/agents/${agentToToggle.id}/toggle-status`, {
        method: 'POST',
      });
      setAgentToToggle(null);
      setActionSuccessMsg(res.message || 'Agent status updated.');
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to update agent status.');
    } finally {
      setToggling(false);
    }
  };

  // Handle Delete Agent
  const handleConfirmDeleteAgent = async () => {
    if (!agentToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetchApi(`/admin/commercial/agents/${agentToDelete.id}`, {
        method: 'DELETE',
      });
      setAgentToDelete(null);
      setActionSuccessMsg(res.message || 'Agent deleted successfully.');
      loadAgents();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete agent.');
    } finally {
      setDeleting(false);
    }
  };

  // Top Metrics
  const totalAllocatedAll = useMemo(
    () => agents.reduce((sum, a) => sum + (a.summary?.totalAllocated || 0), 0),
    [agents],
  );
  const totalBookedAll = useMemo(
    () => agents.reduce((sum, a) => sum + (a.summary?.totalBooked || 0), 0),
    [agents],
  );
  const totalAvailableAll = useMemo(
    () => agents.reduce((sum, a) => sum + (a.summary?.totalAvailable || 0), 0),
    [agents],
  );
  const masterAgentsCount = useMemo(
    () => agents.filter((a) => !a.parentAgent).length,
    [agents],
  );
  const subAgentsCount = useMemo(
    () => agents.filter((a) => !!a.parentAgent).length,
    [agents],
  );

  // Group Agents into Master -> Sub-Agents Hierarchy
  const hierarchicalAgents = useMemo(() => {
    const q = search.trim().toLowerCase();

    // Map all agents by ID
    const agentMap = new Map<string, any>();
    agents.forEach((ag) => {
      agentMap.set(ag.id, { ...ag, subAgentsList: [] });
    });

    // Populate sub-agents into masters
    const topLevelMasters: any[] = [];
    const orphanSubAgents: any[] = [];

    agentMap.forEach((ag) => {
      if (ag.parentAgent && agentMap.has(ag.parentAgent.id)) {
        agentMap.get(ag.parentAgent.id).subAgentsList.push(ag);
      } else if (ag.parentAgent) {
        orphanSubAgents.push(ag);
      } else {
        topLevelMasters.push(ag);
      }
    });

    // Apply Filter + Search
    const filterAndSearchGroup = (master: any) => {
      const matchesMasterSearch =
        q === '' ||
        master.name.toLowerCase().includes(q) ||
        master.email.toLowerCase().includes(q) ||
        (master.phone && master.phone.toLowerCase().includes(q)) ||
        (master.staffId && master.staffId.toLowerCase().includes(q));

      // Filter sub-agents matching search
      const matchingSubAgents = master.subAgentsList.filter((sub: any) => {
        if (q === '') return true;
        return (
          sub.name.toLowerCase().includes(q) ||
          sub.email.toLowerCase().includes(q) ||
          (sub.phone && sub.phone.toLowerCase().includes(q)) ||
          (sub.staffId && sub.staffId.toLowerCase().includes(q))
        );
      });

      // Filter condition check
      const applyFilterCheck = (item: any, isMaster: boolean) => {
        if (activeFilter === 'ALL') return true;
        if (activeFilter === 'MASTER') return isMaster;
        if (activeFilter === 'SUB') return !isMaster;
        if (activeFilter === 'HAS_SALES') return (item.ordersCount || 0) > 0;
        if (activeFilter === 'HAS_AVAILABLE') return (item.summary?.totalAvailable || 0) > 0;
        if (activeFilter === 'ACTIVE') return item.isActive;
        if (activeFilter === 'INACTIVE') return !item.isActive;
        return true;
      };

      const masterPassesFilter = applyFilterCheck(master, true);
      const filteredSubs = matchingSubAgents.filter((sub: any) => applyFilterCheck(sub, false));

      if (activeFilter === 'SUB') {
        // If filtering strictly for sub-agents, include master only if it has matching sub-agents
        if (filteredSubs.length > 0) {
          return {
            ...master,
            subAgentsList: filteredSubs,
            visible: true,
          };
        }
        return null;
      }

      if (matchesMasterSearch || filteredSubs.length > 0) {
        if (masterPassesFilter || filteredSubs.length > 0) {
          return {
            ...master,
            subAgentsList: filteredSubs,
            visible: true,
          };
        }
      }

      return null;
    };

    const result = topLevelMasters
      .map(filterAndSearchGroup)
      .filter((m): m is any => m !== null);

    // If there are orphan sub-agents (whose parent was deleted or not top-level)
    if (orphanSubAgents.length > 0 && activeFilter !== 'MASTER') {
      orphanSubAgents.forEach((orphan) => {
        const matchesOrphan =
          q === '' ||
          orphan.name.toLowerCase().includes(q) ||
          orphan.email.toLowerCase().includes(q) ||
          (orphan.phone && orphan.phone.toLowerCase().includes(q));
        if (matchesOrphan) {
          result.push({
            ...orphan,
            isOrphanSubAgent: true,
            subAgentsList: [],
            visible: true,
          });
        }
      });
    }

    return result;
  }, [agents, search, activeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-[11px] font-bold text-stone-500 uppercase font-outfit">Total Agents</div>
          <div className="text-2xl font-outfit font-black text-ink mt-1">{agents.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-[11px] font-bold text-stone-500 uppercase font-outfit">Master Agents</div>
          <div className="text-2xl font-outfit font-black text-blue-900 mt-1">{masterAgentsCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-[11px] font-bold text-stone-500 uppercase font-outfit">Sub-Agents</div>
          <div className="text-2xl font-outfit font-black text-amber-900 mt-1">{subAgentsCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-[11px] font-bold text-stone-500 uppercase font-outfit">Total Allocated</div>
          <div className="text-2xl font-outfit font-black text-maroon mt-1">{totalAllocatedAll}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-[11px] font-bold text-stone-500 uppercase font-outfit">Direct Sales</div>
          <div className="text-2xl font-outfit font-black text-emerald-700 mt-1">{totalBookedAll}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-[11px] font-bold text-stone-500 uppercase font-outfit">Total Available</div>
          <div className="text-2xl font-outfit font-black text-amber-700 mt-1">{totalAvailableAll}</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Actions */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by agent name, email, mobile, staff ID, parent..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => loadAgents()}
              className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
              title="Refresh Agents List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Agent</span>
            </button>
          </div>
        </div>

        {/* Compact Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'MASTER', label: 'Master Agents' },
            { id: 'SUB', label: 'Sub-Agents' },
            { id: 'HAS_SALES', label: 'Has Sales' },
            { id: 'HAS_AVAILABLE', label: 'Has Available Quota' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'INACTIVE', label: 'Inactive' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as FilterType)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === f.id
                  ? 'bg-maroon text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hierarchical Expandable Agents View */}
      {loading ? (
        <div className="p-16 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-maroon mb-2" />
          Loading agents network...
        </div>
      ) : hierarchicalAgents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
          No agents found matching the current search and filter criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {hierarchicalAgents.map((master) => {
            const isExpanded = expandedMasterIds.has(master.id);
            const subAgents = master.subAgentsList || [];
            const hasSubAgents = subAgents.length > 0;
            const isOrphan = !!master.isOrphanSubAgent;

            return (
              <div
                key={master.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Master Agent Header Card */}
                <div
                  className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isOrphan ? 'bg-amber-50/50' : 'bg-gradient-to-r from-stone-50/60 to-white'
                  }`}
                >
                  {/* Left: Expand toggle, Profile & Role Badge */}
                  <div className="flex items-start gap-3 min-w-0">
                    {hasSubAgents ? (
                      <button
                        onClick={() => toggleMasterExpand(master.id)}
                        className="p-1.5 rounded-lg hover:bg-stone-200/60 text-stone-600 transition-colors mt-0.5 cursor-pointer"
                        title={isExpanded ? 'Collapse Sub-Agents' : 'Expand Sub-Agents'}
                        aria-label={isExpanded ? 'Collapse Sub-Agents' : 'Expand Sub-Agents'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-maroon" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-stone-500" />
                        )}
                      </button>
                    ) : (
                      <div className="w-8 flex items-center justify-center mt-1">
                        <span className="w-2 h-2 rounded-full bg-stone-300"></span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-outfit font-black text-sm sm:text-base text-ink truncate">
                          {master.name}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isOrphan
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {isOrphan ? 'Sub-Agent (Direct)' : 'Master Agent'}
                        </span>
                        {!master.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                        <span className="font-mono text-stone-600">{master.email}</span>
                        {master.phone && <span>• {master.phone}</span>}
                        {master.staffId && (
                          <span className="font-mono text-maroon font-semibold">
                            • Staff ID: {master.staffId}
                          </span>
                        )}
                      </div>

                      {hasSubAgents && (
                        <div className="text-[11px] font-bold text-stone-500 mt-1.5 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-maroon" />
                          <span>{subAgents.length} Sub-Agent{subAgents.length > 1 ? 's' : ''} under network</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Quota Allocations & Sales Metrics */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 py-2 lg:py-0 border-y lg:border-y-0 border-stone-100">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-stone-400">Allocations</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {master.allocations?.map((al: any) => (
                          <span
                            key={al.id}
                            className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-700 border border-stone-200/60"
                          >
                            {al.passType.replace('COMMERCIAL_', '')}: {al.availableQuantity} / {al.allocatedQuantity}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-stone-400">Direct Sales</div>
                      <div className="text-sm font-outfit font-extrabold text-emerald-700 mt-0.5">
                        {master.ordersCount || 0} Orders
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-stone-400">Available Quota</div>
                      <div className="text-sm font-outfit font-black text-maroon mt-0.5">
                        {master.summary?.totalAvailable || 0} Passes
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Buttons & Overflow Menu */}
                  <div className="flex items-center gap-1.5 self-end lg:self-center shrink-0 relative">
                    <button
                      onClick={() => setSelectedAgentForAlloc(master)}
                      className="px-3 py-1.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors shadow-xs cursor-pointer"
                    >
                      Allocate
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAgentForReclaim(master);
                        setReclaimPassType(master.allocations?.[0]?.passType || 'COMMERCIAL_DAILY');
                      }}
                      className="px-3 py-1.5 rounded-xl border border-stone-300 text-stone-700 font-outfit font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      Reclaim
                    </button>

                    {/* Overflow Button */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === master.id ? null : master.id)}
                        className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
                        title="More Actions"
                        aria-label="More Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuId === master.id && (
                        <div
                          className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-30 animate-in fade-in"
                          role="menu"
                        >
                          <button
                            onClick={() => openAgentDetails(master.id)}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                            role="menuitem"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-400" />
                            <span>View Details</span>
                          </button>

                          <Link
                            href={`/admin/commercial/orders?agentId=${master.id}&source=AGENT`}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                            role="menuitem"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                            <span>View Orders</span>
                          </Link>

                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              setAgentToToggle(master);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                            role="menuitem"
                          >
                            {master.isActive ? (
                              <>
                                <UserX className="w-3.5 h-3.5 text-amber-600" />
                                <span>Deactivate Agent</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Activate Agent</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              setAgentToDelete(master);
                              setDeleteError(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-stone-100"
                            role="menuitem"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete Agent</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-Agents Hierarchy Child List */}
                {hasSubAgents && isExpanded && (
                  <div className="bg-stone-50/70 border-t border-stone-200/80 pl-4 sm:pl-8 pr-4 sm:pr-6 py-4 space-y-3">
                    <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5 pb-1">
                      <Layers className="w-3.5 h-3.5 text-maroon" />
                      <span>Sub-Agents under {master.name}</span>
                    </div>

                    <div className="space-y-2">
                      {subAgents.map((sub: any, idx: number) => (
                        <div
                          key={sub.id}
                          className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 relative shadow-2xs hover:border-gold/60 transition-colors"
                        >
                          {/* Tree connecting branch indicator */}
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="text-stone-300 font-mono text-sm select-none hidden sm:inline-block">
                              {idx === subAgents.length - 1 ? '└──' : '├──'}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-outfit font-bold text-sm text-ink">{sub.name}</span>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  Sub-Agent
                                </span>
                                {!sub.isActive && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-0.5 flex flex-wrap gap-x-2">
                                <span>{sub.email}</span>
                                {sub.phone && <span>• {sub.phone}</span>}
                                {sub.staffId && <span>• Staff ID: {sub.staffId}</span>}
                              </div>
                            </div>
                          </div>

                          {/* Sub-Agent Quota & Sales */}
                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            <div className="flex flex-wrap gap-1">
                              {sub.allocations?.map((al: any) => (
                                <span
                                  key={al.id}
                                  className="text-[9px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-700"
                                >
                                  {al.passType.replace('COMMERCIAL_', '')}: {al.availableQuantity} / {al.allocatedQuantity}
                                </span>
                              ))}
                            </div>

                            <div className="font-semibold text-stone-700">
                              {sub.ordersCount || 0} Orders Sold
                            </div>

                            <div className="font-outfit font-black text-maroon">
                              {sub.summary?.totalAvailable || 0} Passes Available
                            </div>
                          </div>

                          {/* Sub-Agent Actions */}
                          <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 relative">
                            <button
                              onClick={() => openAgentDetails(sub.id)}
                              className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => setSelectedAgentForAlloc(sub)}
                              className="px-2.5 py-1 rounded-lg bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-colors shadow-2xs"
                            >
                              Allocate
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAgentForReclaim(sub);
                                setReclaimPassType(sub.allocations?.[0]?.passType || 'COMMERCIAL_DAILY');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors"
                            >
                              Reclaim
                            </button>

                            {/* Sub-Agent Overflow Button */}
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === sub.id ? null : sub.id)}
                                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500"
                                title="Actions"
                                aria-label="Actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {openMenuId === sub.id && (
                                <div
                                  className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-30 animate-in fade-in"
                                  role="menu"
                                >
                                  <Link
                                    href={`/admin/commercial/orders?agentId=${sub.id}&source=AGENT`}
                                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                                    <span>View Orders</span>
                                  </Link>

                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setAgentToToggle(sub);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                                  >
                                    {sub.isActive ? (
                                      <>
                                        <UserX className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Deactivate</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Activate</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setAgentToDelete(sub);
                                      setDeleteError(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-stone-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Delete Agent</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. AGENT DETAILS DRAWER / MODAL */}
      {/* ======================================================== */}
      {detailsAgentId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 border border-stone-200 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-outfit font-black text-ink">Agent Profile & Oversight</h3>
                  <p className="text-xs text-stone-500">Authoritative inventory balances and audit records</p>
                </div>
              </div>
              <button
                onClick={() => setDetailsAgentId(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails || !agentDetails ? (
              <div className="py-16 text-center text-xs text-stone-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-maroon mb-2" />
                Loading agent details...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Profile Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-100 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Name</span>
                    <span className="font-bold text-ink text-sm">{agentDetails.name}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Staff ID</span>
                    <span className="font-mono font-bold text-maroon">{agentDetails.staffId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Role</span>
                    <span className="font-bold text-stone-800">
                      {agentDetails.parentAgent ? 'Sub-Agent' : 'Master Agent'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Status</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        agentDetails.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {agentDetails.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {agentDetails.parentAgent && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold">Parent Master Agent:</span> {agentDetails.parentAgent.name} (
                      {agentDetails.parentAgent.email})
                    </div>
                  </div>
                )}

                {/* Quota & Sales Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 font-outfit">
                    Pass Inventory Allocations
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 font-bold text-stone-600">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2 text-right">Allocated</th>
                          <th className="px-3 py-2 text-right">Booked</th>
                          <th className="px-3 py-2 text-right">Sub-Allocated</th>
                          <th className="px-3 py-2 text-right text-maroon">Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-mono">
                        {agentDetails.allocations?.map((al: any) => (
                          <tr key={al.id}>
                            <td className="px-3 py-2 font-sans font-semibold text-stone-800">
                              {al.passTypeName}
                            </td>
                            <td className="px-3 py-2 text-right">{al.allocatedQuantity}</td>
                            <td className="px-3 py-2 text-right text-emerald-700">{al.bookedQuantity}</td>
                            <td className="px-3 py-2 text-right text-amber-700">{al.subAllocatedQuantity}</td>
                            <td className="px-3 py-2 text-right font-bold text-maroon">
                              {al.availableQuantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sub-Agents Network if Master */}
                {agentDetails.subAgents?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 font-outfit">
                      Sub-Agents ({agentDetails.subAgents.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {agentDetails.subAgents.map((sa: any) => (
                        <div key={sa.id} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                          <div className="font-bold text-ink">{sa.name}</div>
                          <div className="text-[11px] text-stone-500">{sa.email}</div>
                          <div className="text-[10px] text-maroon font-mono mt-1 font-semibold">
                            {sa.availableQuantity} passes avail • {sa.ordersCount || 0} orders
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Orders */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 font-outfit">
                      Recent Offline Orders ({agentDetails.recentOrders?.length || 0})
                    </h4>
                    <Link
                      href={`/admin/commercial/orders?agentId=${agentDetails.id}&source=AGENT`}
                      className="text-xs font-bold text-maroon hover:underline flex items-center gap-1"
                    >
                      <span>View All Orders</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {agentDetails.recentOrders?.length === 0 ? (
                    <div className="p-4 bg-stone-50 rounded-xl text-center text-xs text-stone-400">
                      No orders booked yet by this agent.
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden text-xs">
                      {agentDetails.recentOrders.map((ord: any) => (
                        <div key={ord.id} className="p-2.5 flex items-center justify-between bg-white hover:bg-stone-50">
                          <div>
                            <span className="font-mono font-bold text-maroon">{ord.orderNumber}</span>
                            <span className="text-stone-500 ml-2">{ord.customerName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-stone-700">{ord.quantity} passes</span>
                            <span className="font-mono font-bold text-emerald-700">₹{ord.amountInr}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {ord.orderStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. DELETE AGENT CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {agentToDelete && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-4 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-agent-title"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 border border-stone-200 shadow-2xl relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 id="delete-agent-title" className="text-lg font-outfit font-black text-ink">
                  Delete Agent: {agentToDelete.name}?
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Are you sure you want to permanently delete this agent account?
                </p>
              </div>
            </div>

            {/* Agent Metadata Card */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Agent Name:</span>
                <span className="font-bold text-ink">{agentToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Email:</span>
                <span className="font-mono text-stone-700">{agentToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Staff ID:</span>
                <span className="font-mono text-maroon font-semibold">{agentToDelete.staffId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Agent Type:</span>
                <span className="font-semibold text-stone-800">
                  {agentToDelete.parentAgent ? `Sub-Agent (under ${agentToDelete.parentAgent.name})` : 'Master Agent'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Direct Orders:</span>
                <span className="font-bold text-stone-800">{agentToDelete.ordersCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Available Quota:</span>
                <span className="font-bold text-maroon">{agentToDelete.summary?.totalAvailable || 0} Passes</span>
              </div>
            </div>

            {/* Dependency Warning if agent has orders or sub-agents */}
            {(agentToDelete.ordersCount > 0 ||
              agentToDelete.subAgentsCount > 0 ||
              (agentToDelete.summary?.totalAllocated || 0) > 0) && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Historical Records Attached:</span> This agent cannot be permanently
                  deleted because orders, sub-agents, or allocations are linked to this account. You can deactivate the
                  account instead.
                </div>
              </div>
            )}

            {deleteError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAgentToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>

              {agentToDelete.ordersCount > 0 || agentToDelete.subAgentsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const ag = agentToDelete;
                    setAgentToDelete(null);
                    setAgentToToggle(ag);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-xs cursor-pointer"
                >
                  Deactivate Instead
                </button>
              ) : (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDeleteAgent}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? 'Deleting...' : 'Delete Agent'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DEACTIVATE / ACTIVATE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {agentToToggle && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-4 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-2xl relative">
            <h3 className="text-lg font-outfit font-black text-ink">
              {agentToToggle.isActive ? `Deactivate Agent: ${agentToToggle.name}?` : `Activate Agent: ${agentToToggle.name}?`}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {agentToToggle.isActive
                ? 'Deactivating this agent will immediately prevent them from logging in, booking passes, or receiving new allocations. Historical orders remain intact.'
                : 'Activating this agent will restore their login access and allow them to book offline passes.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setAgentToToggle(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={toggling}
                onClick={handleConfirmToggleStatus}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs cursor-pointer ${
                  agentToToggle.isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggling ? 'Updating...' : agentToToggle.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. REGISTER AGENT MODAL */}
      {/* ======================================================== */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 border border-stone-200 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-lg font-outfit font-black text-ink">Register Agent</h3>
                <p className="text-xs text-stone-500">Create a top-level agent with direct offline sales access.</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterAgent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  placeholder="e.g. Dhaval Shah"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="agent@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="9016651452"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                    Staff ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={registerForm.staffId}
                    onChange={(e) => setRegisterForm({ ...registerForm, staffId: e.target.value })}
                    placeholder="AGT-001"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                    Initial Password
                  </label>
                  <PasswordInput
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="Default: OngcPass@2026"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 rounded-xl bg-maroon text-white font-outfit font-bold hover:bg-maroon-dark transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {registering ? 'Registering...' : 'Register Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ALLOCATE PASSES MODAL */}
      {/* ======================================================== */}
      {selectedAgentForAlloc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-2xl relative text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-base font-outfit font-black text-ink">
                Allocate Quota: {selectedAgentForAlloc.name}
              </h3>
              <button onClick={() => setSelectedAgentForAlloc(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocate} className="space-y-4">
              <div>
                <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                  Pass Category *
                </label>
                <select
                  value={allocPassType}
                  onChange={(e) => setAllocPassType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                >
                  {PASS_TYPES.map((pt) => (
                    <option key={pt.code} value={pt.code}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                  Quantity to Allocate *
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  required
                  value={allocQuantity}
                  onChange={(e) => setAllocQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedAgentForAlloc(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocating}
                  className="px-5 py-2 rounded-xl bg-maroon text-white font-outfit font-bold hover:bg-maroon-dark transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {allocating ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. RECLAIM PASSES MODAL */}
      {/* ======================================================== */}
      {selectedAgentForReclaim && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-2xl relative text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-base font-outfit font-black text-ink">
                Reclaim Quota: {selectedAgentForReclaim.name}
              </h3>
              <button onClick={() => setSelectedAgentForReclaim(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReclaim} className="space-y-4">
              <div>
                <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                  Pass Category *
                </label>
                <select
                  value={reclaimPassType}
                  onChange={(e) => setReclaimPassType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                >
                  {PASS_TYPES.map((pt) => (
                    <option key={pt.code} value={pt.code}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                  Quantity to Reclaim *
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  required
                  value={reclaimQuantity}
                  onChange={(e) => setReclaimQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1 uppercase tracking-wider text-[10px]">
                  Notes / Audit Justification
                </label>
                <textarea
                  rows={2}
                  value={reclaimNotes}
                  onChange={(e) => setReclaimNotes(e.target.value)}
                  placeholder="e.g. Unused quota reallocated to central inventory"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedAgentForReclaim(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reclaiming}
                  className="px-5 py-2 rounded-xl bg-amber-700 text-white font-outfit font-bold hover:bg-amber-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {reclaiming ? 'Reclaiming...' : 'Confirm Reclaim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
