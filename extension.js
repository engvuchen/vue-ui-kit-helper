const vscode = require('vscode');

const { App, CustomCompletionItemProvider } = require('./app');

function activate(context) {
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
    '', // value 联想
    ' ',
    ':',
    '<',
    '"',
    "'",
    // '/',
    '@'
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
