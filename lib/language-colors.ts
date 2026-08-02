/**
 * GitHub's canonical per-language colors (from linguist).
 *
 * This is the app's entire color system: the UI chrome is neutral, and every saturated
 * pixel comes from these values, driven by real repo data. Kept as a local map rather
 * than a dependency — it is static reference data, not behaviour.
 *
 * Languages outside this list fall back to a neutral so unknown data reads as "no
 * language" rather than as an arbitrary color.
 */
const LANGUAGE_COLORS: Record<string, string> = {
  "1C Enterprise": "#814CCC",
  Assembly: "#6E4C13",
  Astro: "#ff5a03",
  Batchfile: "#C1F12E",
  C: "#555555",
  "C#": "#178600",
  "C++": "#f34b7d",
  CMake: "#DA3434",
  CSS: "#563d7c",
  Clojure: "#db5855",
  CoffeeScript: "#244776",
  Crystal: "#000100",
  Dart: "#00B4AB",
  Dockerfile: "#384d54",
  Elixir: "#6e4a7e",
  Elm: "#60B5CC",
  "Emacs Lisp": "#c065db",
  Erlang: "#B83998",
  "F#": "#b845fc",
  Fortran: "#4d41b1",
  Go: "#00ADD8",
  Groovy: "#4298b8",
  HCL: "#844FBA",
  HTML: "#e34c26",
  Haskell: "#5e5086",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  "Jupyter Notebook": "#DA5B0B",
  Kotlin: "#A97BFF",
  Lua: "#000080",
  Makefile: "#427819",
  Markdown: "#083fa1",
  Nim: "#ffc200",
  Nix: "#7e7eff",
  "Objective-C": "#438eff",
  OCaml: "#ef7a08",
  PHP: "#4F5D95",
  Perl: "#0298c3",
  PowerShell: "#012456",
  Python: "#3572A5",
  R: "#198CE7",
  Roff: "#ecdebe",
  Ruby: "#701516",
  Rust: "#dea584",
  SCSS: "#c6538c",
  Scala: "#c22d40",
  Shell: "#89e051",
  Solidity: "#AA6746",
  Svelte: "#ff3e00",
  Swift: "#F05138",
  TeX: "#3D6117",
  TypeScript: "#3178c6",
  "Vim Script": "#199f4b",
  Vue: "#41b883",
  Zig: "#ec915c",
};

/** Neutral used when a repo has no language, or one we have no color for. */
export const UNKNOWN_LANGUAGE_COLOR = "#8B96A2";

export function languageColor(language: string | null): string {
  if (!language) return UNKNOWN_LANGUAGE_COLOR;
  return LANGUAGE_COLORS[language] ?? UNKNOWN_LANGUAGE_COLOR;
}
