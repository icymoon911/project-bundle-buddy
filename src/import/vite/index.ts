import {
  ViteMetadata,
  GraphEdges,
  ProcessedBundle,
  BundledFiles,
} from "../../types";

/**
 * Given a Vite bundle metadata file, convert it into dependency edges.
 * Each entry in `inputs` lists the source files it imports.
 * @param metadata Vite bundle metadata (rollup-style + vite metadata).
 */
export function toEdges(metadata: ViteMetadata): GraphEdges {
  const ret: GraphEdges = [];

  for (const [file, val] of Object.entries(metadata.inputs)) {
    if (val.imports == null) {
      continue;
    }
    for (const { path } of val.imports) {
      ret.push({
        source: file,
        target: path,
      });
    }
  }

  return ret;
}

/**
 * Given a Vite bundle metadata file, convert it into a list of processed
 * bundles. Each entry in `outputs` represents a chunk (js or css) with the
 * source files that contributed to it.
 * @param metadata Vite bundle metadata.
 */
export function toProcessedBundles(
  metadata: ViteMetadata
): { [bundleName: string]: ProcessedBundle } {
  const ret: { [bundleName: string]: ProcessedBundle } = {};

  for (const [bundleName, stats] of Object.entries(metadata.outputs)) {
    const files: BundledFiles = {};

    if (stats.inputs != null) {
      for (const [fileName, fileStats] of Object.entries(stats.inputs)) {
        files[fileName] = {
          totalBytes: fileStats.bytesInOutput,
        };
      }
    }

    ret[bundleName] = {
      totalBytes: stats.bytes,
      files,
    };
  }

  return ret;
}
