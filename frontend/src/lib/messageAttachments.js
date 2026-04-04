export const MAX_MESSAGE_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const IMAGE_EXTENSION_TO_MIME_TYPE = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export const getFileExtension = (value = "") => {
  const sanitizedValue = String(value).split(/[?#]/)[0];
  const parts = sanitizedValue.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts[parts.length - 1].trim().toUpperCase();
};

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

export const getAttachmentTypeLabel = (attachment = {}) => {
  const fileExtension = getFileExtension(attachment.originalName);
  if (fileExtension) {
    return fileExtension;
  }

  const mimeSubtype = String(attachment.mimeType || "").split("/")[1] || "";
  if (mimeSubtype) {
    return mimeSubtype.toUpperCase();
  }

  return attachment.kind === "image" ? "IMAGE" : "FILE";
};

export const inferImageMimeTypeFromUrl = (url = "") => {
  const fileExtension = getFileExtension(url).toLowerCase();
  return IMAGE_EXTENSION_TO_MIME_TYPE[fileExtension] || "image/*";
};

export const getPrimaryAttachment = (message) =>
  Array.isArray(message?.attachments) ? message.attachments[0] || null : null;
