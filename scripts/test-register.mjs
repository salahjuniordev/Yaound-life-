import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
      const hasExtension = /\.[cm]?[jt]sx?$/.test(specifier);
      if (isRelative && !hasExtension) {
        for (const ext of ['.ts', '.tsx', '.mts', '.js', '.mjs']) {
          try {
            return nextResolve(specifier + ext, context);
          } catch {
            // try next extension
          }
        }
      }
      throw err;
    }
  },
});
