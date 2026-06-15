/**
 * Splits the folder path by semantically scoped package path.
 *
 * For example
 * node_modules/@foo/zap becomes ["node_modules", "@foo/zap"]
 *
 * vs:
 * node_modules/foo/zap becomes ["node_modules", "foo", "zap"]
 *
 * @param path file path to split
 */
export function splitBySemanticModulePath(path: string): string[] {
  let folderSplit = path.split("/");

  const ret: string[] = [];
  let scopedPackage = "";
  let lastNodeModules = false;

  for (const p of folderSplit) {
    if (p === "node_modules") {
      // Flush any pending scoped package (e.g. "@scope" without a package name
      // following it) before entering the next node_modules segment. This
      // prevents scopedPackage from being silently overwritten when consecutive
      // nested node_modules contain scoped packages.
      if (scopedPackage.length) {
        ret.push(scopedPackage);
        scopedPackage = "";
      }
      lastNodeModules = true;
      ret.push(p);
      continue;
    }

    if (lastNodeModules && p[0] === "@") {
      scopedPackage = p;
      lastNodeModules = false;
      continue;
    }

    lastNodeModules = false;

    if (scopedPackage.length) {
      ret.push(`${scopedPackage}/${p}`);
      scopedPackage = "";
      continue;
    }

    ret.push(p);
  }

  // Flush any remaining scoped package at the end of the path
  if (scopedPackage.length) {
    ret.push(scopedPackage);
  }

  return ret;
}

/**
 * Given a list of files find duplicate node modules and the dependencies that
 * brought them into the project.
 * @param sourceMapFiles a list of files in the project
 */
export function findDuplicateModules(
  sourceMapFiles: string[]
): Array<{
  key: string;
  value: string[];
}> {
  const ret: Array<{
    key: string;
    value: string[];
  }> = [];
  const containsNodeModules = sourceMapFiles.filter(
    (v) => v.indexOf("node_modules") > -1
  );
  const explodedPaths = containsNodeModules
    .map((v) => splitBySemanticModulePath(v))
    .map((splitPath) => {
      return {
        nodeModulePreamables: splitPath
          .map((v, i) => {
            if (v === "node_modules") {
              return [splitPath[i + 1], splitPath[i - 1]];
            }

            return undefined;
          })
          .filter((v) => v != null),
      };
    })
    .sort(
      (a, b) => a.nodeModulePreamables.length - b.nodeModulePreamables.length
    );

  const dupes: { [module: string]: { imports: Set<string> } } = {};

  const seen = new Set<string>();
  for (const d of explodedPaths as any) {
    const module = d.nodeModulePreamables[d.nodeModulePreamables.length - 1][0];
    const from = d.nodeModulePreamables[d.nodeModulePreamables.length - 1][1];

    if (d.nodeModulePreamables.length === 1) {
      dupes[module] = { imports: new Set<string>(["<PROJECT ROOT>"]) };
      seen.add(module);
    } else {
      if (seen.has(module)) {
        if (dupes[module] == null) {
          dupes[module] = { imports: new Set<string>([]) };
        }

        dupes[module].imports.add(from);
      } else {
        seen.add(module);
        // Record the first occurrence's `from` so it is not lost when a
        // duplicate is later found at a different nesting depth.
        dupes[module] = { imports: new Set<string>([from]) };
      }
    }
  }

  for (const key of Object.keys(dupes)) {
    if (dupes[key].imports?.size > 1) {
      ret.push({
        key,
        value: Array.from(dupes[key].imports),
      });
    }
  }

  return ret;
}
