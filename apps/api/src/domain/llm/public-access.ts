/**
 * The credentials this site publishes so a visitor can call the router that
 * serves its own dashboard reading.
 *
 * Built here rather than in the SPA so the three fields and the example request
 * cannot drift apart: the `curl` is assembled from the same values that are
 * rendered beside it.
 */
export interface PublicAccess {
  /** OpenAI-compatible base URL, without a trailing slash. */
  baseUrl: string;
  model: string;
  /**
   * The key itself. It is published deliberately — the owner opened this
   * endpoint to visitors — so it is not a secret being leaked, but it is still
   * served from configuration rather than compiled into the bundle, so it can
   * be rotated by changing an environment variable instead of rebuilding the
   * web app.
   */
  apiKey: string;
  /** A copy-paste request, built from the fields above. */
  curl: string;
}
