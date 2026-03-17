"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { isLocalAuthMode } from "@/auth/localAuth";
import { getApiBaseUrl } from "@/lib/api-base";

export type BoardChatFile = {
  id: string;
  board_id: string;
  chat_session_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: string;
  preview_text: string | null;
  extraction_error: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingUpload = {
  id: string;
  file: File;
  status: "uploading" | "ready" | "failed";
  fileId?: string;
};

type UseBoardChatFilesOptions = {
  boardId: string;
  chatSessionId: string | null;
  enabled: boolean;
};

type UseBoardChatFilesResult = {
  files: BoardChatFile[];
  pendingUploads: PendingUpload[];
  isUploading: boolean;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<string[]>;
  removePendingUpload: (id: string) => void;
  clearPendingUploads: () => void;
  refreshFiles: () => Promise<void>;
};

const ALLOWED_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
];
const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_MESSAGE = 3;
const FILE_UPLOAD_TIMEOUT_MS = 30_000;

const resolveAuthHeaders = async (): Promise<Record<string, string>> => {
  if (typeof window === "undefined") return {};
  const clerk = (
    window as unknown as {
      Clerk?: { session?: { getToken: () => Promise<string> } | null };
    }
  ).Clerk;
  if (!clerk?.session) return {};
  try {
    const token = await clerk.session.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const buildApiUrl = (path: string): string => {
  if (isLocalAuthMode()) {
    return `/api/local-auth/proxy${path}`;
  }
  return `${getApiBaseUrl()}${path}`;
};

export const useBoardChatFiles = ({
  boardId,
  chatSessionId,
  enabled,
}: UseBoardChatFilesOptions): UseBoardChatFilesResult => {
  const [files, setFiles] = useState<BoardChatFile[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingUpload[]>([]);

  const refreshFiles = useCallback(async () => {
    if (!enabled || !boardId || !chatSessionId) return;
    try {
      const authHeaders = await resolveAuthHeaders();
      const url = buildApiUrl(
        `/api/v1/boards/${boardId}/chat-files?chat_session_id=${encodeURIComponent(chatSessionId)}`,
      );
      const response = await fetch(url, {
        method: "GET",
        headers: { ...authHeaders },
        credentials: isLocalAuthMode() ? "same-origin" : undefined,
      });
      if (!response.ok) return;
      const data = (await response.json()) as BoardChatFile[];
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      // Non-critical — silently ignore list refresh errors
    }
  }, [boardId, chatSessionId, enabled]);

  const uploadFiles = useCallback(
    async (selected: File[]): Promise<string[]> => {
      if (!boardId) return [];

      const validFiles = selected.filter((file) => {
        const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
        const typeOk =
          ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
        return typeOk && file.size <= MAX_FILE_SIZE;
      });

      const allowed = validFiles.slice(0, MAX_FILES_PER_MESSAGE);
      if (!allowed.length) {
        setError(
          "No valid files selected. Allowed: txt, md, csv, json, pdf. Max 10MB each.",
        );
        return [];
      }

      const newPending: PendingUpload[] = allowed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "uploading" as const,
      }));

      setPendingUploads((prev) => {
        const next = [...prev, ...newPending];
        pendingRef.current = next;
        return next;
      });

      setIsUploading(true);
      setError(null);

      const fileIds: string[] = [];

      await Promise.all(
        newPending.map(async (pending) => {
          let timeoutId: number | null = null;
          try {
            const authHeaders = await resolveAuthHeaders();
            const formData = new FormData();
            formData.append("file", pending.file);
            if (chatSessionId) {
              formData.append("chat_session_id", chatSessionId);
            }
            const controller = new AbortController();
            timeoutId = window.setTimeout(() => {
              controller.abort();
            }, FILE_UPLOAD_TIMEOUT_MS);

            const url = buildApiUrl(`/api/v1/boards/${boardId}/chat-files`);
            const response = await fetch(url, {
              method: "POST",
              headers: { ...authHeaders },
              body: formData,
              signal: controller.signal,
              credentials: isLocalAuthMode() ? "same-origin" : undefined,
            });

            if (!response.ok) {
              throw new Error(`Upload failed: ${response.status}`);
            }

            const data = (await response.json()) as { id?: string };
            const uploadedId = data.id ?? "";

            fileIds.push(uploadedId);
            setPendingUploads((prev) => {
              const next = prev.map((u) =>
                u.id === pending.id
                  ? { ...u, status: "ready" as const, fileId: uploadedId }
                  : u,
              );
              pendingRef.current = next;
              return next;
            });
          } catch {
            setPendingUploads((prev) => {
              const next = prev.map((u) =>
                u.id === pending.id ? { ...u, status: "failed" as const } : u,
              );
              pendingRef.current = next;
              return next;
            });
            setError("File upload failed or timed out. Please retry.");
          } finally {
            if (timeoutId !== null) {
              window.clearTimeout(timeoutId);
            }
          }
        }),
      );

      setIsUploading(false);
      return fileIds;
    },
    [boardId, chatSessionId],
  );

  const removePendingUpload = useCallback((id: string) => {
    setPendingUploads((prev) => {
      const next = prev.filter((u) => u.id !== id);
      pendingRef.current = next;
      return next;
    });
  }, []);

  const clearPendingUploads = useCallback(() => {
    setPendingUploads([]);
    pendingRef.current = [];
  }, []);

  return useMemo(
    () => ({
      files,
      pendingUploads,
      isUploading,
      error,
      uploadFiles,
      removePendingUpload,
      clearPendingUploads,
      refreshFiles,
    }),
    [
      clearPendingUploads,
      error,
      files,
      isUploading,
      pendingUploads,
      refreshFiles,
      removePendingUpload,
      uploadFiles,
    ],
  );
};
