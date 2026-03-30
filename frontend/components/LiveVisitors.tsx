'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';

interface LiveVisitorsProps {
  initialCount: number;
}

export default function LiveVisitors({ initialCount }: LiveVisitorsProps) {
  const [count, setCount] = useState(initialCount);
  const socketConnected = useRef(false);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (socketConnected.current) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    socketConnected.current = true;
    const socket = getSocket();

    socket.on('live_visitors', (data: { count: number }) => {
      setCount(data.count);
    });

    return () => {
      socket.off('live_visitors');
      socketConnected.current = false;
    };
  }, []);

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 bg-bg-card border border-border rounded-xl">
      <div className="relative">
        <div className="w-2.5 h-2.5 rounded-full bg-success" />
        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-success pulse-live" />
      </div>
      <div>
        <span className="text-lg font-bold tabular-nums">{count.toLocaleString()}</span>
        <span className="text-xs text-text-muted ml-1.5">visitors right now</span>
      </div>
    </div>
  );
}
