export const MESSAGE_ATTACHMENT_FILE_FIELD = "file";
export const MESSAGE_ATTACHMENT_PROVIDER = "cloudinary";
export const MESSAGE_ATTACHMENT_FOLDER = "chatroom/message-attachments";
export const MAX_MESSAGE_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const PDF_MIME_TYPE = "application/pdf";

const trimString = (value) => (typeof value === "string" ? value.trim() : "");

export const isImageAttachmentMimeType = (mimeType = "") =>
  mimeType.startsWith("image/");

export const isAllowedAttachmentMimeType = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType) || mimeType === PDF_MIME_TYPE;

export const getAttachmentKind = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType) ? "image" : "file";

export const normalizeAttachmentMetadata = (attachment = {}) => ({
  url: trimString(attachment.url),
  originalName: trimString(attachment.originalName),
  mimeType: trimString(attachment.mimeType),
  size: Number(attachment.size),
  kind: trimString(attachment.kind),
  provider: trimString(attachment.provider),
  storageKey: trimString(attachment.storageKey),
});

export const getAttachmentValidationError = (attachment = {}) => {
  const normalizedAttachment = normalizeAttachmentMetadata(attachment);

  if (!normalizedAttachment.url) {
    return "Attachment URL is required.";
  }
  if (!normalizedAttachment.originalName) {
    return "Attachment name is required.";
  }
  if (!normalizedAttachment.mimeType) {
    return "Attachment type is required.";
  }
  if (!isAllowedAttachmentMimeType(normalizedAttachment.mimeType)) {
    return "Only images and PDF files are allowed.";
  }
  if (!Number.isFinite(normalizedAttachment.size) || normalizedAttachment.size <= 0) {
    return "Attachment size must be greater than 0.";
  }
  if (normalizedAttachment.size > MAX_MESSAGE_ATTACHMENT_SIZE) {
    return "Attachment must be 5 MB or smaller.";
  }
  if (normalizedAttachment.kind !== getAttachmentKind(normalizedAttachment.mimeType)) {
    return "Attachment kind does not match the file type.";
  }
  if (!normalizedAttachment.provider) {
    return "Attachment provider is required.";
  }

  return null;
};

export const buildCloudinaryAttachmentMetadata = (uploadResult, file = {}) => {
  const mimeType = trimString(file.mimetype);
  const fallbackExtension =
    uploadResult?.format || (isImageAttachmentMimeType(mimeType) ? "jpg" : "pdf");
  const originalName =
    trimString(file.originalname) ||
    trimString(uploadResult?.original_filename) ||
    `shared-attachment.${fallbackExtension}`;

  return normalizeAttachmentMetadata({
    url: uploadResult?.secure_url,
    originalName,
    mimeType: mimeType || `${uploadResult?.resource_type}/${uploadResult?.format || "octet-stream"}`,
    size: file.size || uploadResult?.bytes,
    kind: getAttachmentKind(mimeType || `${uploadResult?.resource_type}/${uploadResult?.format || ""}`),
    provider: MESSAGE_ATTACHMENT_PROVIDER,
    storageKey: uploadResult?.public_id,
  });
};
