import {
  findDuplicateModules,
  splitBySemanticModulePath,
} from "./duplicateModules";

it("handles non-scoped packages", () => {
  const ret = splitBySemanticModulePath("foo/node_modules/zap/tap");
  expect(ret).toEqual(["foo", "node_modules", "zap", "tap"]);
});

it("handles @scoped packages", () => {
  const ret = splitBySemanticModulePath("foo/node_modules/@zap/tap");
  expect(ret).toEqual(["foo", "node_modules", "@zap/tap"]);
});

it("handles one module", () => {
  const ret = findDuplicateModules(["foo/zap/node_modules/tap"]);

  expect(ret.length).toBe(0);
});

it("handles multiple modules", () => {
  const ret = findDuplicateModules([
    "foo/zap/node_modules/tap",
    "foo/zap/node_modules/bar",
  ]);

  expect(ret.length).toBe(0);
});

it("correctly splits @ scoped modules", () => {
  const ret = findDuplicateModules([
    "foo/zap/node_modules/@tap/wow",
    "foo/zap/node_modules/no/node_modules/@tap/zap",
  ]);

  expect(ret.length).toBe(0);
});

it("correctly find duplicated @ scoped modules", () => {
  const ret = findDuplicateModules([
    "foo/zap/node_modules/@tap/wow",
    "foo/zap/node_modules/no/node_modules/@tap/wow",
  ]);

  expect(ret.length).toBe(1);
  expect(ret[0].key).toBe("@tap/wow");
  expect(ret[0].value.sort()).toEqual(["<PROJECT ROOT>", "no"]);
});

it("handles duplicate modules", () => {
  const ret = findDuplicateModules([
    "foo/zap/node_modules/tap",
    "foo/zap/node_modules/bar/node_modules/tap",
  ]);

  expect(ret.length).toBe(1);
  expect(ret[0].key).toBe("tap");
  expect(ret[0].value.sort()).toEqual(["<PROJECT ROOT>", "bar"]);
});

it("handles multiple duplicate modules", () => {
  const ret = findDuplicateModules([
    "foo/zap/node_modules/tap",
    "foo/zap/node_modules/bar/node_modules/tap",
    "foo/zap/node_modules/lap",
    "foo/zap/node_modules/wow/node_modules/lap",
  ]);

  expect(ret.length).toBe(2);
  expect(ret[0].key).toBe("tap");
  expect(ret[0].value.sort()).toEqual(["<PROJECT ROOT>", "bar"]);

  expect(ret[1].key).toBe("lap");
  expect(ret[1].value.sort()).toEqual(["<PROJECT ROOT>", "wow"]);
});

it("handles deeply nested scoped packages", () => {
  const ret = splitBySemanticModulePath(
    "node_modules/lodash/node_modules/@babel/core/node_modules/@babel/helper"
  );
  expect(ret).toEqual([
    "node_modules",
    "lodash",
    "node_modules",
    "@babel/core",
    "node_modules",
    "@babel/helper",
  ]);
});

it("handles scoped package followed by node_modules (flush pending scope)", () => {
  const ret = splitBySemanticModulePath(
    "node_modules/@scope/node_modules/@other/pkg/file.js"
  );
  expect(ret).toEqual([
    "node_modules",
    "@scope",
    "node_modules",
    "@other/pkg",
    "file.js",
  ]);
});

it("finds duplicates only at nested depths (both depth > 1)", () => {
  const ret = findDuplicateModules([
    "src/node_modules/other/node_modules/@babel/helper/index.js",
    "src/node_modules/lodash/node_modules/@babel/core/node_modules/@babel/helper/index.js",
  ]);

  expect(ret.length).toBe(1);
  expect(ret[0].key).toBe("@babel/helper");
  expect(ret[0].value.sort()).toEqual(["@babel/core", "other"]);
});
