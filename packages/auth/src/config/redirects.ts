/**
 * Authentication redirect configuration
 *
 * Backend redirect paths used in email/magic link flows
 */
export const AUTH_REDIRECTS = {
  /**
   * Default redirect path after successful login/signup
   */
  afterLogin: "/apps",

  /**
   * Redirect path after email verification
   */
  afterEmailVerification: "/apps",

  /**
   * Redirect path after magic link login
   */
  afterMagicLink: "/apps",

  /**
   * Base path for organization invitation acceptance
   */
  organizationInvitation: "/accept-invitation",
} as const;
