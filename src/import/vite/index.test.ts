import { toEdges, toProcessedBundles } from ".";

describe("vite toEdges", () => {
  it("handles the empty case", () => {
    expect(
      toEdges({
        outputs: {},
        inputs: {},
      })
    ).toEqual([]);
  });

  it("generates edges from inputs", () => {
    expect(
      toEdges({
        outputs: {},
        inputs: {
          "src/main.ts": {
            bytes: 100,
            imports: [{ path: "src/utils.ts" }, { path: "src/App.tsx" }],
          },
          "src/App.tsx": {
            bytes: 50,
            imports: [{ path: "src/utils.ts" }],
          },
        },
      })
    ).toEqual([
      { source: "src/main.ts", target: "src/utils.ts" },
      { source: "src/main.ts", target: "src/App.tsx" },
      { source: "src/App.tsx", target: "src/utils.ts" },
    ]);
  });

  it("strips null-byte virtual module prefixes", () => {
    expect(
      toEdges({
        outputs: {},
        inputs: {
          "\0virtual:module": {
            bytes: 10,
            imports: [{ path: "src/index.ts" }],
          },
        },
      })
    ).toEqual([{ source: "virtual:module", target: "src/index.ts" }]);
  });

  it("strips leading ../ from paths", () => {
    expect(
      toEdges({
        outputs: {},
        inputs: {
          "../src/main.ts": {
            bytes: 10,
            imports: [{ path: "../node_modules/react/index.js" }],
          },
        },
      })
    ).toEqual([
      { source: "src/main.ts", target: "node_modules/react/index.js" },
    ]);
  });

  it("strips multiple leading ../ sequences", () => {
    expect(
      toEdges({
        outputs: {},
        inputs: {
          "../../src/main.ts": {
            bytes: 10,
            imports: [{ path: "../../src/utils.ts" }],
          },
        },
      })
    ).toEqual([{ source: "src/main.ts", target: "src/utils.ts" }]);
  });
});

describe("vite toProcessedBundles", () => {
  it("handles the empty case", () => {
    expect(
      toProcessedBundles({
        outputs: {},
        inputs: {},
      })
    ).toEqual({});
  });

  it("converts outputs into processed bundles including CSS", () => {
    expect(
      toProcessedBundles({
        outputs: {
          "assets/index-abc123.js": {
            bytes: 500,
            inputs: {
              "src/main.ts": { bytesInOutput: 200 },
              "src/App.tsx": { bytesInOutput: 300 },
            },
          },
          "assets/index-abc123.css": {
            bytes: 150,
            inputs: {
              "src/styles.css": { bytesInOutput: 100 },
              "src/App.css": { bytesInOutput: 50 },
            },
          },
        },
        inputs: {},
      })
    ).toEqual({
      "assets/index-abc123.js": {
        files: {
          "src/main.ts": { totalBytes: 200 },
          "src/App.tsx": { totalBytes: 300 },
        },
        totalBytes: 500,
      },
      "assets/index-abc123.css": {
        files: {
          "src/styles.css": { totalBytes: 100 },
          "src/App.css": { totalBytes: 50 },
        },
        totalBytes: 150,
      },
    });
  });

  it("cleans vite-specific path prefixes in output input keys", () => {
    expect(
      toProcessedBundles({
        outputs: {
          "dist/bundle.js": {
            bytes: 100,
            inputs: {
              "\0virtual:runtime": { bytesInOutput: 40 },
              "../src/index.ts": { bytesInOutput: 60 },
            },
          },
        },
        inputs: {},
      })
    ).toEqual({
      "dist/bundle.js": {
        files: {
          "virtual:runtime": { totalBytes: 40 },
          "src/index.ts": { totalBytes: 60 },
        },
        totalBytes: 100,
      },
    });
  });
});
