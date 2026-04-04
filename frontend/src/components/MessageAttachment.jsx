import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import {
  formatAttachmentSize,
  getAttachmentTypeLabel,
} from "../lib/messageAttachments";

function MessageAttachment({ attachment, isOwnMessage }) {
  if (!attachment) {
    return null;
  }

  const attachmentName = attachment.originalName || "Shared file";
  const attachmentTypeLabel = getAttachmentTypeLabel(attachment);

  if (attachment.kind === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        download={attachmentName}
        className="block"
      >
        <img
          src={attachment.url}
          alt={attachmentName}
          className="max-h-36 rounded-[14px] border object-cover"
          style={{ borderColor: "var(--ct-border-light)" }}
          data-testid="message-attachment-image"
        />
      </a>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-[14px] border px-[8px] py-[7px]"
      style={{
        background: isOwnMessage ? "var(--ct-bubble-own-bg)" : "var(--ct-bubble-bg)",
        borderColor: "var(--ct-border-light)",
      }}
      data-testid="message-attachment-file"
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]"
        style={{ background: "var(--ct-active-bg)", color: "var(--ct-text1)" }}
      >
        <FileTextIcon size={12} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ color: "var(--ct-text1)" }}>
          {attachmentName}
        </p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--ct-text2)" }}>
          {attachmentTypeLabel} - {formatAttachmentSize(attachment.size)}
        </p>
        <div className="mt-2 flex gap-1.5">
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{
              background: "var(--ct-panel)",
              border: "1px solid var(--ct-border-light)",
              color: "var(--ct-text2)",
            }}
            data-testid="open-attachment-link"
          >
            <ExternalLinkIcon size={10} />
            Open
          </a>
          <a
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            download={attachmentName}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={{
              background: "var(--ct-panel)",
              border: "1px solid var(--ct-border-light)",
              color: "var(--ct-text2)",
            }}
            data-testid="download-attachment-link"
          >
            <DownloadIcon size={10} />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export default MessageAttachment;
