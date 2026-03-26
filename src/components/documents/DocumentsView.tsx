"use client";
import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, Download, X } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { formatDistanceToNow } from "date-fns";
import type { Document } from "@/types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsView() {
  const { activeFamilyId } = useFamilyStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const data = await api.get<Document[]>(
        `/api/families/${activeFamilyId}/documents`
      );
      setDocs(data);
    } catch {
      showToast("Failed to load documents", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, showToast]);

  useEffect(() => {
    setLoading(true);
    loadDocs();
  }, [loadDocs]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!docName) setDocName(f.name);
  };

  const handleUpload = async () => {
    if (!file || !activeFamilyId) return;
    setUploading(true);
    try {
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "family-circle-v3/documents");
      const { url } = await api.upload<{ url: string }>("/api/upload", formData);

      // Save metadata
      const doc = await api.post<Document>(
        `/api/families/${activeFamilyId}/documents`,
        {
          name: docName || file.name,
          file_path: url,
          file_size: file.size,
          mime_type: file.type,
          description,
        }
      );
      setDocs((prev) => [doc, ...prev]);
      setUploadOpen(false);
      setFile(null);
      setDocName("");
      setDescription("");
      showToast("Document uploaded!", "success");
    } catch {
      showToast("Failed to upload document", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!activeFamilyId) return;
    try {
      await api.delete(`/api/families/${activeFamilyId}/documents?docId=${docId}`);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      showToast("Document deleted", "info");
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  if (!activeFamilyId) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-text-muted text-sm">No family selected.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-text">Documents</h1>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload size={14} /> Upload
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted text-sm">No documents yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-bg-2 border border-border rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-bg-3 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={18} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatBytes(doc.file_size)} ·{" "}
                  {formatDistanceToNow(new Date(doc.created_at), {
                    addSuffix: true,
                  })}
                </p>
                {doc.description && (
                  <p className="text-xs text-text-faint mt-1 truncate">
                    {doc.description}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <a
                  href={doc.file_path}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                >
                  <Download size={14} />
                </a>
                {doc.uploaded_by === user?.id && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-error transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setFile(null);
          setDocName("");
          setDescription("");
        }}
        title="Upload Document"
      >
        <div className="flex flex-col gap-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors"
            onClick={() => document.getElementById("doc-file-input")?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText size={16} className="text-accent" />
                <span className="text-sm text-text">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setDocName("");
                  }}
                  className="text-text-muted hover:text-error"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-text-faint mb-2" />
                <p className="text-sm text-text-muted">
                  Click to select a file
                </p>
              </>
            )}
          </div>
          <input
            id="doc-file-input"
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Input
            label="Document Name"
            placeholder="My Document"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
          />
          <Textarea
            label="Description (optional)"
            placeholder="What is this document about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Button
            onClick={handleUpload}
            loading={uploading}
            disabled={!file}
            className="w-full"
          >
            Upload
          </Button>
        </div>
      </Modal>
    </div>
  );
}
