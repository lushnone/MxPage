import test from "node:test";
import assert from "node:assert/strict";
import { artDirectionBatchRanges, artDirectionBatchSize, artDirectionRequestKey, shouldBatchArtDirection } from "@/lib/detail-runs/art-direction-batches";

const bailian = "https://foo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

test("splits 10 screens one-by-one for Bailian", () => {
  assert.equal(shouldBatchArtDirection(bailian, 10), true);
  assert.equal(artDirectionBatchSize(bailian, 10), 1);
  assert.deepEqual(artDirectionBatchRanges(10, 1), Array.from({ length: 10 }, (_, index) => ({ start: index, end: index + 1 })));
  assert.equal(artDirectionRequestKey(5, 6, 10), "ART_DIRECTION:5-5");
});

test("single batch keeps legacy ART_DIRECTION key", () => {
  assert.equal(shouldBatchArtDirection("https://api.openai.com/v1", 7), false);
  assert.deepEqual(artDirectionBatchRanges(7), [{ start: 0, end: 5 }, { start: 5, end: 7 }]);
  assert.equal(artDirectionRequestKey(0, 7, 7), "ART_DIRECTION");
});