export const MAX_MESSAGE_ATTACHMENT_SIZE = 5 * 1024 * 1024;

export const isImageAttachmentType = (mimeType = "") =>
  mimeType.startsWith("image/");

export const isPdfAttachmentType = (mimeType = "") =>
  mimeType === "application/pdf";

export const isAllowedMessageAttachmentType = (mimeType = "") =>
  isImageAttachmentType(mimeType) || isPdfAttachmentType(mimeType);

export const formatAttachmentSize = (size = 0) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getPrimaryAttachment = (message) =>
  Array.isArray(message?.attachments) ? message.attachments[0] || null : null;
