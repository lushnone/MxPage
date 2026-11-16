import assert from "node:assert/strict";
import { test } from "node:test";
import { V4_MAX_REQUEST_ATTEMPTS } from "@/lib/detail-runs/service-v4";

test("V4 workflow defaults to one model dispatch per request key", () => {
  assert.equal(V4_MAX_REQUEST_ATTEMPTS, 1);
});