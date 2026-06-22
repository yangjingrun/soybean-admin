export function setupHtmlPlugin(buildTime) {
  const plugin = {
    name: 'html-plugin',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta name="buildTime" content="${buildTime}">`);
    }
  };
  return plugin;
}
