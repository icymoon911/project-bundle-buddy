import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { toClipboard } from "./clipboard";
import { readFileAsText, readFilesAsText } from "./file_reader";
import { processImports, buildImportErrorReport } from "./process_imports";
import {
  ImportProps,
  ImportResolveState,
  ImportTypes,
  EsBuildMetadata,
  ProcessedBundle,
} from "../types";
import { storeResolveState } from "../routes";
import { toEdges, toProcessedBundles } from "./esbuild";
import { mergeProcessedBundles } from "./process_sourcemaps";
import { cleanGraph } from "./graph_process";
import { statsToGraph } from "./stats_to_graph";

const IGNORE_FILES = [
  // https://twitter.com/samccone/status/1137776153148583936
  "webpack/bootstrap",
];

function removeWebpackMagicFiles(v: ProcessedBundle) {
  const ret: ProcessedBundle = {
    totalBytes: v.totalBytes,
    files: {},
  };
  for (const k of Object.keys(v.files)) {
    let skip = false;
    for (const i of IGNORE_FILES) {
      if (k.endsWith(i)) {
        skip = true;
      }
    }
    if (!skip) {
      ret.files[k] = v.files[k];
    }
  }

  return ret;
}

function canProcess(
  sourceMapFiles: File[] | undefined,
  graphFile: File | undefined,
  importType: ImportTypes
) {
  // ESBuild does not need sourcemap files.
  if (importType === ImportTypes.ESBUILD) {
    return graphFile != null;
  }

  return (
    sourceMapFiles != null && sourceMapFiles.length > 0 && graphFile != null
  );
}

function disableSourceMapInput(importType: ImportTypes) {
  return importType === ImportTypes.ESBUILD;
}

function hasGraphFile(file?: File) {
  return file != null || window.location.pathname.includes("resolve");
}

function hasSourceMapFile(files?: File[]) {
  return (
    (files != null && files.length > 0) ||
    window.location.pathname.includes("resolve")
  );
}

function Importer(props: ImportProps) {
  const sourceMapInputRef = useRef<HTMLInputElement & { files: FileList }>(
    null
  );
  const graphInputRef = useRef<HTMLInputElement & { files: FileList }>(null);
  const generateGraphContentsRef = useRef<HTMLSpanElement>(null);

  const [sourceMapFiles, setSourceMapFiles] = useState<File[] | undefined>();
  const [graphFile, setGraphFile] = useState<File | undefined>();
  const [importError, setImportError] = useState<string | null | undefined>();
  const [importErrorUri, setImportErrorUri] = useState<
    string | null | undefined
  >();

  // Track whether we should attempt processing — set when files change
  const [shouldProcess, setShouldProcess] = useState(false);

  const onGraphInput = useCallback(() => {
    const el = graphInputRef.current;
    if (el != null && el.files.length > 0) {
      setGraphFile(el.files[0]);
      setShouldProcess(true);
    } else {
      setGraphFile(undefined);
    }
  }, []);

  const onSourceMapInput = useCallback(() => {
    const el = sourceMapInputRef.current;
    if (el != null && el.files.length > 0) {
      setSourceMapFiles(Array.from(el.files));
      setShouldProcess(true);
    } else {
      setSourceMapFiles(undefined);
    }
  }, []);

  // useEffect to process files when state changes after an input event
  useEffect(() => {
    if (!shouldProcess) return;
    if (!canProcess(sourceMapFiles, graphFile, props.importType)) return;

    // Reset the flag
    setShouldProcess(false);

    let cancelled = false;

    async function processFiles() {
      const importType = props.importType;

      if (importType === ImportTypes.ESBUILD && graphFile != null) {
        const graphContents = JSON.parse(
          await readFileAsText(graphFile)
        ) as EsBuildMetadata;

        const state: ImportResolveState = {
          graphEdges: toEdges(graphContents),
          processedSourceMap: mergeProcessedBundles(
            toProcessedBundles(graphContents)
          ),
        };

        if (!cancelled) {
          props.history.push(
            `/${importType}/resolve`,
            storeResolveState(state)
          );
        }
        return;
      }

      if (graphFile == null || sourceMapFiles == null) {
        return;
      }

      const graphContents = await readFileAsText(graphFile);
      const sourceMapContents = await readFilesAsText(sourceMapFiles);

      const result = await processImports({
        sourceMapContents,
        graphEdges: graphContents,
        graphPreProcessFn:
          importType === ImportTypes.WEBPACK || importType === ImportTypes.CRA
            ? (g) => cleanGraph(statsToGraph(g))
            : undefined,
      });

      if (cancelled) return;

      // For webpack/CRA, strip magic files from the processed sourcemap
      // before we report errors or navigate.
      if (
        result.ok &&
        (importType === ImportTypes.WEBPACK || importType === ImportTypes.CRA)
      ) {
        result.value.processedSourcemap = removeWebpackMagicFiles(
          result.value.processedSourcemap
        );
      }

      const { importError: err, importErrorUri: uri } = buildImportErrorReport(
        result,
        {
          graphFile: graphFile,
          sourceMapFiles: sourceMapFiles,
        }
      );

      setImportError(err);
      setImportErrorUri(uri);

      if (result.ok) {
        const state: ImportResolveState = {
          graphEdges: result.value.processedGraph,
          processedSourceMap: result.value.processedSourcemap,
        };

        props.history.push(`/${importType}/resolve`, storeResolveState(state));
      }
    }

    processFiles();

    return () => {
      cancelled = true;
    };
  }, [shouldProcess, sourceMapFiles, graphFile, props]);

  const type = props.importType;

  const { graph, sourcemaps, instructions } = useMemo(() => {
    let graph: React.ReactNode = null;
    let sourcemaps: React.ReactNode = null;
    let instructions: React.ReactNode = null;

    if (type === ImportTypes.WEBPACK) {
      sourcemaps = (
        <div className="right-spacing">
          <p>webpack.conf.js</p>
          <code>
            <pre>
              <span className="add-diff">devtool: "source-map"</span>
            </pre>
            <button
              onClick={() => toClipboard("devtool: 'source-map'")}
              className="copy-button"
              aria-label="Copy sourcemap snippet to clipboard"
            />
          </code>
        </div>
      );

      graph = (
        <div className="right-spacing">
          <p>via command line</p>
          <code>
            <pre>
              <span className="add-diff">
                webpack --profile --json {">"} stats.json
              </span>
            </pre>
            <button
              onClick={() =>
                toClipboard("webpack --profile --json > stats.json")
              }
              className="copy-button"
              aria-label="Copy stats.json CLI command to clipboard"
            />
          </code>
          <p>via programatic compilation </p>
          <code>
            <pre>
              {`const webpack = require("webpack");
webpack({
// Configuration Object
}, (err, stats) => {
if (err) {
console.error(err);
return;
}`}
              <span className="add-diff">
                {`
fs.writeFileSync(
path.join(__dirname, "stats.json"),
JSON.stringify(stats.toJson()),
'utf-8');
});
`}
              </span>
            </pre>
            <button
              onClick={() =>
                toClipboard(
                  `fs.writeFileSync(path.join(__dirname, "stats.json"), JSON.stringify(stats.toJson()), 'utf-8')`
                )
              }
              className="copy-button"
              aria-label="Copy stats.json programatic snippit to clipboard"
            />
          </code>
        </div>
      );
    } else if (type === ImportTypes.CRA) {
      instructions = (
        <div className="col-container">
          <div className="right-spacing">
            <p>Using yarn, in your project directory run: </p>
            <code>
              <pre>
                <span className="add-diff">
                  GENERATE_SOURCEMAP=true yarn run build -- --stats
                </span>
                <br />
              </pre>
              <button
                onClick={() => toClipboard("devtool: 'source-map'")}
                className="copy-button"
                aria-label="Copy sourcemap snippet to clipboard"
              />
            </code>
          </div>
          <div>
            {" "}
            <p>Or, using npm, in your project directory run: </p>
            <code>
              <pre>
                <span className="add-diff">
                  GENERATE_SOURCEMAP=true npm run build -- --stats
                </span>
              </pre>
              <button
                onClick={() => toClipboard("devtool: 'source-map'")}
                className="copy-button"
                aria-label="Copy sourcemap snippet to clipboard"
              />
            </code>
          </div>
        </div>
      );
    } else if (type === ImportTypes.ROLLUP) {
      graph = (
        <div>
          <p>rollup.config.js</p>
          <code>
            <pre>
              <span
                id="rollup-generate-graph"
                ref={generateGraphContentsRef}
                className="add-diff"
              >
                {`
plugins: [{
buildEnd() {
  const deps = [];
  for (const id of this.getModuleIds()) {
    const m = this.getModuleInfo(id);
    if (m != null && !m.isExternal) {
      for (const target of m.importedIds) {
        deps.push({ source: m.id, target })
      }
    }
  }

  fs.writeFileSync(
      path.join(__dirname, 'graph.json'),
      JSON.stringify(deps, null, 2));
},
}]`}
              </span>
            </pre>
            <button
              onClick={() =>
                toClipboard(generateGraphContentsRef.current!.textContent || "")
              }
              className="copy-button"
              aria-label="Copy stats.json programatic snippit to clipboard"
            />
          </code>
        </div>
      );
      sourcemaps = (
        <div>
          <p>rollup.config.js</p>
          <code>
            <pre>
              {`output: {
    file: '\`\${outFolder}/dist.js',
    format: 'iife',
    name: 'PROJECT_NAME',\n`}
              <span className="add-diff">
                &nbsp;&nbsp;&nbsp;&nbsp;sourcemap: true,
              </span>
              {`
}`}
            </pre>
            <button
              onClick={() => toClipboard("sourcemap: true,")}
              className="copy-button"
              aria-label="Copy sourcemap snippet to clipboard"
            />
          </code>
        </div>
      );
    } else if (type === ImportTypes.ROME) {
      instructions = (
        <div>
          <p>
            Run the <code>bundle</code> command of rome to generate the
            sourcemap files and bundlebuddy.json for your project
          </p>
          <code>
            <pre>rome bundle .</pre>
          </code>
          <button
            onClick={() => toClipboard("devtool: 'source-map'")}
            className="copy-button"
            aria-label="Copy sourcemap snippet to clipboard"
          />
        </div>
      );
    } else if (type === ImportTypes.PARCEL) {
      instructions = (
        <div>
          <p>
            run <code>BUNDLE_BUDDY=true parcel build</code>&nbsp; to generate
            the sourcemap files and bundle-buddy.json file for your project
          </p>
          <code>
            <pre>BUNDLE_BUDDY=true parcel build</pre>
          </code>
          <button
            onClick={() => toClipboard("BUNDLE_BUDDY=true parcel build")}
            className="copy-button"
            aria-label="Copy sourcemap snippet to clipboard"
          />
        </div>
      );
    } else if (type === ImportTypes.ESBUILD) {
      instructions = (
        <div>
          <p>
            Run the <code>--bundle</code> command of <code>esbuild</code> with{" "}
            <code>--metafile=esbuild</code> to generate the metadata file to
            understand your project.
          </p>
          <code>
            <pre>esbuild --bundle --metafile</pre>
          </code>
          <button
            onClick={() => toClipboard("esbuild --bundle --metafile")}
            className="copy-button"
            aria-label="Copy sourcemap snippet to clipboard"
          />
        </div>
      );
    }

    return { graph, sourcemaps, instructions };
  }, [type]);

  return (
    <div>
      <div>
        {importError != null ? (
          <div className="error">
            <h2>Import error</h2>
            <code>
              <pre>{`${importError}`}</pre>
            </code>
            <a
              href={importErrorUri || ""}
              target="_blank"
              rel="noopener noreferrer"
            >
              File a bug
            </a>
          </div>
        ) : null}
        <h3>Upload assets:</h3>
        <div className="upload-files-container flex">
          <div className="right-spacing">
            <div className="button-import-container">
              <button tabIndex={-1} className="import-asset">
                <img
                  height="20px"
                  width="20px"
                  className="attach-icon"
                  alt="attach file"
                  src="/img/attach_icon.svg"
                />
                {props.graphFileName}
                <input
                  id="stats"
                  type="file"
                  accept=".json"
                  ref={graphInputRef}
                  onInput={onGraphInput}
                />
              </button>
              <img
                src={
                  hasGraphFile(graphFile)
                    ? "/img/ok_icon.svg"
                    : "/img/warn_icon.svg"
                }
                height="24px"
                width="24px"
                alt={hasGraphFile(graphFile) ? "OK import" : "missing import"}
                className="status-icon"
              />
            </div>
            {graph}
          </div>
          {disableSourceMapInput(props.importType) ? null : (
            <div className="right-spacing">
              <div className="button-import-container">
                <button tabIndex={-1} className="import-asset">
                  <img
                    height="20px"
                    width="20px"
                    className="attach-icon"
                    alt="attach file"
                    src="/img/attach_icon.svg"
                  />
                  sourcemaps
                  <input
                    id="sourcemap"
                    multiple
                    type="file"
                    accept=".map,.sourcemap"
                    ref={sourceMapInputRef}
                    onInput={onSourceMapInput}
                  />
                </button>
                <img
                  src={
                    hasSourceMapFile(sourceMapFiles)
                      ? "/img/ok_icon.svg"
                      : "/img/warn_icon.svg"
                  }
                  height="24px"
                  width="24px"
                  alt={
                    hasSourceMapFile(sourceMapFiles)
                      ? "OK import"
                      : "missing import"
                  }
                  className="status-icon"
                />
              </div>
              {sourcemaps}
            </div>
          )}
        </div>

        <div className="import-instruction">{instructions}</div>
      </div>
    </div>
  );
}

export default Importer;
