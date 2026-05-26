/**
 * Babel plugin that replaces `import.meta.env.X` with values from process.env
 * so Jest (CommonJS) can run Vite source files without modification.
 */
module.exports = function transformImportMeta() {
  return {
    visitor: {
      MetaProperty(path) {
        if (
          path.node.meta.name === 'import' &&
          path.node.property.name === 'meta'
        ) {
          path.replaceWithSourceString(
            `({
              env: {
                VITE_API_HOSTNAME: (typeof process !== 'undefined' && process.env.VITE_API_HOSTNAME) || 'http://localhost:3001',
                VITE_GOOGLE_CLIENT_ID: (typeof process !== 'undefined' && process.env.VITE_GOOGLE_CLIENT_ID) || 'test-google-client-id'
              }
            })`,
          );
        }
      },
    },
  };
};
