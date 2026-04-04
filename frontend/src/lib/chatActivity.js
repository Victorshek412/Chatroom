import {
  getPrimaryAttachment,
  inferImageMimeTypeFromUrl,
} from "./messageAttachments";

export const getListTimeLabel = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

export const getUnifiedAttachment = (message) => {
  if (message?.attachment) {
    return message.attachment;
  }

  const primaryAttachment = getPrimaryAttachment(message);
  if (primaryAttachment) {
    return primaryAttachment;
  }

  if (message?.image) {
    return {
      kind: "image",
      url: message.image,
      originalName: "Shared image",
      size: 0,
      mimeType: inferImageMimeTypeFromUrl(message.image),
    };
  }

  return null;
};

export const getMessagePreview = (message) => {
  if (!message) {
    return "Start the conversation";
  }

  const attachment = getUnifiedAttachment(message);
  if (attachment) {
    const attachmentLabel = attachment.kind === "image"
      ? `Photo - ${attachment.originalName}`
      : attachment.originalName;
    return attachmentLabel.length > 24
      ? `${attachmentLabel.slice(0, 21)}...`
      : attachmentLabel;
  }

  if (!message.text) {
    return "Start the conversation";
  }

  return message.text.length > 24
    ? `${message.text.slice(0, 21)}...`
    : message.text;
};

export const buildChatActivity = (message) => ({
  previewText: getMessagePreview(message),
  timeLabel: message ? getListTimeLabel(message.createdAt) : "",
});
