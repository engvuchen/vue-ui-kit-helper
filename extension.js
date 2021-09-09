const vscode = require('vscode');

const { App, CustomCompletionItemProvider } = require('./app');

function activate(context) {
  console.log('vue-ui-kit-helper activate');

  let app = new App();
  app.setConfig();

  let completionItemProvider = new CustomCompletionItemProvider();
  let completion = vscode.languages.registerCompletionItemProvider(
    [
      {
        language: 'vue',
        scheme: 'file',
      },
      {
        language: 'html',
        scheme: 'file',
      },
    ],
    completionItemProvider,
    ' ',
    ':',
    '@',
    '<',
    '"',
    "'",
    '\n'
    // '',
    // '/',
    // '('
  );
  let vueLanguageConfig = vscode.languages.setLanguageConfiguration('vue', { wordPattern: app.WORD_REG });

  context.subscriptions.push(completion, vueLanguageConfig);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
