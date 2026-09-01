/**
 * ownerAdmin.js
 *
 * Single source of truth for "is this account an owner/admin?".
 *
 * This used to be answered four different ways across the codebase, and they
 * disagreed. routes/admin.js honoured a three-email list case-insensitively;
 * routes/boldChoices.js compared against one hardcoded email with ===;
 * simple-backend-rag.js ignored email entirely and looked only at
 * betaAccessLevel/subscription; routes/promoCodes.js read OWNER_EMAIL with no
 * default, so an unset env var silently matched nobody. The practical result
 * was an account that was admin in the dashboard but metered in Bold Choices.
 *
 * Deliberately dependency-free so anything can require it.
 */

const DEFAULT_OWNER_EMAILS = [
  "corey@childactor101.com",
  "admin@prep101.site",
  "themrralstons@icloud.com",
];

/**
 * Owner emails from DEFAULT_OWNER_EMAILS plus OWNER_EMAILS (comma-separated)
 * or the legacy singular OWNER_EMAIL. All normalized to trimmed lowercase.
 */
function getOwnerAdminEmails() {
  const configured = String(process.env.OWNER_EMAILS || process.env.OWNER_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_OWNER_EMAILS, ...configured]);
}

function isOwnerAdminEmail(email) {
  if (!email) return false;
  return getOwnerAdminEmails().has(String(email).trim().toLowerCase());
}

/**
 * True when the account should bypass metering and paywalls entirely.
 * Accepts any of the three signals the app has historically used, so an
 * account that is admin anywhere is admin everywhere.
 */
function isAdminUser(user) {
  if (!user) return false;
  return Boolean(
    isOwnerAdminEmail(user.email) ||
      user.betaAccessLevel === "admin" ||
      user.subscription === "admin"
  );
}

module.exports = {
  DEFAULT_OWNER_EMAILS,
  getOwnerAdminEmails,
  isOwnerAdminEmail,
  isAdminUser,
};
