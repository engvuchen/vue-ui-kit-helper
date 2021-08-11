const vscode = require('vscode');

const { App, CustomCompletionItemProvider } = require('./app');

function activate(context) {
  let app = new App();
  app.setConfig();

  let completionItemProvider = new CustomCompletionItemProvider();
  let completion = vscode.languages.registerCompletionItemProvider(
    [
      //   {
      //     language: 'pug',
      //     scheme: 'file',
      //   },
      //   {
      //     language: 'jade',
      //     scheme: 'file',
      //   },
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
    // '',
    ' ',
    ':',
    '<',
    '"',
    "'",
    // '/',
    '@'
    // '('
  );
  // https://code.visualstudio.com/api/language-extensions/language-configuration-guide#word-pattern
  let vueLanguageConfig = vscode.languages.setLanguageConfiguration('vue', { wordPattern: app.WORD_REG });
  //   let pugLanguageConfig = vscode.languages.setLanguageConfiguration('pug', { wordPattern: app.WORD_REG });
  //   let jadeLanguageConfig = vscode.languages.setLanguageConfiguration('jade', { wordPattern: app.WORD_REG });

  context.subscriptions.push(completion, vueLanguageConfig);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
