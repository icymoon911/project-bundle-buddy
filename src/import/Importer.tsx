import React, { useState, useRef, useEffect } from "react";
import { toClipboard } from "./clipboard";
import { readFileAsText, readFilesAsText } from "./file_reader";
import { processImports, buildImportErrorReport } from "./process_imports";
import {
  ImportProps,
  ImportResolveState,
  ImportTypes,
  EsBuildMetadata,
  ProcessedBundle,
  ImportProcessError,
  ImportProcessResult,
  Either,
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

export default function Importer(props: ImportProps) {
  const { history, importType, graphFileName } = props;

  const sourceMapInputRef = useRef<HTMLInputElement & { files: FileList }>(
    null
  );
  const graphInputRef = useRef<HTMLInputElement & { files: FileList }>(null);
  const generateGraphContentsRef = useRef<HTMLSpanElement>(null);

  const [sourceMapFiles, setSourceMapFiles] = useState<File[] | undefined>();
  const [graphFile, setGraphFile] = useState<File | undefined>();
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrorUri, setImportErrorUri] = useState<string | null>(null);

  // Process files whenever both required inputs are available.
  // This replaces the old setState-callback pattern from the Class Component.
  useEffect(() => {
    const canProcess =
      importType === ImportTypes.ESBUILD
        ? graphFile != null
        : sourceMapFiles != null &&
          sourceMapFiles.length > 0 &&
          graphFile != null;

    if (!canProcess) return;

    let cancelled = false;

    (async () => {
      try {
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
            history.push(`/${importType}/resolve`, storeResolveState(state));
          }
          return;
        }

        if (graphFile == null || sourceMapFiles == null) return;

        const graphContents = await readFileAsText(graphFile);
        const sourceMapContents = await readFilesAsText(sourceMapFiles);

        let result: Either<ImportProcessError, ImportProcessResult>;
        if (
          importType === ImportTypes.WEBPACK ||
          importType === ImportTypes.CRA
        ) {
          result = await processImports({
            sourceMapContents,
            graphEdges: graphContents,
            graphPreProcessFn: (g) => cleanGraph(statsToGraph(g)),
          });
        } else {
          result = await processImports({
            sourceMapContents,
            graphEdges: graphContents,
          });
        }

        if (cancelled) return;

        if (result.ok === false) {
          const {
            importError: err,
            importErrorUri: uri,
          } = buildImportErrorReport(result.error, {
            graphFile,
            sourceMapFiles,
          });
          setImportError(err);
          setImportErrorUri(uri);
          return;
        }

        let { processedSourcemap, processedGraph } = result.value;

        if (
          (importType === ImportTypes.WEBPACK ||
            importType === ImportTypes.CRA) &&
          processedSourcemap != null
        ) {
          processedSourcemap = removeWebpackMagicFiles(processedSourcemap);
        }

        const state: ImportResolveState = {
          graphEdges: processedGraph,
          processedSourceMap: processedSourcemap,
        };

        history.push(`/${importType}/resolve`, storeResolveState(state));
      } catch (e) {
        if (!cancelled) {
          setImportError(`Unexpected error: ${e}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceMapFiles, graphFile, importType, history]);

  const onGraphInput = () => {
    if (graphInputRef.current && graphInputRef.current.files.length) {
      setGraphFile(graphInputRef.current.files[0]);
    } else {
      setGraphFile(undefined);
    }
  };

  const onSourceMapInput = () => {
    if (sourceMapInputRef.current && sourceMapInputRef.current.files.length) {
      setSourceMapFiles(Array.from(sourceMapInputRef.current.files));
    } else {
      setSourceMapFiles(undefined);
    }
  };

  const hasGraphFile =
    graphFile != null || window.location.pathname.includes("resolve");
  const hasSourceMapFile =
    (sourceMapFiles != null && sourceMapFiles.length > 0) ||
    window.location.pathname.includes("resolve");

  const disableSourceMapInput = importType === ImportTypes.ESBUILD;

  // Per-bundler instruction panels
  let graph: React.ReactNode,
    sourcemaps: React.ReactNode,
    instructions: React.ReactNode;

  if (importType === ImportTypes.WEBPACK) {
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
            onClick={() => toClipboard("webpack --profile --json > stats.json")}
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
  } else if (importType === ImportTypes.CRA) {
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
  } else if (importType === ImportTypes.ROLLUP) {
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
  } else if (importType === ImportTypes.ROME) {
    instructions = (
      <div>
        <p>
          Run the <code>bundle</code> command of rome to generate the sourcemap
          files and bundlebuddy.json for your project
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
  } else if (importType === ImportTypes.PARCEL) {
    instructions = (
      <div>
        <p>
          run <code>BUNDLE_BUDDY=true parcel build</code>&nbsp; to generate the
          sourcemap files and bundle-buddy.json file for your project
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
  } else if (importType === ImportTypes.ESBUILD) {
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
                {graphFileName}
                <input
                  id="stats"
                  type="file"
                  accept=".json"
                  ref={graphInputRef}
                  onInput={onGraphInput}
                />
              </button>
              <img
                src={hasGraphFile ? "/img/ok_icon.svg" : "/img/warn_icon.svg"}
                height="24px"
                width="24px"
                alt={hasGraphFile ? "OK import" : "missing import"}
                className="status-icon"
              />
            </div>
            {graph}
          </div>
          {disableSourceMapInput ? null : (
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
                    hasSourceMapFile ? "/img/ok_icon.svg" : "/img/warn_icon.svg"
                  }
                  height="24px"
                  width="24px"
                  alt={hasSourceMapFile ? "OK import" : "missing import"}
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
