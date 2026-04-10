import crypto from "node:crypto";

const FRIEND_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FRIEND_ID_GROUP_LENGTH = 4;
const FRIEND_ID_RAW_LENGTH = FRIEND_ID_GROUP_LENGTH * 2;
const FRIEND_ID_GROUP_SEPARATOR = "-";
const MAX_GENERATION_ATTEMPTS = 10;
const NORMALIZED_FRIEND_ID_PATTERN = new RegExp(
  `^[A-Z0-9]{${FRIEND_ID_RAW_LENGTH}}$`,
);

const buildFriendIdFromNormalizedValue = (normalizedValue) =>
  `${normalizedValue.slice(0, FRIEND_ID_GROUP_LENGTH)}${FRIEND_ID_GROUP_SEPARATOR}${normalizedValue.slice(FRIEND_ID_GROUP_LENGTH)}`;

export const normalizeFriendId = (value = "") =>
  typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";

export const parseFriendId = (value = "") => {
  const normalizedValue = normalizeFriendId(value);

  if (!NORMALIZED_FRIEND_ID_PATTERN.test(normalizedValue)) {
    return null;
  }

  return buildFriendIdFromNormalizedValue(normalizedValue);
};

const generateFriendIdCandidate = () => {
  const randomBytes = crypto.randomBytes(FRIEND_ID_RAW_LENGTH);

  const normalizedValue = Array.from(randomBytes, (byte) => {
    const index = byte % FRIEND_ID_ALPHABET.length;
    return FRIEND_ID_ALPHABET[index];
  }).join("");

  return buildFriendIdFromNormalizedValue(normalizedValue);
};

export const generateUniqueFriendId = async (doesFriendIdExist) => {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateFriendIdCandidate();
    const alreadyExists = await doesFriendIdExist(candidate);

    if (!alreadyExists) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique Friend ID.");
};
