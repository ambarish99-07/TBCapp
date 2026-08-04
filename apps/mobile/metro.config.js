const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// pnpm workspaces hoist/symlink node_modules differently from npm/yarn — Metro's
// default resolver can't walk through those symlinks to find workspace packages
// (@tbc/pricing, @tbc/shared-types) or even the project's own App.tsx via
// expo/AppEntry.js's relative import. This is the standard pnpm+Expo/Metro fix.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
