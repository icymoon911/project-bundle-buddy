import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import React, { Suspense, lazy } from "react";
import Header from "./Header";
import TestProcess from "./TestProcess";
import ErrorBoundry from "./ErrorBoundry";
import { Location } from "history";
import { History } from "history";
import {
  ImportResolveState,
  ProcessedImportState,
  ImportHistory,
} from "./types";
import { stateFromProcessedKey, stateFromResolveKey } from "./routes";

const Bundle = lazy(() => import("./bundle/Bundle"));
const Home = lazy(() => import("./home/Home"));

export default function App() {
  return (
    <Router>
      <ErrorBoundry>
        <div className="App">
          <div className="Page">
            <Suspense fallback={<div>Loading...</div>}>
              <Switch>
                <Route
                  path="/bundle"
                  component={({
                    location,
                    history,
                  }: {
                    location: Location<ProcessedImportState>;
                    history: History;
                  }) => {
                    const state = stateFromProcessedKey(
                      ((location.state as any) || { key: "" }).key
                    );
                    if (state == null) {
                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "80vh",
                            textAlign: "center",
                            padding: "2rem",
                          }}
                        >
                          <h2>Session Expired</h2>
                          <p
                            style={{
                              maxWidth: "480px",
                              marginBottom: "1.5rem",
                            }}
                          >
                            Your analysis session is no longer available. This
                            can happen when the page is refreshed or the browser
                            tab was reopened. Please re-import your bundle files
                            to start a new analysis.
                          </p>
                          <button
                            onClick={() => history.push("/")}
                            style={{
                              padding: "0.75rem 1.5rem",
                              fontSize: "1rem",
                              cursor: "pointer",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              background: "#fff",
                            }}
                          >
                            Back to Home
                          </button>
                        </div>
                      );
                    }

                    let params = new URLSearchParams(location.search);
                    return (
                      <div>
                        <Header />
                        <Bundle
                          trimmedNetwork={state.trimmedNetwork}
                          rollups={state.rollups}
                          duplicateNodeModules={state.duplicateNodeModules}
                          selected={params.get("selected")}
                          hierarchy={state.hierarchy}
                        />
                      </div>
                    );
                  }}
                />

                {/* TODO remove this test route */}
                <Route
                  path="/testProcess"
                  component={({
                    location,
                  }: {
                    location: Location<ProcessedImportState>;
                  }) => {
                    return <TestProcess />;
                  }}
                />

                <Route
                  path="/"
                  component={(h: {
                    location: Location<ImportResolveState>;
                    history: ImportHistory;
                  }) => {
                    const state = stateFromResolveKey(
                      ((h.location.state as any) || { key: "" }).key
                    );

                    return (
                      <Home
                        history={h.history}
                        graphEdges={state?.graphEdges!}
                        processedSourceMap={state?.processedSourceMap!}
                        bundledFilesTransform={state?.bundledFilesTransform}
                        graphFileTransform={state?.graphFileTransform}
                      />
                    );
                  }}
                />
              </Switch>
            </Suspense>
          </div>
        </div>
      </ErrorBoundry>
    </Router>
  );
}
