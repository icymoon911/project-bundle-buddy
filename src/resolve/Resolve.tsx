import React, { useState, useRef, useMemo } from "react";
import { transform } from "./process";
import { ResolveProps, GraphEdges, ProcessedBundle } from "../types";
import { findTrims } from "./trim";
import { storeProcessedState, storeResolveState } from "../routes";

function toFunctionRef(func: string): ((v: string) => string) | undefined {
  try {
    // new Function() runs in its own scope, isolated from the caller's
    // local variables — safer than bare eval().
    return new Function("return (" + func + ")")() as (v: string) => string;
  } catch (e) {
    alert(`unable to compile transform due to ${e}`);
    return undefined;
  }
}

function transformGraphNames(
  nodes: GraphEdges,
  graphTransform: (v: string) => string,
  trims: string[]
): GraphEdges {
  return nodes.map((n) => {
    n.source = graphTransform(trimClean(trims, n.source));
    if (n.target != null) {
      n.target = graphTransform(trimClean(trims, n.target));
    }
    return n;
  });
}

function transformSourceMapNames(
  sourcemap: ProcessedBundle,
  sourcemapTransform: (v: string) => string,
  trims: string[]
): ProcessedBundle {
  const ret: ProcessedBundle = {
    files: {},
    totalBytes: sourcemap.totalBytes,
  };

  for (const fileName of Object.keys(sourcemap.files)) {
    ret.files[sourcemapTransform(trimClean(trims, fileName))] =
      sourcemap.files[fileName];
  }

  return ret;
}

function getGraphFiles(graphEdges: GraphEdges) {
  const ret = new Set<string>();

  for (const edge of graphEdges) {
    ret.add(edge.source);
    if (edge.target) {
      ret.add(edge.target);
    }
  }

  return Array.from(ret);
}

function trimClean(trims: string[], word: string) {
  for (const t of trims) {
    if (word.startsWith(t)) {
      return word.slice(t.length);
    }
  }
  return word;
}

function autoclean(opts: {
  processedSourceMap: ProcessedBundle;
  graphEdges: GraphEdges;
}): { sourceMapFiles: string[]; graphFiles: string[]; trims: string[] } {
  const sourceMapFiles = Object.keys(opts.processedSourceMap.files);
  const graphFiles = getGraphFiles(opts.graphEdges);
  const trims = Object.keys(findTrims(sourceMapFiles, graphFiles));

  return {
    sourceMapFiles: sourceMapFiles.map((v) => trimClean(trims, v)),
    graphFiles: graphFiles.map((v) => trimClean(trims, v)),
    trims,
  };
}

function sorted<T>(arr: Array<T>) {
  const ret = Array.from(arr);
  ret.sort();
  return ret;
}

function transformFiles<T>(
  a: Array<T>,
  b: Array<T>,
  aTransform: (v: T) => T,
  bTransform: (v: T) => T
): { files: T[]; lastError: undefined | Error } {
  let lastError: Error | undefined = undefined;
  const setA = new Set(
    a.map((v) => {
      try {
        return aTransform(v);
      } catch (e) {
        lastError = e;
        return v;
      }
    })
  );
  const setB = new Set(
    b.map((v) => {
      try {
        return bTransform(v);
      } catch (e) {
        lastError = e;
        return v;
      }
    })
  );

  const ret: Array<T> = [];
  for (const v of setA) {
    if (!setB.has(v)) {
      ret.push(v);
    }
  }

  return {
    files: ret,
    lastError,
  };
}

function formatError(e: Error) {
  return `
${e.message}
\n----------------\n
${e.stack}`;
}

export default function Resolve(props: ResolveProps) {
  const {
    processedBundle,
    graphEdges,
    sourceMapFileTransform,
    graphFileTransform,
    history,
  } = props;

  const {
    sourceMapFiles: initSourceMapFiles,
    graphFiles: initGraphFiles,
    trims,
  } = useMemo(
    () => autoclean({ processedSourceMap: processedBundle, graphEdges }),
    [processedBundle, graphEdges]
  );

  const [sourceMapFiles] = useState(initSourceMapFiles);
  const [graphFiles] = useState(initGraphFiles);
  const [transforms, setTransforms] = useState(() => ({
    sourceMapFileTransform:
      (sourceMapFileTransform && toFunctionRef(sourceMapFileTransform)) ||
      ((fileName: string) => fileName),
    graphFileTransform:
      (graphFileTransform && toFunctionRef(graphFileTransform)) ||
      ((fileName: string) => fileName),
  }));

  const sourceMapTransformRef = useRef<HTMLTextAreaElement>(null);
  const sourceGraphTransformRef = useRef<HTMLTextAreaElement>(null);

  const updateSourceMapTransform = () => {
    if (sourceMapTransformRef.current == null) return;
    const transformRef = toFunctionRef(sourceMapTransformRef.current.value);
    if (transformRef == null) return;

    const k = storeResolveState({
      graphEdges,
      processedSourceMap: processedBundle,
      graphFileTransform: transforms.graphFileTransform.toString(),
      bundledFilesTransform: transformRef.toString(),
    });

    history.replace(window.location.pathname, k);

    setTransforms({
      graphFileTransform: transforms.graphFileTransform,
      sourceMapFileTransform: transformRef,
    });
  };

  const updateGraphSourceTransform = () => {
    if (sourceGraphTransformRef.current == null) return;
    const transformRef = toFunctionRef(sourceGraphTransformRef.current.value);
    if (transformRef == null) return;

    const k = storeResolveState({
      graphEdges,
      processedSourceMap: processedBundle,
      graphFileTransform: transformRef.toString(),
      bundledFilesTransform: transforms.sourceMapFileTransform.toString(),
    });

    history.replace(window.location.pathname, k);

    setTransforms({
      graphFileTransform: transformRef,
      sourceMapFileTransform: transforms.sourceMapFileTransform,
    });
  };

  const doImport = () => {
    if (graphEdges == null || processedBundle == null) {
      throw new Error("Unable to find graph edges or sourcemap data");
    }

    const processed = transform(
      transformGraphNames(graphEdges, transforms.graphFileTransform, trims),
      transformSourceMapNames(
        processedBundle,
        transforms.sourceMapFileTransform,
        trims
      ),
      sourceMapFiles
    );

    history.push("/bundle", storeProcessedState(processed));
  };

  const sourceMapTransformed = transformFiles(
    sourceMapFiles,
    graphFiles,
    transforms.sourceMapFileTransform,
    transforms.graphFileTransform
  );

  const graphTransformed = transformFiles(
    graphFiles,
    sourceMapFiles,
    transforms.graphFileTransform,
    transforms.sourceMapFileTransform
  );

  return (
    <div className="resolve-conflicts">
      <div className="col-container">
        <div>
          <p className="ft-18">Resolve source map files:</p>
          {sourceMapTransformed.lastError != null ? (
            <div className="error">
              {formatError(sourceMapTransformed.lastError)}
            </div>
          ) : null}
          <small>
            <span
              className={`${
                sourceMapTransformed.files.length === 0 ? "primary" : ""
              }`}
            >
              {sourceMapTransformed.files.length}
            </span>{" "}
            source map files of {sourceMapFiles.length} total need resolving
          </small>
          <textarea
            ref={sourceMapTransformRef}
            className="code-editor"
            defaultValue={transforms.sourceMapFileTransform.toString()}
          />
          <br />
          <button onClick={updateSourceMapTransform}>retry transform</button>
          <ul>
            {sorted(sourceMapTransformed.files).map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="ft-18">Resolve graph source files:</p>
          {graphTransformed.lastError != null ? (
            <div className="error">
              {formatError(graphTransformed.lastError)}
            </div>
          ) : null}
          <small>
            <span
              className={`${
                graphTransformed.files.length === 0 ? "primary" : ""
              }`}
            >
              {graphTransformed.files.length}
            </span>{" "}
            graph files of {graphFiles.length} total need resolving
          </small>
          <textarea
            ref={sourceGraphTransformRef}
            className="code-editor"
            defaultValue={transforms.graphFileTransform.toString()}
          />
          <br />
          <button onClick={updateGraphSourceTransform}>Retry transform</button>
          <ul>
            {sorted(graphTransformed.files).map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="resolved">
        <div className="resolved-message">
          <button className="good" onClick={doImport}>
            Go to analysis
          </button>
        </div>
      </div>
    </div>
  );
}
