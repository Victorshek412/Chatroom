import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FileTextIcon,
  ImageIcon,
  LoaderCircleIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import {
  formatAttachmentSize,
  isImageAttachmentType,
  isPdfAttachmentType,
  MAX_MESSAGE_ATTACHMENT_SIZE,
} from "../lib/messageAttachments";
import { useChatStore } from "../store/useChatStore";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { sendMessage, uploadMessageAttachment, isSoundEnabled } = useChatStore();

  const resetAttachmentInput = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !pendingAttachment) return;
    if (isUploadingAttachment) return;

    if (isSoundEnabled) {
      playRandomKeyStrokeSound();
    }

    const sentMessage = await sendMessage({
      text: text.trim(),
      attachments: pendingAttachment ? [pendingAttachment] : [],
    });

    if (!sentMessage) {
      return;
    }

    setText("");
    setPendingAttachment(null);
    resetAttachmentInput();
  };

  const handleAttachmentChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const isValidType =
      type === "image"
        ? isImageAttachmentType(file.type)
        : isPdfAttachmentType(file.type);

    if (!isValidType) {
      toast.error(
        type === "image"
          ? "Only image files are allowed."
          : "Only PDF files are allowed.",
      );
      resetAttachmentInput();
      return;
    }

    if (file.size > MAX_MESSAGE_ATTACHMENT_SIZE) {
      toast.error("Attachment must be 5 MB or smaller.");
      resetAttachmentInput();
      return;
    }

    setIsUploadingAttachment(true);

    try {
      const uploadedAttachment = await uploadMessageAttachment(file);
      setPendingAttachment(uploadedAttachment);
    } catch (error) {
      toast.error(error.message || "Failed to upload attachment.");
      resetAttachmentInput();
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const removeAttachment = () => {
    setPendingAttachment(null);
    resetAttachmentInput();
  };

  return (
    <div className="p-4 border-t border-slate-700/50">
      {(pendingAttachment || isUploadingAttachment) && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div
            className="relative w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800/60 p-3"
            data-testid="pending-attachment"
          >
            {pendingAttachment && !isUploadingAttachment && (
              <button
                onClick={removeAttachment}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
                type="button"
                aria-label="Remove attachment"
                data-testid="remove-attachment"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}

            {isUploadingAttachment ? (
              <div className="flex items-center gap-3 text-slate-200">
                <LoaderCircleIcon className="size-5 animate-spin text-cyan-400" />
                <p className="text-sm">Uploading attachment...</p>
              </div>
            ) : pendingAttachment?.kind === "image" ? (
              <div className="flex items-center gap-3">
                <img
                  src={pendingAttachment.url}
                  alt="Attachment preview"
                  className="h-20 w-20 rounded-lg border border-slate-700 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {pendingAttachment.originalName}
                  </p>
                  <p className="text-xs text-slate-400">
                    Image - {formatAttachmentSize(pendingAttachment.size)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-900/70 text-cyan-400">
                  <FileTextIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {pendingAttachment.originalName}
                  </p>
                  <p className="text-xs text-slate-400">
                    PDF - {formatAttachmentSize(pendingAttachment.size)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex space-x-4"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (isSoundEnabled) {
              playRandomKeyStrokeSound();
            }
          }}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4"
          placeholder="Type your message..."
          data-testid="message-input"
        />

        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          onChange={(e) => handleAttachmentChange(e, "image")}
          className="hidden"
          data-testid="image-attachment-input"
        />

        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          onChange={(e) => handleAttachmentChange(e, "file")}
          className="hidden"
          data-testid="file-attachment-input"
        />

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={isUploadingAttachment || Boolean(pendingAttachment)}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            pendingAttachment?.kind === "image" ? "text-cyan-500" : ""
          }`}
          aria-label="Attach image"
          data-testid="image-attachment-button"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAttachment || Boolean(pendingAttachment)}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            pendingAttachment?.kind === "file" ? "text-cyan-500" : ""
          }`}
          aria-label="Attach PDF"
          data-testid="file-attachment-button"
        >
          <FileTextIcon className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={(!text.trim() && !pendingAttachment) || isUploadingAttachment}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
          data-testid="send-message"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
