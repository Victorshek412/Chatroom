import {
  DownloadIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  ImageIcon,
  NotebookTextIcon,
  PresentationIcon,
} from "lucide-react";
import {
  formatAttachmentSize,
  getAttachmentDisplayType,
  getAttachmentIconKey,
} from "../lib/messageAttachments";

const attachmentIcons = {
  image: ImageIcon,
  pdf: FileTextIcon,
  document: FileTypeIcon,
  spreadsheet: FileSpreadsheetIcon,
  presentation: PresentationIcon,
  text: NotebookTextIcon,
  file: FileTypeIcon,
};

function MessageAttachment({ attachment, isOwnMessage }) {
  if (!attachment) {
    return null;
  }

  if (attachment.kind === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        download={attachment.originalName}
        className="block overflow-hidden rounded-lg"
      >
        <img
          src={attachment.url}
          alt={attachment.originalName || "Shared attachment"}
          className="h-40 w-full rounded-lg object-cover"
          data-testid="message-attachment-image"
        />
      </a>
    );
  }

  const AttachmentIcon =
    attachmentIcons[getAttachmentIconKey(attachment)] || FileTypeIcon;

  return (
    <div
      className={`rounded-lg border px-3 py-3 transition-colors ${
        isOwnMessage
          ? "border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20"
          : "border-slate-600 bg-slate-900/40 hover:bg-slate-900/70"
      }`}
      data-testid="message-attachment-file"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950/30">
          <AttachmentIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{attachment.originalName}</p>
          <p className="text-xs opacity-80">
            {getAttachmentDisplayType(attachment)} -{" "}
            {formatAttachmentSize(attachment.size)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-slate-950/30 px-2 py-1 text-xs font-medium"
              data-testid="open-attachment-link"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open
            </a>
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              download={attachment.originalName}
              className="inline-flex items-center gap-1 rounded-md bg-slate-950/30 px-2 py-1 text-xs font-medium"
              data-testid="download-attachment-link"
            >
              <DownloadIcon className="size-3.5" />
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageAttachment;
