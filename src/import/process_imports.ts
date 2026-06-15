import {
  calculateSourcemapFileContents,
  mergeProcessedBundles,
} from "./process_sourcemaps";
import {
  GraphEdges,
  ProcessedBundle,
  ImportProcessResult,
  ImportProcessError,
  Either,
  BundledFile,
} from "../types";
import { ReportErrorUri } from "../report_error";

function humanizeSourceMapImportError(e: Error) {
  return `importing source map: \n${e.toString()}`;
}

function humanizeGraphProcessError(e: Error) {
  return `importing graph contents: \n${e.toString()}`;
}

export async function processImports(opts: {
  sourceMapContents: { [filename: string]: string };
  graphEdges: GraphEdges | string;
  graphPreProcessFn?: (contents: any) => GraphEdges;
}): Promise<Either<ImportProcessError, ImportProcessResult>> {
  const bundleSizes: { [bundleName: string]: BundledFile } = {};
  const processed: { [bundleName: string]: ProcessedBundle } = {};

  for (const bundleName of Object.keys(opts.sourceMapContents)) {
    try {
      processed[bundleName] = await calculateSourcemapFileContents(
        opts.sourceMapContents[bundleName]
      );
    } catch (e) {
      return {
        ok: false,
        error: {
          stage: "sourcemap",
          error: new Error(humanizeSourceMapImportError(e)),
        },
      };
    }
  }

  for (const bundle of Object.keys(processed)) {
    bundleSizes[bundle] = {
      totalBytes: processed[bundle].totalBytes,
    };
  }

  const processedSourcemap = mergeProcessedBundles(processed);

  let processedGraph: GraphEdges;
  try {
    if (typeof opts.graphEdges === "string") {
      let parsedNodes = JSON.parse(opts.graphEdges);

      if (opts.graphPreProcessFn != null) {
        parsedNodes = opts.graphPreProcessFn(parsedNodes);
      }

      processedGraph = parsedNodes as GraphEdges;
    } else {
      processedGraph = opts.graphEdges;
    }
  } catch (e) {
    return {
      ok: false,
      error: {
        stage: "graph",
        error: new Error(humanizeGraphProcessError(e)),
      },
    };
  }

  return {
    ok: true,
    value: {
      bundleSizes,
      processedSourcemap,
      processedGraph,
    },
  };
}

export function buildImportErrorReport(
  err: ImportProcessError,
  files: { graphFile: { name: string }; sourceMapFiles: File[] }
) {
  let importError = null;
  const reportUri = new ReportErrorUri();

  if (err.stage === "graph") {
    importError = `${files.graphFile.name} ${err.error}\n`;
    reportUri.addError(files.graphFile.name, err.error);
  } else if (err.stage === "sourcemap") {
    const sourceMapFileNames = files.sourceMapFiles.map((f) => f.name);
    reportUri.addError(sourceMapFileNames.join(","), err.error);
    importError = `${sourceMapFileNames.join(",")}: ${err.error}`;
  }

  return {
    importError,
    importErrorUri: reportUri.toUri(),
  };
}
