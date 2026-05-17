// Heuristic auto-heal engine for Vercel deployments.
//
// proposeFix() inspects a Vercel build error and the repo's file tree, then
// returns a project-settings patch the caller can PATCH into Vercel before
// retrying the deployment. If no known fix applies, it returns null.

function paths(tree) {
  return (tree?.tree || []).map((n) => n.path);
}

function findFile(tree, name) {
  return paths(tree).find(
    (p) => p === name || p.endsWith('/' + name)
  );
}

function findAllFiles(tree, name) {
  return paths(tree).filter(
    (p) => p === name || p.endsWith('/' + name)
  );
}

function findFirstDirContaining(tree, name) {
  const match = findFile(tree, name);
  if (!match) return null;
  if (!match.includes('/')) return ''; // repo root
  return match.split('/').slice(0, -1).join('/');
}

/**
 * Pick the smallest top-level directory that contains the given file.
 * Used to choose a sensible `rootDirectory` when the entry point is buried.
 */
function findShallowestDirContaining(tree, name) {
  const candidates = findAllFiles(tree, name);
  if (candidates.length === 0) return null;
  // Prefer root, then the file with the shallowest depth.
  candidates.sort((a, b) => a.split('/').length - b.split('/').length);
  const chosen = candidates[0];
  if (!chosen.includes('/')) return '';
  return chosen.split('/').slice(0, -1).join('/');
}

function hasPackageJsonAt(tree, dir) {
  if (dir === '' || dir === '.') return paths(tree).includes('package.json');
  return paths(tree).includes(`${dir}/package.json`);
}

/**
 * Inspect the build error and the repo tree; return a project-settings patch
 * plus a human-readable explanation. Returns null if no fix applies.
 *
 * @param {object}  arg
 * @param {string}  arg.errorText  Build error / log tail from Vercel.
 * @param {object}  arg.tree       GitHub tree (from fetchRepoWithTree).
 * @param {object}  arg.project    Current Vercel project settings.
 * @param {Set<string>} arg.triedFixes  Set of "kind" identifiers already tried.
 * @returns {null | { kind: string, patch: object, message: string }}
 */
export function proposeFix({ errorText = '', tree, project = {}, triedFixes = new Set() }) {
  const err = String(errorText || '');

  // ---------------------------------------------------------------- 1 -----
  // UNRESOLVED_ENTRY / "Cannot resolve entry module index.html"
  //   → vite/static was invoked from the repo root, but index.html lives in a
  //     subfolder. Move rootDirectory there and (since the project is static)
  //     drop the build command.
  if (
    /UNRESOLVED_ENTRY|Cannot resolve entry module|Could not resolve entry/i.test(err) ||
    /index\.html/i.test(err)
  ) {
    if (tree) {
      const dir = findShallowestDirContaining(tree, 'index.html');
      if (dir !== null && dir !== (project.rootDirectory || '') && !triedFixes.has('root-index-html')) {
        const patch = { rootDirectory: dir || null };
        if (!hasPackageJsonAt(tree, dir)) {
          Object.assign(patch, {
            framework: null,
            buildCommand: '',
            installCommand: '',
            outputDirectory: '',
          });
        }
        return {
          kind: 'root-index-html',
          patch,
          message: `Build couldn't find an entry point — set Vercel rootDirectory to "${dir || '/'}" (where index.html lives)${!hasPackageJsonAt(tree, dir) ? ' and treat it as a static site' : ''}.`,
        };
      }
    } else {
      // No tree (e.g. private repo with no token). Try the common entry dirs
      // in order. Each guess uses its own `kind` so we don't loop forever.
      const guesses = ['frontend', 'client', 'app', 'web', 'src', 'public', 'site'];
      for (const dir of guesses) {
        const kind = `guess-root-${dir}`;
        if (triedFixes.has(kind) || project.rootDirectory === dir) continue;
        return {
          kind,
          patch: {
            rootDirectory: dir,
            framework: null,
            buildCommand: '',
            installCommand: '',
            outputDirectory: '',
          },
          message: `No file tree available — guessing rootDirectory="${dir}" and treating it as a static site.`,
        };
      }
    }
  }

  // ---------------------------------------------------------------- 2 -----
  // "ENOENT: package.json not found" or "No build script" when there's no
  // package.json at the chosen root.
  if (
    /ENOENT.*package\.json|No build script|missing script/i.test(err) &&
    !triedFixes.has('static-no-build')
  ) {
    const root = project.rootDirectory || '';
    if (!hasPackageJsonAt(tree, root)) {
      return {
        kind: 'static-no-build',
        patch: {
          framework: null,
          buildCommand: '',
          installCommand: '',
          outputDirectory: '',
        },
        message:
          'Repo has no package.json at the project root — switching to a no-build static deploy.',
      };
    }
  }

  // ---------------------------------------------------------------- 3 -----
  // Known framework binaries missing → set framework explicitly so Vercel
  // wires the install/build commands itself.
  const fwHints = [
    { re: /next: command not found|Cannot find module ['"]next['"]/i, fw: 'nextjs', kind: 'framework-next' },
    { re: /vite: command not found/i, fw: 'vite', kind: 'framework-vite' },
    { re: /nuxt: command not found/i, fw: 'nuxtjs', kind: 'framework-nuxt' },
    { re: /react-scripts: command not found/i, fw: 'create-react-app', kind: 'framework-cra' },
    { re: /svelte-kit: command not found/i, fw: 'sveltekit', kind: 'framework-sveltekit' },
  ];

  for (const hint of fwHints) {
    if (hint.re.test(err) && project.framework !== hint.fw && !triedFixes.has(hint.kind)) {
      return {
        kind: hint.kind,
        patch: { framework: hint.fw, buildCommand: null, installCommand: null, outputDirectory: null },
        message: `Set framework preset to ${hint.fw} so Vercel installs the required build tooling.`,
      };
    }
  }

  // ---------------------------------------------------------------- 4 -----
  // Output directory missing — common error: "No Output Directory named ..."
  const outMatch = err.match(/No Output Directory named ["']?([^"' \n]+)["']?/i);
  if (outMatch && !triedFixes.has('output-dir')) {
    const out = outMatch[1];
    return {
      kind: 'output-dir',
      patch: { outputDirectory: out },
      message: `Build produced no expected output — telling Vercel to look in "${out}".`,
    };
  }

  // ---------------------------------------------------------------- 5 -----
  // Generic "Command X build exited with 1" — same fallbacks as (1).
  if (/Command "[^"]+" exited with \d+/i.test(err)) {
    const guesses = ['frontend', 'client', 'app', 'web', 'src', 'public', 'site'];
    for (const dir of guesses) {
      const kind = `guess-root-${dir}`;
      if (triedFixes.has(kind) || project.rootDirectory === dir) continue;
      return {
        kind,
        patch: {
          rootDirectory: dir,
          framework: null,
          buildCommand: '',
          installCommand: '',
          outputDirectory: '',
        },
        message: `Build command failed at repo root — guessing rootDirectory="${dir}" as a static site.`,
      };
    }
  }

  return null;
}

/**
 * Build succeeded but the live URL returns Vercel NOT_FOUND (no servable app).
 * Uses the repo tree to pick rootDirectory / static vs framework settings.
 */
export function proposeSiteReachabilityFix({
  tree,
  project = {},
  triedFixes = new Set(),
}) {
  const currentRoot = project.rootDirectory || '';

  if (tree) {
    const indexDir = findShallowestDirContaining(tree, 'index.html');
    if (
      indexDir !== null &&
      indexDir !== currentRoot &&
      !triedFixes.has('site-root-index-html')
    ) {
      const patch = { rootDirectory: indexDir || null };
      if (!hasPackageJsonAt(tree, indexDir)) {
        Object.assign(patch, {
          framework: null,
          buildCommand: '',
          installCommand: '',
          outputDirectory: '',
        });
      }
      return {
        kind: 'site-root-index-html',
        patch,
        message: `Live URL is empty — point Vercel rootDirectory to "${indexDir || '/'}" where index.html lives.`,
      };
    }

    const pkgDir = findShallowestDirContaining(tree, 'package.json');
    if (
      pkgDir !== null &&
      pkgDir !== currentRoot &&
      !triedFixes.has('site-root-package-json')
    ) {
      return {
        kind: 'site-root-package-json',
        patch: { rootDirectory: pkgDir || null },
        message: `Live URL is empty — point Vercel rootDirectory to "${pkgDir || '/'}" where package.json lives.`,
      };
    }
  }

  const guesses = ['frontend', 'client', 'app', 'web', 'src', 'public', 'site', 'dist'];
  for (const dir of guesses) {
    const kind = `site-guess-root-${dir}`;
    if (triedFixes.has(kind) || currentRoot === dir) continue;
    if (tree) {
      const hasEntry =
        paths(tree).includes(`${dir}/index.html`) ||
        paths(tree).includes(`${dir}/package.json`);
      if (!hasEntry) continue;
    }
    return {
      kind,
      patch: {
        rootDirectory: dir,
        framework: null,
        buildCommand: '',
        installCommand: '',
        outputDirectory: '',
      },
      message: `Live URL is empty — trying rootDirectory="${dir}" as a static site.`,
    };
  }

  return null;
}
