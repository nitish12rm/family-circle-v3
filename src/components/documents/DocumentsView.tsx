"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Upload, FileText, Trash2, Download, X, Eye, Lock, Globe, ChevronDown, Search } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import DocPreviewModal from "@/components/documents/DocPreviewModal";
import { compressImage } from "@/lib/imageCompression";
import { formatDistanceToNow } from "date-fns";
import type { Document } from "@/types";
import { DOCUMENT_CATEGORIES } from "@/types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  return "📎";
}

export default function DocumentsView() {
  const { activeFamilyId } = useFamilyStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const resetForm = () => {
    setFile(null);
    setDocName("");
    setDescription("");
    setCategory("Other");
    setVisibility("private");
  };

  const loadDocs = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const data = await api.get<Document[]>(`/api/families/${activeFamilyId}/documents`);
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

  // My docs only
  const myDocs = useMemo(() => docs.filter((d) => d.uploaded_by === user?.id), [docs, user]);

  // Categories present in my docs
  const presentCategories = useMemo(() => {
    const cats = Array.from(new Set(myDocs.map((d) => d.category || "Other")));
    return ["All", ...cats];
  }, [myDocs]);

  // Filtered
  const filteredDocs = useMemo(() => {
    return myDocs.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q);
      const matchCat = activeCategory === "All" || (d.category || "Other") === activeCategory;
      return matchSearch && matchCat;
    });
  }, [myDocs, search, activeCategory]);

  // Grouped by category
  const grouped = useMemo(() => {
    const map: Record<string, Document[]> = {};
    for (const doc of filteredDocs) {
      const key = doc.category || "Other";
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    }
    return Object.entries(map);
  }, [filteredDocs]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type.startsWith("image/") && f.type !== "image/gif") {
      setCompressing(true);
      const compressed = await compressImage(f);
      setFile(compressed);
      if (!docName) setDocName(compressed.name.replace(/\.[^.]+$/, ""));
      setCompressing(false);
    } else {
      setFile(f);
      if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file || !activeFamilyId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "family-circle-v3/documents");
      const { url } = await api.upload<{ url: string }>("/api/upload", formData);
      const doc = await api.post<Document>(`/api/families/${activeFamilyId}/documents`, {
        name: docName || file.name,
        file_path: url,
        file_size: file.size,
        mime_type: file.type,
        description,
        category,
        visibility,
      });
      setDocs((prev) => [doc, ...prev]);
      setUploadOpen(false);
      resetForm();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text">My Documents</h1>
          {!loading && (
            <p className="text-xs text-text-faint mt-0.5">{myDocs.length} document{myDocs.length !== 1 ? "s" : ""}</p>
          )}
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload size={14} /> Upload
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : myDocs.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted text-sm">No documents yet.</p>
          <p className="text-text-faint text-xs mt-1">Upload your first document to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              type="text"
              placeholder="Search by name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-2 border border-border rounded-xl pl-8 pr-4 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          {/* Category filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {presentCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-accent text-white"
                    : "bg-bg-2 border border-border text-text-muted hover:text-text"
                }`}
              >
                {cat}
                {cat !== "All" && (
                  <span className="ml-1 opacity-60">
                    {myDocs.filter((d) => (d.category || "Other") === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Results */}
          {filteredDocs.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-text-muted text-sm">No documents match your search.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {grouped.map(([cat, catDocs]) => (
                <div key={cat} className="flex flex-col gap-2">
                  {/* Category tag header */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                      {cat}
                    </span>
                    <span className="text-xs text-text-faint">{catDocs.length} doc{catDocs.length !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2">
                    {catDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-bg-2 border border-border rounded-2xl p-4 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-bg-3 rounded-xl flex items-center justify-center shrink-0 text-lg">
                          {fileIcon(doc.mime_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{doc.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                              doc.visibility === "public"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-bg-3 text-text-faint"
                            }`}>
                              {doc.visibility === "public" ? <Globe size={10} /> : <Lock size={10} />}
                              {doc.visibility === "public" ? "Public" : "Private"}
                            </span>
                            <span className="text-xs text-text-faint">
                              {formatBytes(doc.file_size)} · {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-text-faint mt-1 truncate">{doc.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                            title="Preview"
                          >
                            <Eye size={14} />
                          </button>
                          <a
                            href={doc.file_path}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                            title="Download"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-error transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); resetForm(); }}
        title="Upload Document"
      >
        <div className="flex flex-col gap-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors"
            onClick={() => document.getElementById("doc-file-input")?.click()}
          >
            {compressing ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner size={16} />
                <span className="text-sm text-text-muted">Compressing image…</span>
              </div>
            ) : file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">{fileIcon(file.type)}</span>
                <span className="text-sm text-text">{file.name}</span>
                <span className="text-xs text-text-faint">({formatBytes(file.size)})</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setDocName(""); }}
                  className="text-text-muted hover:text-error"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-text-faint mb-2" />
                <p className="text-sm text-text-muted">Click to select a file</p>
                <p className="text-xs text-text-faint mt-1">Images will be automatically compressed</p>
              </>
            )}
          </div>
          <input id="doc-file-input" type="file" className="hidden" onChange={handleFileSelect} />

          <Input
            label="Document Name"
            placeholder="e.g. My Aadhaar Card"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
          />

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Visibility</label>
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                  visibility === "private" ? "bg-bg-3 text-text" : "bg-bg-2 text-text-muted hover:bg-bg-3"
                }`}
              >
                <Lock size={13} /> Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                  visibility === "public" ? "bg-green-500/15 text-green-400" : "bg-bg-2 text-text-muted hover:bg-bg-3"
                }`}
              >
                <Globe size={13} /> Public
              </button>
            </div>
            <p className="text-xs text-text-faint">
              {visibility === "public" ? "Visible to family members on your profile" : "Only visible to you"}
            </p>
          </div>

          <Textarea
            label="Description (optional)"
            placeholder="What is this document about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <Button onClick={handleUpload} loading={uploading} disabled={!file || compressing} className="w-full">
            Upload
          </Button>
        </div>
      </Modal>

      <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
