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

it("strips vite virtual module prefix (\0vite/)", () => {
  const nodes: GraphEdges = [
    { source: "src/app.tsx", target: "src/util.ts" },
    { source: "\u0000vite/client", target: "src/app.tsx" },
  ];
  const ret = cleanGraph(nodes);

  // The virtual module \u0000vite/client should have the \u0000vite/
  // prefix stripped, so its source should NOT still contain "vite/".
  const viteEdge = ret.find((e) => e.target.indexOf("app") !== -1);
  expect(viteEdge).toBeDefined();
  expect(viteEdge!.source.indexOf("vite/")).toBe(-1);
});

it("strips leading relative path segments (../) produced by vite", () => {
  const nodes: GraphEdges = [
    { source: "../../src/app.tsx", target: "../../src/util.ts" },
    { source: "../../src/util.ts", target: "../../lib/helper.ts" },
  ];
  const ret = cleanGraph(nodes);

  // After stripping ../ and the common prefix, paths should be clean.
  const appEdge = ret.find((e) => e.source === "app.tsx");
  expect(appEdge).toBeDefined();
  expect(appEdge!.target).toBe("util.ts");
});

it("strips vite virtual module prefix (\0) from plugin modules", () => {
  const nodes: GraphEdges = [
    { source: "src/App.vue", target: "src/child.vue" },
    { source: "src/child.vue", target: "\u0000plugin-vue:export-helper" },
  ];
  const ret = cleanGraph(nodes);

  const helperEdge = ret.find((e) => e.target === "plugin-vue:export-helper");
  expect(helperEdge).toBeDefined();
});
