import {
  ViteMetadata,
  GraphEdges,
  ProcessedBundle,
  BundledFiles,
} from "../../types";

/**
 * Strip Vite-specific path prefixes (virtual module markers and
 * relative path prefixes) so file paths line up between the graph
 * and the bundle analysis.
 */
function cleanVitePath(path: string): string {
  // Strip null-byte virtual module prefixes (rollup convention used by Vite).
  // Only strip the \0 byte itself; the remaining label (e.g. "virtual:foo")
  // is preserved as a meaningful identifier.
  if (path.startsWith("\0")) {
    path = path.slice(1);
  }
  // Strip commonjs proxy/external prefixes that Vite may inherit from rollup.
  const commonjsPrefixes = [
    "\0commonjs-proxy:",
    "\0commonjs-external:",
    "commonjs-proxy:/",
  ];
  for (const prefix of commonjsPrefixes) {
    if (path.startsWith(prefix) && path.length !== prefix.length) {
      path = path.slice(prefix.length);
    }
  }
  // Strip leading ../ sequences that Vite sometimes emits.
  while (path.startsWith("../")) {
    path = path.slice(3);
  }
  // Strip a single leading ./ for consistency.
  if (path.startsWith("./")) {
    path = path.slice(2);
  }
  return path;
}

/**
 * Convert Vite metadata into import-graph edges.
 * Each input's `imports` array becomes an edge from the input file to
 * the imported file.
 */
export function toEdges(metadata: ViteMetadata): GraphEdges {
  const ret: GraphEdges = [];

  for (const [file, val] of Object.entries(metadata.inputs)) {
    for (const { path } of val.imports) {
      ret.push({
        source: cleanVitePath(file),
        target: cleanVitePath(path),
      });
    }
  }

  return ret;
}

/**
 * Convert Vite metadata into processed bundles (one per output chunk).
 * Both JS and CSS outputs are included so the bundle analysis can
 * report on all file types produced by the Vite build.
 */
export function toProcessedBundles(
  metadata: ViteMetadata
): { [bundleName: string]: ProcessedBundle } {
  const ret: { [bundleName: string]: ProcessedBundle } = {};

  for (const [bundleName, stats] of Object.entries(metadata.outputs)) {
    const files: BundledFiles = {};

    for (const [fileName, fileStats] of Object.entries(stats.inputs)) {
      files[cleanVitePath(fileName)] = {
        totalBytes: fileStats.bytesInOutput,
      };
    }

    ret[bundleName] = {
      totalBytes: stats.bytes,
      files,
    };
  }

  return ret;
}
