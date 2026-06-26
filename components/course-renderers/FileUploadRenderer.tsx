'use client';

import { useState, useRef } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './FileUploadRenderer.module.css';

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
        className={`${styles.dropzone} ${dragging ? styles.dropzone_active : styles.dropzone_inactive}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <p className={styles.dropzone_text}>
          {dragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        {config.acceptedTypes && (
          <p className={styles.hint_text}>Accepted: {config.acceptedTypes.join(', ')}</p>
        )}
        <p className={styles.hint_text}>Max: {config.maxSizeMb ?? 10}MB{config.multiple ? ' (multiple)' : ''}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={config.multiple}
        onChange={handleChange}
        className={styles.file_input}
      />
      {files.length > 0 && (
        <ul className={styles.file_list}>
          {files.map((f, i) => (
            <li key={i} className={styles.file_item}>
              <span>📎</span>
              <span>{f.name}</span>
              <span className={styles.file_size}>({(f.size / 1024).toFixed(0)} KB)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
