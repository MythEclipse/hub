import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPublicAccess } from "./public-access.ts";

/**
 * The published example is a claim the visitor will paste into a terminal. If
 * it does not match the fields rendered beside it, the page is lying in the one
 * place it is easiest to check.
 */
describe("buildPublicAccess", () => {
  const config = {
    baseUrl: "https://ai.asepharyana.my.id/v1",
    model: "free",
    apiKey: "sk-test-key",
  };

  it("builds the example from the same fields it publishes", () => {
    const access = buildPublicAccess(config);

    assert.equal(access.baseUrl, config.baseUrl);
    assert.equal(access.model, config.model);
    assert.equal(access.apiKey, config.apiKey);
    assert.match(access.curl, new RegExp(`${config.baseUrl}/chat/completions`));
    assert.match(access.curl, new RegExp(`Bearer ${config.apiKey}`));
  });

  it("keeps the request body valid JSON", () => {
    const { curl } = buildPublicAccess(config);
    const match = curl.match(/-d '(.+)'/);

    assert.ok(match, "the example must carry a -d body");
    const body = JSON.parse(match[1] as string);

    assert.equal(body.model, config.model);
    assert.equal(body.messages[0].role, "user");
    assert.equal(body.messages[0].content, "Halo");
  });
});
