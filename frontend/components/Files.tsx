'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface FileRecord {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  chunk_count: number;
  kg_nodes: number;
  status: 'processing' | 'ready' | 'error';
  uploaded_at: string;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: FileRecord['status'] }) {
  const cls = status === 'ready' ? 'file-badge ready' : status === 'error' ? 'file-badge error' : 'file-badge processing';
  return <span className={cls}>{status}</span>;
}

export default function Files({
  sessionId,
  provider,
  onToast,
  onUploadSuccess,
}: {
  sessionId: string;
  provider: string;
  onToast?: (t: { tier: 'episodic' | 'kg' | 'working'; text: string }) => void;
  onUploadSuccess?: () => void;
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/files`, { credentials: 'include' });
      if (res.ok) setFiles(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('session_id', sessionId);
      form.append('provider', provider);
      const res = await fetch(`${apiUrl}/api/files/upload`, { method: 'POST', credentials: 'include', body: form });
      const data = await res.json();
      if (!res.ok) {
        onToast?.({ tier: 'episodic', text: `Upload failed: ${data.detail ?? res.statusText}` });
      } else {
        onToast?.({ tier: 'kg', text: `✦ ${file.name} indexed · ${data.chunk_count} chunks · ${data.kg_nodes} nodes` });
        onUploadSuccess?.();
        await loadFiles();
      }
    } catch {
      onToast?.({ tier: 'episodic', text: 'Upload failed — network error' });
    } finally {
      setUploading(false);
    }
  }, [apiUrl, sessionId, provider, onToast, onUploadSuccess, loadFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${apiUrl}/api/files/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setFiles(fs => fs.filter(f => f.id !== id));
        onToast?.({ tier: 'working', text: `Removed ${name}` });
      } else {
        onToast?.({ tier: 'episodic', text: 'Delete failed' });
      }
    } catch {
      onToast?.({ tier: 'episodic', text: 'Delete failed — network error' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="files">
      <div className="files-inner">
        <h1>Files</h1>
        <p className="files-sub">
          Documents you upload are chunked, embedded into episodic memory, and extracted into the knowledge graph.
        </p>

        {/* Upload zone */}
        <div
          className={`file-dropzone${dragOver ? ' drag-over' : ''}${uploading ? ' uploading' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.py,.js,.ts,.json,.yaml,.yml,.toml"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          <div className="dropzone-icon">
            {uploading ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" className="spin-icon" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <p className="dropzone-label">
            {uploading ? 'Indexing…' : 'Drop a file here or click to browse'}
          </p>
          <p className="dropzone-hint">PDF · TXT · MD · PY · JS · TS · JSON · YAML · TOML · max 5 MB</p>
        </div>

        {/* File list */}
        {loading ? (
          <p className="files-empty">Loading…</p>
        ) : files.length === 0 ? (
          <div className="files-empty-state">
            <p className="files-empty">No files uploaded yet.</p>
            <p className="files-empty-hint">Upload a document to seed your episodic memory and knowledge graph.</p>
          </div>
        ) : (
          <div className="file-table-wrap">
            <table className="file-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Chunks</th>
                  <th>KG nodes</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} className={deletingId === f.id ? 'deleting' : ''}>
                    <td className="file-name">{f.filename}</td>
                    <td><span className="file-type-pill">.{f.file_type}</span></td>
                    <td className="file-num">{fmtBytes(f.size_bytes)}</td>
                    <td className="file-num">{f.chunk_count}</td>
                    <td className="file-num">{f.kg_nodes ?? '—'}</td>
                    <td><StatusBadge status={f.status} /></td>
                    <td className="file-date">{fmtDate(f.uploaded_at)}</td>
                    <td>
                      <button
                        className="file-delete-btn"
                        onClick={() => handleDelete(f.id, f.filename)}
                        disabled={deletingId === f.id}
                        title="Remove file"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
