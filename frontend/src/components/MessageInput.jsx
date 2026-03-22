import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  ImageIcon,
  LoaderCircleIcon,
  NotebookTextIcon,
  PresentationIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import {
  FILE_ATTACHMENT_ACCEPT,
  formatAttachmentSize,
  getAttachmentDisplayType,
  getAttachmentIconKey,
  getAttachmentKind,
  getAttachmentValidationError,
  getAttachmentsCountValidationError,
  getAttachmentsTotalSizeValidationError,
  IMAGE_ATTACHMENT_ACCEPT,
  isDocumentAttachmentType,
  isImageAttachmentType,
} from "../lib/messageAttachments";
import { useChatStore } from "../store/useChatStore";

const pendingAttachmentIcons = {
  image: ImageIcon,
  pdf: FileTextIcon,
  document: FileTypeIcon,
  spreadsheet: FileSpreadsheetIcon,
  presentation: PresentationIcon,
  text: NotebookTextIcon,
  file: FileTypeIcon,
};

const createPendingAttachmentId = () =>
  `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadControllersRef = useRef(new Map());
  const dragCounterRef = useRef(0);

  const {
    sendMessage,
    uploadMessageAttachment,
    removeUploadedAttachment,
    isSoundEnabled,
  } = useChatStore();

  const hasUploadingAttachments = pendingAttachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const uploadedAttachments = pendingAttachments
    .filter((attachment) => attachment.status === "uploaded")
    .map((attachment) => attachment.attachment)
    .filter(Boolean);

  useEffect(
    () => () => {
      uploadControllersRef.current.forEach((controller) => controller.abort());
      uploadControllersRef.current.clear();
    },
    [],
  );

  const resetAttachmentInputs = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updatePendingAttachment = (clientId, updater) => {
    setPendingAttachments((currentAttachments) =>
      currentAttachments.map((attachment) =>
        attachment.clientId === clientId
          ? { ...attachment, ...updater(attachment) }
          : attachment,
      ),
    );
  };

  const validateSelectionBySource = (file, sourceType) => {
    if (sourceType === "image" && !isImageAttachmentType(file.type)) {
      return "Only image files are allowed.";
    }

    if (sourceType === "file" && !isDocumentAttachmentType(file.type)) {
      return "Only PDFs, Word, Excel, PowerPoint, and text files are allowed.";
    }

    return getAttachmentValidationError(file);
  };

  const startAttachmentUpload = async (pendingAttachment, file) => {
    const controller = new AbortController();
    uploadControllersRef.current.set(pendingAttachment.clientId, controller);

    try {
      const uploadedAttachment = await uploadMessageAttachment(file, {
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) {
            return;
          }

          const progress = Math.min(
            99,
            Math.round((progressEvent.loaded / progressEvent.total) * 100),
          );

          updatePendingAttachment(pendingAttachment.clientId, () => ({
            progress,
          }));
        },
      });

      if (!uploadedAttachment) {
        throw new Error("Attachment upload returned no metadata.");
      }

      updatePendingAttachment(pendingAttachment.clientId, () => ({
        attachment: uploadedAttachment,
        originalName: uploadedAttachment.originalName,
        mimeType: uploadedAttachment.mimeType,
        size: uploadedAttachment.size,
        kind: uploadedAttachment.kind,
        progress: 100,
        status: "uploaded",
      }));
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setPendingAttachments((currentAttachments) =>
        currentAttachments.filter(
          (attachment) => attachment.clientId !== pendingAttachment.clientId,
        ),
      );
      toast.error(error.message || `Failed to upload ${file.name}`);
    } finally {
      uploadControllersRef.current.delete(pendingAttachment.clientId);
    }
  };

  const queueFilesForUpload = (selectedFiles, sourceType) => {
    const files = Array.from(selectedFiles || []);
    if (files.length === 0) {
      return;
    }

    const acceptedFiles = [];
    const selectionErrors = new Set();

    files.forEach((file) => {
      const validationError = validateSelectionBySource(file, sourceType);

      if (validationError) {
        selectionErrors.add(validationError);
        return;
      }

      acceptedFiles.push(file);
    });

    selectionErrors.forEach((errorMessage) => toast.error(errorMessage));

    if (acceptedFiles.length === 0) {
      return;
    }

    const countValidationError = getAttachmentsCountValidationError(
      pendingAttachments.length + acceptedFiles.length,
    );

    if (countValidationError) {
      toast.error(countValidationError);
      return;
    }

    const totalSizeValidationError = getAttachmentsTotalSizeValidationError([
      ...pendingAttachments,
      ...acceptedFiles,
    ]);

    if (totalSizeValidationError) {
      toast.error(totalSizeValidationError);
      return;
    }

    const nextPendingAttachments = acceptedFiles.map((file) => ({
      clientId: createPendingAttachmentId(),
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      kind: getAttachmentKind(file.type),
      progress: 0,
      status: "uploading",
      attachment: null,
    }));

    setPendingAttachments((currentAttachments) => [
      ...currentAttachments,
      ...nextPendingAttachments,
    ]);

    nextPendingAttachments.forEach((pendingAttachment, index) => {
      startAttachmentUpload(pendingAttachment, acceptedFiles[index]);
    });
  };

  const handleFileSelection = (event, sourceType) => {
    queueFilesForUpload(event.target.files, sourceType);
    event.target.value = "";
  };

  const handleRemovePendingAttachment = async (clientId) => {
    const attachmentToRemove = pendingAttachments.find(
      (attachment) => attachment.clientId === clientId,
    );

    if (!attachmentToRemove) {
      return;
    }

    setPendingAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.clientId !== clientId),
    );

    const controller = uploadControllersRef.current.get(clientId);
    if (controller) {
      controller.abort();
      uploadControllersRef.current.delete(clientId);
      return;
    }

    if (attachmentToRemove.status === "uploaded" && attachmentToRemove.attachment) {
      await removeUploadedAttachment(attachmentToRemove.attachment);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if ((!text.trim() && uploadedAttachments.length === 0) || hasUploadingAttachments) {
      return;
    }

    if (isSoundEnabled) {
      playRandomKeyStrokeSound();
    }

    const sentMessage = await sendMessage({
      text: text.trim(),
      attachments: uploadedAttachments,
    });

    if (!sentMessage) {
      return;
    }

    setText("");
    setPendingAttachments([]);
    resetAttachmentInputs();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);

    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    queueFilesForUpload(event.dataTransfer.files, "drop");
  };

  return (
    <div
      className={`border-t border-slate-700/50 p-4 transition-colors ${
        isDragActive ? "bg-cyan-500/5" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="message-drop-zone"
    >
      {(pendingAttachments.length > 0 || isDragActive) && (
        <div className="mx-auto mb-3 max-w-3xl">
          <div
            className={`rounded-xl border p-3 ${
              isDragActive
                ? "border-cyan-400/60 bg-cyan-500/10"
                : "border-slate-700 bg-slate-800/60"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-200">
                {isDragActive
                  ? "Drop up to 5 files here"
                  : "Pending attachments"}
              </p>
              <p className="text-xs text-slate-400">
                {uploadedAttachments.length}/{pendingAttachments.length} ready
              </p>
            </div>

            {pendingAttachments.length > 0 ? (
              <div
                className="grid gap-3 md:grid-cols-2"
                data-testid="pending-attachment-list"
              >
                {pendingAttachments.map((attachment) => {
                  const PendingIcon =
                    pendingAttachmentIcons[getAttachmentIconKey(attachment)] ||
                    FileTypeIcon;
                  const isUploaded = attachment.status === "uploaded";
                  const isUploading = attachment.status === "uploading";

                  return (
                    <div
                      key={attachment.clientId}
                      className="rounded-lg border border-slate-700 bg-slate-900/60 p-3"
                      data-testid="pending-attachment-item"
                    >
                      <div className="flex items-start gap-3">
                        {attachment.kind === "image" && isUploaded ? (
                          <img
                            src={attachment.attachment?.url}
                            alt={attachment.originalName}
                            className="h-14 w-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-cyan-400">
                            {isUploading ? (
                              <LoaderCircleIcon className="size-5 animate-spin" />
                            ) : (
                              <PendingIcon className="size-5" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-200">
                                {attachment.originalName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {getAttachmentDisplayType(attachment)} -{" "}
                                {formatAttachmentSize(attachment.size)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemovePendingAttachment(attachment.clientId)
                              }
                              className="rounded-full bg-slate-800 p-1 text-slate-300 transition-colors hover:bg-slate-700"
                              aria-label={`Remove ${attachment.originalName}`}
                              data-testid="remove-pending-attachment"
                            >
                              <XIcon className="size-4" />
                            </button>
                          </div>

                          {isUploading ? (
                            <div className="mt-3">
                              <div className="h-2 rounded-full bg-slate-800">
                                <div
                                  className="h-2 rounded-full bg-cyan-500 transition-all"
                                  style={{ width: `${attachment.progress}%` }}
                                  data-testid="pending-upload-progress"
                                />
                              </div>
                              <p className="mt-1 text-xs text-slate-400">
                                Uploading {attachment.progress}%
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-emerald-400">Ready to send</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-cyan-400/50 px-4 py-6 text-center text-sm text-cyan-300">
                Drop images, PDFs, Office files, or text files here
              </div>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="mx-auto flex max-w-3xl items-center space-x-4"
      >
        <input
          type="text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (isSoundEnabled) {
              playRandomKeyStrokeSound();
            }
          }}
          className="flex-1 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-2"
          placeholder="Type your message..."
          data-testid="message-input"
        />

        <input
          type="file"
          accept={IMAGE_ATTACHMENT_ACCEPT}
          multiple
          ref={imageInputRef}
          onChange={(event) => handleFileSelection(event, "image")}
          className="hidden"
          data-testid="image-attachment-input"
        />

        <input
          type="file"
          accept={FILE_ATTACHMENT_ACCEPT}
          multiple
          ref={fileInputRef}
          onChange={(event) => handleFileSelection(event, "file")}
          className="hidden"
          data-testid="file-attachment-input"
        />

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={hasUploadingAttachments}
          className="rounded-lg bg-slate-800/50 px-4 text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Attach image"
          data-testid="image-attachment-button"
        >
          <ImageIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={hasUploadingAttachments}
          className="rounded-lg bg-slate-800/50 px-4 text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Attach files"
          data-testid="file-attachment-button"
        >
          <FileTextIcon className="h-5 w-5" />
        </button>

        <button
          type="submit"
          disabled={(!text.trim() && uploadedAttachments.length === 0) || hasUploadingAttachments}
          className="rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 font-medium text-white transition-all hover:from-cyan-600 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
          data-testid="send-message"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
