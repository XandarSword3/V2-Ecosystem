/**
 * useRealtimeLWW — Real-time Last-Write-Wins collaboration hook
 *
 * Connects to a Socket.IO channel scoped to the module being edited.
 * Each field-level edit is broadcast as a lightweight patch; conflicts are
 * resolved by timestamp (last writer wins).
 *
 * Wire format:
 *   { blockId, field, value, ts, userId }
 *
 * When no Socket.IO server is available the hook is a no-op — the builder
 * works identically in offline / single-user mode.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { UIBlock } from '@/types/module-builder';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LWWPatch {
  blockId: string;
  field: string;           // dot-path, e.g. "props.title" or "position.x"
  value: unknown;
  ts: number;              // Date.now() — epoch ms
  userId: string;
}

export interface CollaboratorPresence {
  userId: string;
  displayName: string;
  color: string;           // hex avatar ring color
  cursor?: { x: number; y: number };
  selectedBlockId?: string | null;
  lastSeen: number;
}

interface UseRealtimeLWWOptions {
  moduleId: string;
  userId: string;
  displayName: string;
  /** Socket.IO server URL. If omitted or empty, collaboration is disabled. */
  socketUrl?: string;
  onRemotePatch?: (patch: LWWPatch) => void;
}

interface UseRealtimeLWWReturn {
  /** Whether the socket is connected */
  connected: boolean;
  /** Other users currently viewing this module */
  collaborators: CollaboratorPresence[];
  /** Broadcast a field-level patch to other editors */
  broadcastPatch: (patch: Omit<LWWPatch, 'ts' | 'userId'>) => void;
  /** Update own cursor / selection for presence */
  broadcastPresence: (cursor?: { x: number; y: number }, selectedBlockId?: string | null) => void;
}

// ─── Deterministic avatar colors ─────────────────────────────────────────────

const COLLAB_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

// ─── LWW field-level timestamp map ───────────────────────────────────────────

type TsMap = Map<string, number>; // key = `${blockId}::${field}`, value = epoch ms

function patchKey(blockId: string, field: string): string {
  return `${blockId}::${field}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRealtimeLWW(options: UseRealtimeLWWOptions): UseRealtimeLWWReturn {
  const { moduleId, userId, displayName, socketUrl, onRemotePatch } = options;

  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);

  // LWW timestamp map — only accept patches newer than what we've already applied
  const tsMapRef = useRef<TsMap>(new Map());

  // Socket ref (lazy — only created when socketUrl is provided)
  const socketRef = useRef<any>(null);

  // Stable callback refs
  const onRemotePatchRef = useRef(onRemotePatch);
  onRemotePatchRef.current = onRemotePatch;

  // ── Connect / disconnect ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socketUrl) {
      setConnected(false);
      return;
    }

    let socket: any = null;

    // Dynamic import so the builder doesn't hard-depend on socket.io-client
    import('socket.io-client')
      .then(({ io }) => {
        socket = io(socketUrl, {
          query: { moduleId, userId, displayName },
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        // ── Remote patch ingestion ───────────────────────────────────────
        socket.on('lww:patch', (patch: LWWPatch) => {
          if (patch.userId === userId) return; // ignore own echoes

          const key = patchKey(patch.blockId, patch.field);
          const existingTs = tsMapRef.current.get(key) || 0;

          if (patch.ts > existingTs) {
            tsMapRef.current.set(key, patch.ts);
            onRemotePatchRef.current?.(patch);
          }
          // else: stale patch, discard (LWW rule)
        });

        // ── Presence updates ─────────────────────────────────────────────
        socket.on('presence:update', (peers: CollaboratorPresence[]) => {
          setCollaborators(peers.filter((p) => p.userId !== userId));
        });

        // ── Announce self ────────────────────────────────────────────────
        socket.emit('presence:join', {
          userId,
          displayName,
          color: colorForUser(userId),
        });
      })
      .catch(() => {
        // socket.io-client not installed — collaboration silently disabled
        setConnected(false);
      });

    return () => {
      if (socket) {
        socket.emit('presence:leave', { userId });
        socket.disconnect();
      }
      socketRef.current = null;
      setConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketUrl, moduleId, userId]);

  // ── Broadcast a local edit ───────────────────────────────────────────────

  const broadcastPatch = useCallback(
    (partial: Omit<LWWPatch, 'ts' | 'userId'>) => {
      const patch: LWWPatch = {
        ...partial,
        ts: Date.now(),
        userId,
      };
      // Record in local ts map immediately
      tsMapRef.current.set(patchKey(patch.blockId, patch.field), patch.ts);

      socketRef.current?.emit('lww:patch', patch);
    },
    [userId],
  );

  // ── Broadcast presence (cursor / selection) ──────────────────────────────

  const broadcastPresence = useCallback(
    (cursor?: { x: number; y: number }, selectedBlockId?: string | null) => {
      socketRef.current?.emit('presence:update', {
        userId,
        displayName,
        color: colorForUser(userId),
        cursor,
        selectedBlockId,
        lastSeen: Date.now(),
      });
    },
    [userId, displayName],
  );

  return { connected, collaborators, broadcastPatch, broadcastPresence };
}
