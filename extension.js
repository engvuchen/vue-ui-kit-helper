const vscode = require('vscode');
const { workspace } = vscode;

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
    '"',
    "'",
    '\n'
    // '<',
    // '',
    // '/',
    // '('
  );
  let vueLanguageConfig = vscode.languages.setLanguageConfiguration('vue', { wordPattern: app.WORD_REG });

  let docs = new AntdvDocsContentProvider();

  // 参考 antv-vue-helper
  // todo: 支持查看多个组件库文档 ？！
  // source 里面可以区分是哪个，但若是选取文本，就可能有问题了
  let registration = workspace.registerTextDocumentContentProvider('vue-ui-kit-helper', docs);
  let disposable = vscode.commands.registerCommand('vue-ui-kit-helper.search', () => {
    const selection = app.getSeletedText();
    // 这里是具体要查看哪个组件
    let items = components.map(item => {
      return {
        label: item.tag,
        detail: item.title.toLocaleLowerCase() + ' ' + item.subtitle,
        path: item.path,
        description: item.type,
      };
    });

    if (items.length < 1) {
      vscode.window.showInformationMessage('Initializing。。。, please try again.');
      return;
    }

    let find = items.filter(item => item.label === selection);

    if (find.length) {
      app.openDocs(find[0], find[0].label);
      return;
    }

    // cant set default value for this method? angry.
    vscode.window.showQuickPick(items).then(selected => {
      selected && app.openDocs(selected, selected.label);
    });
  });

  context.subscriptions.push(app, disposable, registration, completion, vueLanguageConfig);

  context.subscriptions.push(completion, vueLanguageConfig, app);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
