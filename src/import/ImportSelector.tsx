import * as pako from "pako";
import React, { useRef } from "react";
import { readFileAsBinary } from "./file_reader";
import { NavLink as Link } from "react-router-dom";
import { ImportHistory } from "../types";
import { storeProcessedState } from "../routes";

interface BuildToolConfig {
  to: string;
  ariaLabel: string;
  buttonClassName: string;
  label: string;
  imgSrc?: string;
  imgAlt?: string;
  imgWidth: string;
  imgHeight: string;
  imgClassName: string;
}

const BUILD_TOOLS: BuildToolConfig[] = [
  {
    to: "/webpack",
    ariaLabel: "webpack project import",
    buttonClassName: "type-button project-import",
    label: "Webpack",
    imgSrc: "/img/webpack_logo.png",
    imgAlt: "webpack logo",
    imgWidth: "35px",
    imgHeight: "36px",
    imgClassName: "rollup-logo",
  },
  {
    to: "/create-react-app",
    ariaLabel: "create-react-app project import",
    buttonClassName: "type-button project-import",
    label: "Create React App",
    imgSrc: "/img/webpack_logo.png",
    imgAlt: "create react app logo",
    imgWidth: "35px",
    imgHeight: "36px",
    imgClassName: "rollup-logo",
  },
  {
    to: "/rollup",
    ariaLabel: "rollup project import",
    buttonClassName: "type-button project-import",
    label: "Rollup",
    imgSrc: "/img/rollup_logo.png",
    imgAlt: "rollup logo",
    imgWidth: "34px",
    imgHeight: "36px",
    imgClassName: "rollup-logo",
  },
  {
    to: "/rome",
    ariaLabel: "rome project import",
    buttonClassName: "type-button project-import rome-import",
    label: "Rome",
    imgSrc: "/img/rome_logo.png",
    imgAlt: "rome logo",
    imgWidth: "31px",
    imgHeight: "36px",
    imgClassName: "rome-logo",
  },
  {
    to: "/parcel",
    ariaLabel: "parcel project import",
    buttonClassName: "type-button project-import parcel-import",
    label: "Parcel",
    imgSrc: "/img/parcel_logo.png",
    imgAlt: "parcel logo",
    imgWidth: "35px",
    imgHeight: "26px",
    imgClassName: "parcel-logo",
  },
  {
    to: "/esbuild",
    ariaLabel: "esbuild project import",
    buttonClassName: "type-button project-import esbuild-import",
    label: "ESBuild",
    imgWidth: "35px",
    imgHeight: "36px",
    imgClassName: "",
  },
];

export default function ImportSelector({
  history,
}: {
  history: ImportHistory;
}) {
  const existingImportInputRef = useRef<HTMLInputElement & { files: FileList }>(
    null
  );

  const onExistingImportInput = async () => {
    const file = existingImportInputRef.current?.files[0];
    if (file == null) return;

    const contents = await readFileAsBinary(file);
    const inflated = pako.inflate(contents);
    const previousState = JSON.parse(new TextDecoder().decode(inflated));
    history.push("/bundle", storeProcessedState(previousState));
  };

  return (
    <div>
      <div className="flex">
        <div style={{ flexGrow: 1, display: "flex", flexWrap: "wrap" }}>
          {BUILD_TOOLS.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              aria-label={tool.ariaLabel}
              className="no-link-underline "
            >
              <button
                aria-hidden
                tabIndex={-1}
                className={tool.buttonClassName}
              >
                {tool.imgSrc && (
                  <img
                    width={tool.imgWidth}
                    height={tool.imgHeight}
                    alt={tool.imgAlt || tool.label}
                    src={tool.imgSrc}
                    className={tool.imgClassName}
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
            ref={existingImportInputRef}
            accept=".json"
            onInput={onExistingImportInput}
          />
        </button>
      </div>
    </div>
  );
}
