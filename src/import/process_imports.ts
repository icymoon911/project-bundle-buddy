import {
  calculateSourcemapFileContents,
  mergeProcessedBundles,
} from "./process_sourcemaps";
import { GraphEdges, ProcessedBundle } from "../types";
import { ReportErrorUri } from "../report_error";

/**
 * Successful result from processImports.
 */
export interface ImportProcessSuccess {
  bundleSizes: { [bundleName: string]: { totalBytes: number } };
  processedSourcemap: ProcessedBundle;
  processedGraph: GraphEdges;
}

/**
 * Failure result from processImports, carrying all collected errors.
 */
export interface ImportProcessFailure {
  sourceMapErrors: Error[];
  graphErrors: Error[];
}

/**
 * Either-style result type for processImports.
 * The caller must discriminate on `ok` before accessing data,
 * making it impossible to silently ignore errors.
 */
export type ImportProcessResult =
  | { ok: true; value: ImportProcessSuccess }
  | { ok: false; error: ImportProcessFailure };

// TODO(samccone) we will want to handle more error types.
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
}): Promise<ImportProcessResult> {
  const sourceMapErrors: Error[] = [];
  const graphErrors: Error[] = [];

  const bundleSizes: { [bundleName: string]: { totalBytes: number } } = {};

  const processed: {
    [bundleName: string]: ProcessedBundle;
  } = {};

  for (const bundleName of Object.keys(opts.sourceMapContents)) {
    try {
      processed[bundleName] = await calculateSourcemapFileContents(
        opts.sourceMapContents[bundleName]
      );
    } catch (e) {
      sourceMapErrors.push(new Error(humanizeSourceMapImportError(e)));
    }
  }

  for (const bundle of Object.keys(processed)) {
    bundleSizes[bundle] = {
      totalBytes: processed[bundle].totalBytes,
    };
  }

  const processedSourcemap = mergeProcessedBundles(processed);

  let processedGraph: GraphEdges = [];
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
    graphErrors.push(new Error(humanizeGraphProcessError(e)));
  }

  if (sourceMapErrors.length > 0 || graphErrors.length > 0) {
    return {
      ok: false,
      error: { sourceMapErrors, graphErrors },
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
  result: ImportProcessResult,
  files: { graphFile: { name: string }; sourceMapFiles: File[] }
): { importError: string | null; importErrorUri: string } {
  if (result.ok) {
    return { importError: null, importErrorUri: "" };
  }

  const { sourceMapErrors, graphErrors } = result.error;
  let importError = null;
  const reportUri = new ReportErrorUri();

  for (const err of graphErrors) {
    importError = `${files.graphFile.name} ${err}\n`;
    reportUri.addError(files.graphFile.name, err);
  }

  if (sourceMapErrors.length > 0) {
    if (importError == null) {
      importError = "";
    }

    const fileNames = files.sourceMapFiles.map((f) => f.name).join(",");
    for (const err of sourceMapErrors) {
      reportUri.addError(fileNames, err);
      importError += `${fileNames}: ${err}`;
    }
  }

  return {
    importError,
    importErrorUri: reportUri.toUri(),
  };
}
