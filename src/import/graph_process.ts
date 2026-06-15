import builtins from "./builtins";
import { findFirstIndex, findCommonPrefix } from "../import/prefix_cleaner";
import { GraphEdges } from "../types";

const prefixStrips = [
  // Rollup specific prefix added to add commonjs proxy nodes.
  "\u0000commonjs-proxy:",
  "commonjs-proxy:/",
  // Rollup specific prefix added to add commonjs external nodes.
  "\u0000commonjs-external:",
  // Vite internal virtual modules (e.g. \0vite/modulepreload-polyfill).
  "\u0000vite/",
  // More rollup magic prefixing (also used by Vite for virtual modules
  // such as \0plugin-vue:export-helper).
  "\u0000",
];

const ignoreNodes = new Set(
  [
    // Rollup specific magic module.
    "\u0000commonjsHelpers",
    "commonjsHelpers",
    "babelHelpers",
  ].concat(builtins)
);

function removedIgnoredFiles(nodes: string[]) {
  return nodes.filter((v) => !ignoreNodes.has(v));
}

function getAllGraphFiles(graph: GraphEdges): string[] {
  const ret = new Set<string>();
  for (const { target, source } of graph) {
    if (target != null) {
      ret.add(target);
    }
    ret.add(source);
  }

  return Array.from(ret);
}

/**
 * Strip leading relative path segments (../) that Vite and other tools
 * sometimes emit in their output paths. For example
 * ../../src/main.ts becomes src/main.ts.
 */
function stripRelativePrefix(path: string): string {
  while (path.startsWith("../")) {
    path = path.slice(3);
  }
  return path;
}

export function cleanGraph(graph: GraphEdges): GraphEdges {
  // Strip all magic prefixes
  for (const node of graph) {
    for (const key of Object.keys(node) as Array<"target" | "source">) {
      if (node[key] == null) {
        continue;
      }

      for (const magicPrefix of prefixStrips) {
        if (node[key]!.startsWith(magicPrefix)) {
          if (node[key]!.length !== magicPrefix.length) {
            node[key] = node[key]!.slice(magicPrefix.length);
          }
        }
      }

      // Strip leading ../ segments commonly produced by Vite.
      node[key] = stripRelativePrefix(node[key]!);
    }
  }

  // Strip common prefixes
  const graphFiles = removedIgnoredFiles(getAllGraphFiles(graph));
  const prefix = findCommonPrefix(removedIgnoredFiles(graphFiles)) || "";

  if (prefix.length) {
    for (const node of graph) {
      for (const key of Object.keys(node) as Array<"target" | "source">) {
        if (node[key] != null) {
          if (node[key]!.startsWith(prefix)) {
            node[key] = node[key]!.slice(prefix.length);
          }
        }
      }
    }
  } else {
    // fallback to Strip up to first /
    const firstIndex = findFirstIndex(removedIgnoredFiles(graphFiles));
    if (firstIndex > 0) {
      for (const node of graph) {
        for (const key of Object.keys(node) as Array<"target" | "source">) {
          if (node[key] != null) {
            if (node[key]![firstIndex] === "/") {
              node[key] = node[key]!.slice(firstIndex + 1);
            }
          }
        }
      }
    }
  }

  // Remove null nodes in graph
  const ret: GraphEdges = [];
  for (const node of graph) {
    if (
      node.target !== node.source &&
      node.target !== null &&
      node.source !== null
    ) {
      ret.push(node);
    }
  }

  return ret;
}
