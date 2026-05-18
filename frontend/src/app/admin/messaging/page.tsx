'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  Search,
  Filter,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  ChevronRight,
  Plus,
  RefreshCw,
  Settings,
  Zap,
  FileText,
  User,
  Phone,
  Mail,
  MessageCircle,
  MoreHorizontal,
  X,
  Check,
  ArrowLeft,
  Loader2,
  Inbox,
  Archive,
  Flag,
  Tag,
  BookOpen,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProperty } from '@/context/PropertyContext';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  property_id: string;
  guest_id?: string;
  booking_id?: string;
  channel_type: 'sms' | 'whatsapp' | 'email' | 'in_app' | 'web_chat';
  status: 'open' | 'resolved' | 'pending' | 'spam';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  message_count: number;
  unread_count: number;
  last_message_at?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  last_message_preview?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'guest' | 'staff' | 'system' | 'bot';
  sender_name?: string;
  message_type: 'text' | 'image' | 'document' | 'template';
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  channel_type: string;
  subject?: string;
  body: string;
  variables: string[];
  language: string;
  is_active: boolean;
}

interface CannedResponse {
  id: string;
  name: string;
  shortcut: string;
  content: string;
  category?: string;
  use_count: number;
}

interface MessagingAnalytics {
  total_conversations: number;
  open_conversations: number;
  resolved_today: number;
  avg_response_time_minutes: number;
  unread_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const channelIcon = (type: string) => {
  switch (type) {
    case 'sms': return <Phone className="w-3 h-3" />;
    case 'whatsapp': return <MessageCircle className="w-3 h-3" />;
    case 'email': return <Mail className="w-3 h-3" />;
    default: return <MessageSquare className="w-3 h-3" />;
  }
};

const priorityColor = (p: string) => {
  switch (p) {
    case 'urgent': return 'text-red-500 bg-red-50 border-red-200';
    case 'high': return 'text-orange-500 bg-orange-50 border-orange-200';
    case 'normal': return 'text-blue-500 bg-blue-50 border-blue-200';
    default: return 'text-gray-400 bg-gray-50 border-gray-200';
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'open': return 'bg-green-100 text-green-700';
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'resolved': return 'bg-gray-100 text-gray-600';
    default: return 'bg-red-100 text-red-700';
  }
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  selected,
  onClick,
}: {
  conv: Conversation;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
          {(conv.guest_name || 'G')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-medium truncate ${conv.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
              {conv.guest_name || 'Guest'}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(conv.last_message_at)}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${priorityColor(conv.priority)}`}>
              {channelIcon(conv.channel_type)}
              {conv.channel_type}
            </span>
            {conv.unread_count > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold">
                {conv.unread_count}
              </span>
            )}
          </div>
          {conv.last_message_preview && (
            <p className={`text-xs mt-1 truncate ${conv.unread_count > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
              {conv.last_message_preview}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === 'outbound';
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isOutbound && (
        <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 mr-2 flex-shrink-0 mt-1">
          G
        </div>
      )}
      <div className={`max-w-[70%]`}>
        {msg.sender_name && !isOutbound && (
          <p className="text-xs text-gray-500 mb-1 ml-1">{msg.sender_name}</p>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isOutbound
              ? 'bg-blue-500 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          }`}
        >
          {msg.content}
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
          {isOutbound && (
            <span className="text-xs text-gray-400">
              {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'inbox' | 'templates' | 'canned' | 'analytics';

export default function MessagingPage() {
  const { activePropertyId } = useProperty();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [showCannedMenu, setShowCannedMenu] = useState(false);
  const [cannedSearch, setCannedSearch] = useState('');
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [newCannedForm, setNewCannedForm] = useState({ name: '', shortcut: '', content: '', category: '' });
  const [newTemplateForm, setNewTemplateForm] = useState({ name: '', category: '', channel_type: 'in_app', subject: '', body: '', language: 'en' });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: conversations = [], isLoading: convLoading, refetch: refetchConvs } = useQuery({
    queryKey: ['messaging-conversations', activePropertyId, statusFilter],
    queryFn: async () => {
      if (!activePropertyId) return [];
      const res = await api.get(`/messaging/conversations/property/${activePropertyId}?status=${statusFilter}`);
      return (res.data?.conversations || res.data || []) as Conversation[];
    },
    enabled: !!activePropertyId,
    refetchInterval: 15000,
  });

  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ['messaging-messages', selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const res = await api.get(`/messaging/conversations/${selectedConvId}/messages`);
      return (res.data?.messages || res.data || []) as Message[];
    },
    enabled: !!selectedConvId,
    refetchInterval: 5000,
  });

  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ['messaging-templates', activePropertyId],
    queryFn: async () => {
      if (!activePropertyId) return [];
      const res = await api.get(`/messaging/templates/property/${activePropertyId}`);
      return (res.data?.templates || res.data || []) as Template[];
    },
    enabled: !!activePropertyId && (activeTab === 'templates' || showTemplateDialog),
  });

  const { data: cannedResponses = [] } = useQuery({
    queryKey: ['messaging-canned', activePropertyId],
    queryFn: async () => {
      if (!activePropertyId) return [];
      const res = await api.get(`/messaging/canned-responses/${activePropertyId}`);
      return (res.data?.responses || res.data || []) as CannedResponse[];
    },
    enabled: !!activePropertyId,
  });

  const { data: analytics } = useQuery({
    queryKey: ['messaging-analytics', activePropertyId],
    queryFn: async () => {
      if (!activePropertyId) return null;
      const res = await api.get(`/messaging/analytics/${activePropertyId}`);
      return res.data as MessagingAnalytics;
    },
    enabled: !!activePropertyId && activeTab === 'analytics',
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/messaging/conversations/${selectedConvId}/messages`, {
        message_type: 'text',
        content,
      });
    },
    onSuccess: () => {
      setMessageInput('');
      qc.invalidateQueries({ queryKey: ['messaging-messages', selectedConvId] });
      qc.invalidateQueries({ queryKey: ['messaging-conversations', activePropertyId] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const resolveMutation = useMutation({
    mutationFn: async (convId: string) => {
      await api.post(`/messaging/conversations/${convId}/resolve`, {});
    },
    onSuccess: () => {
      toast.success('Conversation resolved');
      qc.invalidateQueries({ queryKey: ['messaging-conversations', activePropertyId] });
      setSelectedConvId(null);
    },
    onError: () => toast.error('Failed to resolve'),
  });

  const reopenMutation = useMutation({
    mutationFn: async (convId: string) => {
      await api.post(`/messaging/conversations/${convId}/reopen`, {});
    },
    onSuccess: () => {
      toast.success('Conversation reopened');
      qc.invalidateQueries({ queryKey: ['messaging-conversations', activePropertyId] });
    },
    onError: () => toast.error('Failed to reopen'),
  });

  const priorityMutation = useMutation({
    mutationFn: async ({ convId, priority }: { convId: string; priority: string }) => {
      await api.patch(`/messaging/conversations/${convId}/priority`, { priority });
    },
    onSuccess: () => {
      toast.success('Priority updated');
      qc.invalidateQueries({ queryKey: ['messaging-conversations', activePropertyId] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (convId: string) => {
      await api.post(`/messaging/conversations/${convId}/read`, {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messaging-conversations', activePropertyId] });
    },
  });

  const createCannedMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/messaging/canned-responses/${activePropertyId}`, newCannedForm);
    },
    onSuccess: () => {
      toast.success('Canned response created');
      setNewCannedForm({ name: '', shortcut: '', content: '', category: '' });
      qc.invalidateQueries({ queryKey: ['messaging-canned', activePropertyId] });
    },
    onError: () => toast.error('Failed to create canned response'),
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/messaging/templates/${activePropertyId}`, newTemplateForm);
    },
    onSuccess: () => {
      toast.success('Template created');
      setShowTemplateDialog(false);
      setNewTemplateForm({ name: '', category: '', channel_type: 'in_app', subject: '', body: '', language: 'en' });
      qc.invalidateQueries({ queryKey: ['messaging-templates', activePropertyId] });
    },
    onError: () => toast.error('Failed to create template'),
  });

  const useCannedMutation = useMutation({
    mutationFn: async (responseId: string) => {
      await api.post(`/messaging/canned-responses/${responseId}/use`, {});
    },
  });

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedConvId) {
      markReadMutation.mutate(selectedConvId);
    }
  }, [selectedConvId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (!messageInput.trim() || !selectedConvId) return;
    sendMutation.mutate(messageInput.trim());
  }, [messageInput, selectedConvId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '/' && messageInput === '') {
      setShowCannedMenu(true);
    }
  };

  const applyCanned = (response: CannedResponse) => {
    setMessageInput(response.content);
    setShowCannedMenu(false);
    useCannedMutation.mutate(response.id);
  };

  const filteredConvs = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.guest_name || '').toLowerCase().includes(q) ||
      (c.guest_email || '').toLowerCase().includes(q) ||
      (c.last_message_preview || '').toLowerCase().includes(q)
    );
  });

  const filteredCanned = cannedResponses.filter(r => {
    if (!cannedSearch) return true;
    const q = cannedSearch.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.shortcut.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
  });

  if (!activePropertyId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a property to view messaging</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-semibold text-gray-900">Guest Messaging</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchConvs(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['inbox', 'templates', 'canned', 'analytics'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedConvId(null); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'canned' ? 'Quick Replies' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── INBOX TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'inbox' && (
        <div className="flex flex-1 min-h-0">

          {/* Conversation list */}
          <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

            {/* List controls */}
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search conversations…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {['open', 'pending', 'resolved'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      statusFilter === s
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {convLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <Inbox className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No conversations</p>
                </div>
              ) : (
                filteredConvs.map(conv => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    selected={conv.id === selectedConvId}
                    onClick={() => setSelectedConvId(conv.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Thread panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selectedConvId ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a conversation to start</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConvId(null)}
                      className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 md:hidden"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                      {(selectedConv?.guest_name || 'G')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedConv?.guest_name || 'Guest'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {selectedConv?.guest_email && <span>{selectedConv.guest_email}</span>}
                        {selectedConv?.guest_phone && <span>{selectedConv.guest_phone}</span>}
                        <span className={`px-1.5 py-0.5 rounded-full ${statusColor(selectedConv?.status || 'open')}`}>
                          {selectedConv?.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Priority selector */}
                    <select
                      value={selectedConv?.priority || 'normal'}
                      onChange={e => priorityMutation.mutate({ convId: selectedConvId, priority: e.target.value })}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {['low', 'normal', 'high', 'urgent'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {/* Template picker */}
                    <button
                      onClick={() => setShowTemplateDialog(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Template
                    </button>
                    {/* Resolve / Reopen */}
                    {selectedConv?.status === 'resolved' ? (
                      <button
                        onClick={() => reopenMutation.mutate(selectedConvId)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-yellow-100 hover:bg-yellow-200 rounded-lg text-yellow-700 transition-colors"
                      >
                        <Circle className="w-3 h-3" />
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => resolveMutation.mutate(selectedConvId)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-100 hover:bg-green-200 rounded-lg text-green-700 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Resolve
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">No messages yet</p>
                    </div>
                  ) : (
                    messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Compose */}
                <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
                  {/* Canned responses dropdown */}
                  {showCannedMenu && (
                    <div className="mb-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          autoFocus
                          className="w-full text-sm px-2 py-1 outline-none text-gray-600"
                          placeholder="Search quick replies…"
                          value={cannedSearch}
                          onChange={e => setCannedSearch(e.target.value)}
                        />
                      </div>
                      {filteredCanned.map(r => (
                        <button
                          key={r.id}
                          onClick={() => applyCanned(r)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          <span className="text-blue-500 font-medium">/{r.shortcut}</span>
                          <span className="text-gray-500 ml-2 text-xs">{r.name}</span>
                          <p className="text-gray-700 text-xs mt-0.5 truncate">{r.content}</p>
                        </button>
                      ))}
                      {filteredCanned.length === 0 && (
                        <div className="p-3 text-center text-xs text-gray-400">No quick replies found</div>
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder='Type a message… (press / for quick replies, Enter to send)'
                        value={messageInput}
                        onChange={e => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setShowCannedMenu(false)}
                      />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sendMutation.isPending}
                      className="p-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-white transition-colors"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">/</kbd> to insert a quick reply
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ─────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Message Templates</h2>
                <p className="text-sm text-gray-500 mt-1">Pre-approved templates for SMS, WhatsApp, and email</p>
              </div>
              <button
                onClick={() => setShowTemplateDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </div>

            {tplLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No templates yet</p>
                <button
                  onClick={() => setShowTemplateDialog(true)}
                  className="mt-4 text-blue-500 text-sm hover:underline"
                >
                  Create your first template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {templates.map(tpl => (
                  <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm">{tpl.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tpl.channel_type}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{tpl.category}</span>
                          {!tpl.is_active && (
                            <span className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded-full">Inactive</span>
                          )}
                        </div>
                        {tpl.subject && (
                          <p className="text-xs text-gray-500 mb-2">Subject: {tpl.subject}</p>
                        )}
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{tpl.body}</p>
                        {tpl.variables.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-xs text-gray-400">Variables:</span>
                            {tpl.variables.map(v => (
                              <span key={v} className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-mono">{`{{${v}}}`}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── QUICK REPLIES TAB ─────────────────────────────────────────── */}
      {activeTab === 'canned' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quick Replies</h2>
                <p className="text-sm text-gray-500 mt-1">Saved responses accessible with <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">/</kbd> shortcuts in the inbox</p>
              </div>
            </div>

            {/* Create form */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-6">
              <h3 className="font-medium text-gray-900 text-sm mb-3">Add New Quick Reply</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name"
                  value={newCannedForm.name}
                  onChange={e => setNewCannedForm(p => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Shortcut (e.g. checkin)"
                  value={newCannedForm.shortcut}
                  onChange={e => setNewCannedForm(p => ({ ...p, shortcut: e.target.value.replace(/\s/g, '') }))}
                />
                <input
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Category (optional)"
                  value={newCannedForm.category}
                  onChange={e => setNewCannedForm(p => ({ ...p, category: e.target.value }))}
                />
              </div>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Response content…"
                value={newCannedForm.content}
                onChange={e => setNewCannedForm(p => ({ ...p, content: e.target.value }))}
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => createCannedMutation.mutate()}
                  disabled={!newCannedForm.name || !newCannedForm.shortcut || !newCannedForm.content || createCannedMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {createCannedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save Reply
                </button>
              </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-3">
              {cannedResponses.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">{r.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-mono">/{r.shortcut}</span>
                      {r.category && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{r.category}</span>}
                    </div>
                    <p className="text-sm text-gray-600">{r.content}</p>
                    <p className="text-xs text-gray-400 mt-1">Used {r.use_count} times</p>
                  </div>
                </div>
              ))}
              {cannedResponses.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No quick replies yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Messaging Analytics</h2>
            {!analytics ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Conversations', value: analytics.total_conversations, color: 'text-blue-600' },
                  { label: 'Open Now', value: analytics.open_conversations, color: 'text-green-600' },
                  { label: 'Resolved Today', value: analytics.resolved_today, color: 'text-purple-600' },
                  { label: 'Unread', value: analytics.unread_count, color: 'text-red-600' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
            {analytics?.avg_response_time_minutes != null && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">Average Response Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {analytics.avg_response_time_minutes < 60
                    ? `${Math.round(analytics.avg_response_time_minutes)}m`
                    : `${(analytics.avg_response_time_minutes / 60).toFixed(1)}h`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Template dialog ────────────────────────────────────────────── */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">New Message Template</h3>
              <button onClick={() => setShowTemplateDialog(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Template name"
                  value={newTemplateForm.name}
                  onChange={e => setNewTemplateForm(p => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Category (e.g. check_in)"
                  value={newTemplateForm.category}
                  onChange={e => setNewTemplateForm(p => ({ ...p, category: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newTemplateForm.channel_type}
                  onChange={e => setNewTemplateForm(p => ({ ...p, channel_type: e.target.value }))}
                >
                  {['in_app', 'sms', 'whatsapp', 'email'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Language (e.g. en)"
                  value={newTemplateForm.language}
                  onChange={e => setNewTemplateForm(p => ({ ...p, language: e.target.value }))}
                />
              </div>
              {newTemplateForm.channel_type === 'email' && (
                <input
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject"
                  value={newTemplateForm.subject}
                  onChange={e => setNewTemplateForm(p => ({ ...p, subject: e.target.value }))}
                />
              )}
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                placeholder="Template body. Use {{variable_name}} for dynamic values."
                value={newTemplateForm.body}
                onChange={e => setNewTemplateForm(p => ({ ...p, body: e.target.value }))}
              />
              <p className="text-xs text-gray-400">Use <code className="bg-gray-100 px-1 rounded">{'{{guest_name}}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{{booking_id}}'}</code> etc. as placeholders</p>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowTemplateDialog(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={() => createTemplateMutation.mutate()}
                disabled={!newTemplateForm.name || !newTemplateForm.body || createTemplateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {createTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
