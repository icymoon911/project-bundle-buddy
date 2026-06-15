import { toEdges, toProcessedBundles } from ".";

it("handles the empty case for toEdges", () => {
  expect(
    toEdges({
      outputs: {},
      inputs: {},
    })
  ).toEqual([]);
});

it("handles generating edges from vite metadata", () => {
  expect(
    toEdges({
      outputs: {},
      inputs: {
        "src/main.ts": {
          bytes: 100,
          imports: [
            { path: "src/utils.ts", kind: "import-statement" },
            { path: "src/style.css", kind: "import-statement" },
          ],
        },
        "src/utils.ts": {
          bytes: 50,
          imports: [{ path: "src/helpers.ts", kind: "import-statement" }],
        },
      },
    })
  ).toEqual([
    { source: "src/main.ts", target: "src/utils.ts" },
    { source: "src/main.ts", target: "src/style.css" },
    { source: "src/utils.ts", target: "src/helpers.ts" },
  ]);
});

it("handles inputs with no imports field gracefully", () => {
  expect(
    toEdges({
      outputs: {},
      inputs: {
        "src/main.ts": {
          bytes: 100,
          imports: undefined as any,
        },
      },
    })
  ).toEqual([]);
});

it("handles the empty case for toProcessedBundles", () => {
  expect(
    toProcessedBundles({
      outputs: {},
      inputs: {},
    })
  ).toEqual({});
});

it("converts vite outputs into processed bundle format", () => {
  expect(
    toProcessedBundles({
      outputs: {
        "assets/index.abc123.js": {
          bytes: 5000,
          inputs: {
            "src/main.ts": { bytesInOutput: 3000 },
            "src/utils.ts": { bytesInOutput: 2000 },
          },
        },
        "assets/index.abc123.css": {
          bytes: 1500,
          inputs: {
            "src/style.css": { bytesInOutput: 1500 },
          },
        },
      },
      inputs: {},
    })
  ).toEqual({
    "assets/index.abc123.js": {
      files: {
        "src/main.ts": { totalBytes: 3000 },
        "src/utils.ts": { totalBytes: 2000 },
      },
      totalBytes: 5000,
    },
    "assets/index.abc123.css": {
      files: {
        "src/style.css": { totalBytes: 1500 },
      },
      totalBytes: 1500,
    },
  });
});

it("handles vite outputs with no inputs gracefully", () => {
  expect(
    toProcessedBundles({
      outputs: {
        "assets/vendor.abc123.js": {
          bytes: 10000,
          inputs: undefined as any,
        },
      },
      inputs: {},
    })
  ).toEqual({
    "assets/vendor.abc123.js": {
      files: {},
      totalBytes: 10000,
    },
  });
});
