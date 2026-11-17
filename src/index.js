// Public entry point for http-forwarded-header-parse-kit.
// Re-exporting from core keeps the import surface stable even if the
// implementation is split across more files later.
export { parseForwarded, parseForwardedHeader, ForwardedHop } from './core.js';
