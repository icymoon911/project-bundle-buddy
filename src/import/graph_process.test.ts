import { GraphEdges } from "../types";
import { cleanGraph } from "./graph_process";

it("strips magic prefixes", () => {
  const nodes: GraphEdges = [
    { source: "commonjs-proxy:/foo.js", target: "zap.ts" },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("foo.js");
});

it("strips common prefix", () => {
  const nodes: GraphEdges = [{ source: "wow/foo.js", target: "wow/zap.ts" }];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("foo.js");
  expect(ret[0].target).toBe("zap.ts");
});

it("strips common prefix ignoring ignored nodes", () => {
  const nodes: GraphEdges = [
    {
      source: "wow/foo.js",
      target: "wow/zap.ts",
    },
    {
      source: "fs",
      target: "wow/zap.ts",
    },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("foo.js");
  expect(ret[0].target).toBe("zap.ts");
  expect(ret[1].target).toBe("zap.ts");
});

it("strips no matching prefix but common /", () => {
  const nodes: GraphEdges = [
    {
      source: "(foo) ./wow.js",
      target: "./zap.ts",
    },
    {
      source: "./client.js",
      target: "./zap.ts",
    },
    {
      source: "./more.js",
      target: "./no.ts",
    },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("(foo) ./wow.js");
  expect(ret[2].target).toBe("no.ts");
});

it("strips Vite-style \0virtual: prefix", () => {
  const nodes: GraphEdges = [
    { source: "\0virtual:runtime", target: "src/index.ts" },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("virtual:runtime");
});

it("strips Vite-style \0plugin: prefix", () => {
  const nodes: GraphEdges = [
    { source: "\0plugin:vite:react", target: "src/App.tsx" },
    { source: "src/App.tsx", target: "src/utils.ts" },
    { source: "src/utils.ts", target: "src/constants.ts" },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("plugin:vite:react");
  expect(ret[0].target).toBe("src/App.tsx");
});

it("strips leading ../ from Vite paths", () => {
  const nodes: GraphEdges = [
    { source: "../src/main.ts", target: "../src/utils.ts" },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("main.ts");
  expect(ret[0].target).toBe("utils.ts");
});

it("strips multiple leading ../ sequences", () => {
  const nodes: GraphEdges = [
    { source: "../../src/main.ts", target: "../../src/utils.ts" },
  ];
  const ret = cleanGraph(nodes);

  expect(ret[0].source).toBe("main.ts");
  expect(ret[0].target).toBe("utils.ts");
});
