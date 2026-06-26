'use client';

import { useState, useRef } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

interface FileUploadConfig {
  acceptedTypes?: string[];
  maxSizeMb?: number;
  multiple?: boolean;
}

export default function FileUploadRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as FileUploadConfig;
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxSize = (config.maxSizeMb ?? 10) * 1024 * 1024;
  const accept = config.acceptedTypes?.join(',') ?? '*';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.size <= maxSize);
    setFiles((prev) => config.multiple ? [...prev, ...dropped] : dropped.slice(0, 1));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) => f.size <= maxSize);
      setFiles((prev) => config.multiple ? [...prev, ...selected] : selected.slice(0, 1));
    }
  };

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-sm text-neutral-500">
          {dragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        {config.acceptedTypes && (
          <p className="text-xs text-neutral-400 mt-1">Accepted: {config.acceptedTypes.join(', ')}</p>
        )}
        <p className="text-xs text-neutral-400">Max: {config.maxSizeMb ?? 10}MB{config.multiple ? ' (multiple)' : ''}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={config.multiple}
        onChange={handleChange}
        className="hidden"
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <span>📎</span>
              <span>{f.name}</span>
              <span className="text-neutral-400">({(f.size / 1024).toFixed(0)} KB)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
