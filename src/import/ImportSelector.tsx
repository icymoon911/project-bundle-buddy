import * as pako from "pako";
import React, { useRef, useCallback } from "react";
import { readFileAsBinary } from "./file_reader";
import { NavLink as Link } from "react-router-dom";
import { ImportHistory } from "../types";
import { storeProcessedState } from "../routes";

interface ToolButton {
  to: string;
  label: string;
  ariaLabel: string;
  buttonClass?: string;
  img?: {
    src: string;
    alt: string;
    width: string;
    height: string;
    className: string;
  };
}

const TOOL_BUTTONS: ToolButton[] = [
  {
    to: "/webpack",
    label: "Webpack",
    ariaLabel: "webpack project import",
    img: {
      src: "/img/webpack_logo.png",
      alt: "webpack logo",
      width: "35px",
      height: "36px",
      className: "rollup-logo",
    },
  },
  {
    to: "/create-react-app",
    label: "Create React App",
    ariaLabel: "create-react-app project import",
    img: {
      src: "/img/webpack_logo.png",
      alt: "create react app logo",
      width: "35px",
      height: "36px",
      className: "rollup-logo",
    },
  },
  {
    to: "/rollup",
    label: "Rollup",
    ariaLabel: "rollup project import",
    img: {
      src: "/img/rollup_logo.png",
      alt: "rollup logo",
      width: "34px",
      height: "36px",
      className: "rollup-logo",
    },
  },
  {
    to: "/rome",
    label: "Rome",
    ariaLabel: "rome project import",
    buttonClass: "rome-import",
    img: {
      src: "/img/rome_logo.png",
      alt: "rome logo",
      width: "31px",
      height: "36px",
      className: "rome-logo",
    },
  },
  {
    to: "/parcel",
    label: "Parcel",
    ariaLabel: "parcel project import",
    buttonClass: "parcel-import",
    img: {
      src: "/img/parcel_logo.png",
      alt: "parcel logo",
      width: "35px",
      height: "26px",
      className: "parcel-logo",
    },
  },
  {
    to: "/esbuild",
    label: "ESBuild",
    ariaLabel: "esbuild project import",
    buttonClass: "esbuild-import",
  },
];

function ImportSelector({ history }: { history: ImportHistory }) {
  const existingImportInput = useRef<HTMLInputElement & { files: FileList }>(
    null
  );

  const onExistingImportInput = useCallback(async () => {
    const file = existingImportInput.current?.files[0];
    if (file == null) {
      return;
    }

    const contents = await readFileAsBinary(file);
    const inflated = pako.inflate(contents);
    const previousState = JSON.parse(new TextDecoder().decode(inflated));
    history.push("/bundle", storeProcessedState(previousState));
  }, [history]);

  return (
    <div>
      <div className="flex">
        <div style={{ flexGrow: 1, display: "flex", flexWrap: "wrap" }}>
          {TOOL_BUTTONS.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              aria-label={tool.ariaLabel}
              className="no-link-underline "
            >
              <button
                aria-hidden
                tabIndex={-1}
                className={`type-button project-import${
                  tool.buttonClass ? " " + tool.buttonClass : ""
                }`}
              >
                {tool.img && (
                  <img
                    width={tool.img.width}
                    height={tool.img.height}
                    className={tool.img.className}
                    alt={tool.img.alt}
                    src={tool.img.src}
                  />
                )}
                <span>{tool.label}</span>
              </button>
            </Link>
          ))}
        </div>

        <button tabIndex={-1}>
          <span className="ft-24">Or</span>
          <br />
          <br />
          Import an existing project
          <input
            type="file"
            ref={existingImportInput}
            accept=".json"
            onInput={onExistingImportInput}
          />
        </button>
      </div>
    </div>
  );
}

export default ImportSelector;
