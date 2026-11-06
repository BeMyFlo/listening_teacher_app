const test = require("node:test");
const assert = require("node:assert");
const { validateSignupRequest } = require("../lib/signupRequest");
const { sitemapFor } = require("../lib/seo");
const { POLICY_PATH, POLICY_VERSION } = require("../lib/privacy");

const base = { name: "Nguyễn Văn A", email: "a@example.com" };

test("signup request needs explicit consent === true", () => {
  assert.ok(validateSignupRequest({ ...base, consent: true }).value);
  for (const consent of [undefined, false, "true", "on", "yes", 1]) {
    const r = validateSignupRequest({ ...base, consent });
    assert.equal(r.value, undefined, `consent=${JSON.stringify(consent)} must be rejected`);
    assert.match(r.error, /privacy policy/);
  }
});

test("consent flag is not copied into the stored value", () => {
  const { value } = validateSignupRequest({ ...base, consent: true });
  assert.equal("consent" in value, false);
});

test("policy path and version are well-formed", () => {
  assert.equal(POLICY_PATH, "/chinh-sach-bao-mat");
  assert.match(POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("sitemap lists the privacy policy on the public host", () => {
  const urls = sitemapFor("www.bemyflo.com", "bemyflo.com").map((u) => u.url);
  assert.deepEqual(urls, ["https://www.bemyflo.com/", "https://www.bemyflo.com/chinh-sach-bao-mat"]);
  assert.deepEqual(sitemapFor("abc.bemyflo.com", "bemyflo.com"), []);
});
