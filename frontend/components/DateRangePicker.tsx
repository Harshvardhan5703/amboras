'use client';

import { useState, useCallback } from 'react';

interface DateRangePickerProps {
  onChange: (from: string, to: string) => void;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function makeRange(daysBack: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { from: toISODate(from), to: toISODate(now) };
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

export default function DateRangePicker({ onChange }: DateRangePickerProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handlePreset = useCallback(
    (label: string, days: number) => {
      const range = days === 0
        ? { from: toISODate(new Date()), to: toISODate(new Date()) }
        : makeRange(days);
      setFromDate(range.from);
      setToDate(range.to);
      setActivePreset(label);
      onChange(range.from, range.to);
    },
    [onChange],
  );

  const handleManualChange = useCallback(
    (type: 'from' | 'to', value: string) => {
      setActivePreset(null);
      if (type === 'from') {
        setFromDate(value);
        if (toDate) onChange(value, toDate);
      } else {
        setToDate(value);
        if (fromDate) onChange(fromDate, value);
      }
    },
    [fromDate, toDate, onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      {PRESETS.map(({ label, days }) => (
        <button
          key={label}
          onClick={() => handlePreset(label, days)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            activePreset === label
              ? 'bg-accent/15 text-accent-light border-accent/30'
              : 'bg-bg-card text-text-secondary border-border hover:border-border-light hover:text-text-primary'
          }`}
        >
          {label}
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

      {/* Date inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => handleManualChange('from', e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-bg-card border border-border rounded-lg text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent [color-scheme:dark]"
        />
        <span className="text-text-muted text-xs">→</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => handleManualChange('to', e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-bg-card border border-border rounded-lg text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent [color-scheme:dark]"
        />
      </div>
    </div>
  );
}
