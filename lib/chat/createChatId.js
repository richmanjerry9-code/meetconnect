// lib/chat/createChatId.js

/**
 * Creates a unique chat ID for two users by sorting their UIDs and joining them.
 * @param {string} uid1 - First user's UID
 * @param {string} uid2 - Second user's UID
 * @returns {string} Unique chat ID
 */
export function createChatId(uid1, uid2) {
  if (!uid1 || !uid2) {
    throw new Error('Both UIDs are required to create a chat ID.');
  }
  return [uid1, uid2].sort().join('_');
}