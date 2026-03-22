export const MESSAGE_ATTACHMENT_FILES_FIELD = "files";
export const MESSAGE_ATTACHMENT_LEGACY_FILE_FIELD = "file";
export const MESSAGE_ATTACHMENT_PROVIDER = "cloudinary";
export const MESSAGE_ATTACHMENT_FOLDER = "chatroom/message-attachments";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_IMAGE_ATTACHMENT_SIZE = 8 * 1024 * 1024;
export const MAX_DOCUMENT_ATTACHMENT_SIZE = 15 * 1024 * 1024;
export const MAX_TOTAL_MESSAGE_ATTACHMENT_SIZE = 25 * 1024 * 1024;
export const MAX_MESSAGE_ATTACHMENT_UPLOAD_SIZE = MAX_DOCUMENT_ATTACHMENT_SIZE;

const ALLOWED_DOCUMENT_MIME_TYPES = new Map([
  ["application/pdf", "PDF"],
  ["application/msword", "DOC"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "DOCX",
  ],
  ["application/vnd.ms-excel", "XLS"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "XLSX",
  ],
  ["application/vnd.ms-powerpoint", "PPT"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "PPTX",
  ],
  ["text/plain", "TXT"],
]);

const ALLOWED_CLOUDINARY_RESOURCE_TYPES = new Set(["image", "raw"]);

const trimString = (value) => (typeof value === "string" ? value.trim() : "");

export const isImageAttachmentMimeType = (mimeType = "") =>
  mimeType.startsWith("image/");

export const isDocumentAttachmentMimeType = (mimeType = "") =>
  ALLOWED_DOCUMENT_MIME_TYPES.has(trimString(mimeType));

export const isAllowedAttachmentMimeType = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType) || isDocumentAttachmentMimeType(mimeType);

export const getAttachmentKind = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType) ? "image" : "file";

export const getAttachmentMaxSize = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType)
    ? MAX_IMAGE_ATTACHMENT_SIZE
    : MAX_DOCUMENT_ATTACHMENT_SIZE;

export const getAttachmentSizeErrorMessage = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType)
    ? "Image files must be 8 MB or smaller."
    : "PDF, Office, and text files must be 15 MB or smaller.";

export const getAttachmentTypeLabel = (mimeType = "", originalName = "") => {
  if (isImageAttachmentMimeType(mimeType)) {
    return "Image";
  }

  const normalizedMimeType = trimString(mimeType);
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMimeType)) {
    return ALLOWED_DOCUMENT_MIME_TYPES.get(normalizedMimeType);
  }

  const extension = trimString(originalName).split(".").pop()?.toUpperCase();
  return extension || "FILE";
};

export const getRawAttachmentValidationError = ({
  mimeType,
  size,
} = {}) => {
  const normalizedMimeType = trimString(mimeType);
  const numericSize = Number(size);

  if (!normalizedMimeType) {
    return "Attachment type is required.";
  }

  if (!isAllowedAttachmentMimeType(normalizedMimeType)) {
    return "Only images, PDFs, Word, Excel, PowerPoint, and text files are allowed.";
  }

  if (!Number.isFinite(numericSize) || numericSize <= 0) {
    return "Attachment size must be greater than 0.";
  }

  if (numericSize > getAttachmentMaxSize(normalizedMimeType)) {
    return getAttachmentSizeErrorMessage(normalizedMimeType);
  }

  return null;
};

export const getAttachmentsCountValidationError = (count = 0) =>
  count > MAX_ATTACHMENTS_PER_MESSAGE
    ? "You can attach up to 5 files per message."
    : null;

export const getAttachmentsTotalSize = (attachments = []) =>
  attachments.reduce((total, attachment) => total + Number(attachment?.size || 0), 0);

export const getAttachmentsTotalSizeValidationError = (attachments = []) =>
  getAttachmentsTotalSize(attachments) > MAX_TOTAL_MESSAGE_ATTACHMENT_SIZE
    ? "Attachments in one message must total 25 MB or less."
    : null;

export const getCloudinaryResourceTypeForMimeType = (mimeType = "") =>
  isImageAttachmentMimeType(mimeType) ? "image" : "raw";

export const normalizeCloudinaryResourceType = (
  resourceType = "",
  mimeType = "",
) => {
  const normalizedResourceType = trimString(resourceType);

  if (ALLOWED_CLOUDINARY_RESOURCE_TYPES.has(normalizedResourceType)) {
    return normalizedResourceType;
  }

  return getCloudinaryResourceTypeForMimeType(mimeType);
};

export const normalizeAttachmentMetadata = (attachment = {}) => ({
  url: trimString(attachment.url),
  originalName: trimString(attachment.originalName),
  mimeType: trimString(attachment.mimeType),
  size: Number(attachment.size),
  kind: trimString(attachment.kind),
  provider: trimString(attachment.provider),
  storageKey: trimString(attachment.storageKey),
  resourceType: normalizeCloudinaryResourceType(
    attachment.resourceType,
    attachment.mimeType,
  ),
});

export const getAttachmentValidationError = (attachment = {}) => {
  const normalizedAttachment = normalizeAttachmentMetadata(attachment);

  if (!normalizedAttachment.url) {
    return "Attachment URL is required.";
  }

  if (!normalizedAttachment.originalName) {
    return "Attachment name is required.";
  }

  const rawAttachmentValidationError =
    getRawAttachmentValidationError(normalizedAttachment);

  if (rawAttachmentValidationError) {
    return rawAttachmentValidationError;
  }

  if (normalizedAttachment.kind !== getAttachmentKind(normalizedAttachment.mimeType)) {
    return "Attachment kind does not match the file type.";
  }

  if (!normalizedAttachment.provider) {
    return "Attachment provider is required.";
  }

  if (!normalizedAttachment.storageKey) {
    return "Attachment storage key is required.";
  }

  return null;
};

export const isCloudinaryAttachmentStorageKey = (storageKey = "") =>
  trimString(storageKey).startsWith(`${MESSAGE_ATTACHMENT_FOLDER}/`);

export const buildCloudinaryAttachmentMetadata = (uploadResult, file = {}) => {
  const mimeType = trimString(file.mimetype);
  const fallbackExtension =
    uploadResult?.format ||
    (isImageAttachmentMimeType(mimeType) ? "jpg" : "bin");
  const originalName =
    trimString(file.originalname) ||
    trimString(uploadResult?.original_filename) ||
    `shared-attachment.${fallbackExtension}`;

  return normalizeAttachmentMetadata({
    url: uploadResult?.secure_url,
    originalName,
    mimeType:
      mimeType ||
      `${uploadResult?.resource_type}/${uploadResult?.format || "octet-stream"}`,
    size: file.size || uploadResult?.bytes,
    kind: getAttachmentKind(
      mimeType ||
        `${uploadResult?.resource_type}/${uploadResult?.format || "octet-stream"}`,
    ),
    provider: MESSAGE_ATTACHMENT_PROVIDER,
    storageKey: uploadResult?.public_id,
    resourceType: uploadResult?.resource_type,
  });
};
