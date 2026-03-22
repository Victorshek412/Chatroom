import MessageAttachment from "./MessageAttachment";

function MessageAttachments({ attachments, isOwnMessage }) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  const imageAttachments = attachments.filter(
    (attachment) => attachment.kind === "image",
  );
  const fileAttachments = attachments.filter(
    (attachment) => attachment.kind !== "image",
  );

  return (
    <div className="space-y-2">
      {imageAttachments.length > 0 && (
        <div
          className={`grid gap-2 ${
            imageAttachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {imageAttachments.map((attachment) => (
            <MessageAttachment
              key={attachment.storageKey || attachment.url}
              attachment={attachment}
              isOwnMessage={isOwnMessage}
            />
          ))}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div className="space-y-2">
          {fileAttachments.map((attachment) => (
            <MessageAttachment
              key={attachment.storageKey || attachment.url}
              attachment={attachment}
              isOwnMessage={isOwnMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageAttachments;
