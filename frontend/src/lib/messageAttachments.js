export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_IMAGE_ATTACHMENT_SIZE = 8 * 1024 * 1024;
export const MAX_DOCUMENT_ATTACHMENT_SIZE = 15 * 1024 * 1024;
export const MAX_TOTAL_MESSAGE_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export const IMAGE_ATTACHMENT_ACCEPT = "image/*";
export const FILE_ATTACHMENT_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
].join(",");

const DOCUMENT_MIME_TYPE_LABELS = new Map([
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

const CLOUDINARY_UPLOAD_PATH_SEGMENT = "/upload/";

const trimString = (value) => (typeof value === "string" ? value.trim() : "");

export const isImageAttachmentType = (mimeType = "") =>
  mimeType.startsWith("image/");

export const isDocumentAttachmentType = (mimeType = "") =>
  DOCUMENT_MIME_TYPE_LABELS.has(trimString(mimeType));

export const isPdfAttachmentType = (mimeType = "") =>
  trimString(mimeType) === "application/pdf";

export const isAllowedMessageAttachmentType = (mimeType = "") =>
  isImageAttachmentType(mimeType) || isDocumentAttachmentType(mimeType);

export const getAttachmentKind = (mimeType = "") =>
  isImageAttachmentType(mimeType) ? "image" : "file";

export const getAttachmentMaxSize = (mimeType = "") =>
  isImageAttachmentType(mimeType)
    ? MAX_IMAGE_ATTACHMENT_SIZE
    : MAX_DOCUMENT_ATTACHMENT_SIZE;

export const getAttachmentSizeErrorMessage = (mimeType = "") =>
  isImageAttachmentType(mimeType)
    ? "Image files must be 8 MB or smaller."
    : "PDF, Office, and text files must be 15 MB or smaller.";

export const getAttachmentValidationError = ({ type, size } = {}) => {
  if (!type) {
    return "Attachment type is required.";
  }

  if (!isAllowedMessageAttachmentType(type)) {
    return "Only images, PDFs, Word, Excel, PowerPoint, and text files are allowed.";
  }

  if (!Number.isFinite(Number(size)) || Number(size) <= 0) {
    return "Attachment size must be greater than 0.";
  }

  if (Number(size) > getAttachmentMaxSize(type)) {
    return getAttachmentSizeErrorMessage(type);
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

export const formatAttachmentSize = (size = 0) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getAttachmentDisplayType = (attachment = {}) => {
  if (attachment.kind === "image" || isImageAttachmentType(attachment.mimeType)) {
    return "Image";
  }

  const mimeType = trimString(attachment.mimeType);
  if (DOCUMENT_MIME_TYPE_LABELS.has(mimeType)) {
    return DOCUMENT_MIME_TYPE_LABELS.get(mimeType);
  }

  const extension = trimString(attachment.originalName).split(".").pop()?.toUpperCase();
  return extension || "FILE";
};

export const getAttachmentIconKey = (attachment = {}) => {
  const mimeType = trimString(attachment.mimeType);

  if (isImageAttachmentType(mimeType)) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }

  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "spreadsheet";
  }

  if (
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "presentation";
  }

  if (mimeType === "text/plain") {
    return "text";
  }

  return "file";
};

const getAttachmentDownloadNameBase = (originalName = "") => {
  const normalizedFileName = trimString(originalName).split(/[\\/]/).pop() || "";

  if (!normalizedFileName) {
    return "shared-file";
  }

  const extensionIndex = normalizedFileName.lastIndexOf(".");
  const baseName =
    extensionIndex > 0
      ? normalizedFileName.slice(0, extensionIndex)
      : normalizedFileName;

  return baseName || "shared-file";
};

const isCloudinaryUploadUrl = (urlValue = "") => {
  try {
    const parsedUrl = new URL(urlValue);
    return (
      parsedUrl.hostname.endsWith("cloudinary.com") &&
      parsedUrl.pathname.includes(CLOUDINARY_UPLOAD_PATH_SEGMENT)
    );
  } catch {
    return false;
  }
};

export const getAttachmentDownloadUrl = (attachment = {}) => {
  const attachmentUrl = trimString(attachment.url);

  if (!attachmentUrl || !isDocumentAttachmentType(attachment.mimeType)) {
    return attachmentUrl;
  }

  if (!isCloudinaryUploadUrl(attachmentUrl)) {
    return attachmentUrl;
  }

  try {
    const parsedUrl = new URL(attachmentUrl);

    if (parsedUrl.pathname.includes("/fl_attachment:")) {
      return parsedUrl.toString();
    }

    const downloadName = encodeURIComponent(
      getAttachmentDownloadNameBase(attachment.originalName),
    );

    parsedUrl.pathname = parsedUrl.pathname.replace(
      CLOUDINARY_UPLOAD_PATH_SEGMENT,
      `${CLOUDINARY_UPLOAD_PATH_SEGMENT}fl_attachment:${downloadName}/`,
    );

    return parsedUrl.toString();
  } catch {
    return attachmentUrl;
  }
};

export const getMessageAttachments = (message) =>
  Array.isArray(message?.attachments) ? message.attachments : [];
