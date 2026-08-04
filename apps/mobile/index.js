import { registerRootComponent } from "expo";
import App from "./App";

// Replaces expo/AppEntry.js's default entry, which resolves the app's root
// component via a relative `../../App` import — that assumption breaks under
// pnpm's symlinked node_modules (Metro resolves through the symlink to its real
// location deep in the pnpm store, where `../../App` doesn't exist). This entry
// point imports App directly and calls the same registerRootComponent Expo's own
// AppEntry.js would have called, so behavior is otherwise identical.
registerRootComponent(App);
