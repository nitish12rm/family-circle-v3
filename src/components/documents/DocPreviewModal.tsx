"use client";
import { X, Download, FileText } from "lucide-react";

interface DocPreviewModalProps {
  doc: { name: string; file_path: string; mime_type: string } | null;
  onClose: () => void;
}

export default function DocPreviewModal({ doc, onClose }: DocPreviewModalProps) {
  if (!doc) return null;

  const isImage = doc.mime_type.startsWith("image/");
  const isPdf = doc.mime_type === "application/pdf";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-bg rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <p className="flex-1 text-sm font-medium text-text truncate">{doc.name}</p>
          <a
            href={doc.file_path}
            download={doc.name}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
          >
            <Download size={16} />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto min-h-0 flex items-center justify-center bg-bg-3">
          {isImage ? (
            <img
              src={doc.file_path}
              alt={doc.name}
              className="max-w-full max-h-full object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={doc.file_path}
              title={doc.name}
              className="w-full h-full min-h-[60vh]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-text-muted">
              <FileText size={48} className="text-text-faint" />
              <p className="text-sm">Preview not available</p>
              <a
                href={doc.file_path}
                target="_blank"
                rel="noreferrer"
                className="text-accent text-sm hover:underline"
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
