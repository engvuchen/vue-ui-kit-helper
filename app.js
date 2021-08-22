const vscode = require('vscode');
const {
  window,
  commands,
  ViewColumn,
  Disposable,
  Event,
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
  EventEmitter,
  workspace,
  CompletionItemProvider,
  ProviderResult,
  TextDocument,
  Position,
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  SnippetString,
  Range,
} = vscode;

// const kebabCaseTAGS = require('element-helper-json-new/element-tags.json');
// const kebabCaseATTRS = require('element-helper-json-new/element-attributes.json');

const fs = require('fs');
const path = require('path');

const tagNameReg = /(?<= ).+/;
const attrAndValueReg = /\s*([\:@]\w+)="(.+)"/;
const attrValueReg = /(?<= )(.+)/;
const snippetEnumReg = /\$\{\d+|.*|\}/;
const snippetValueReg = /\$\{\d:(.+)\}/;
const commentReg = /(?<=\/\/ ).+/;

const allSnippetsCon = {};
main();

async function main() {
  const config = workspace.getConfiguration('vue-ui-kit-helper');
  let sources = config.get('sources');
  if (sources && sources.length) {
    let allSnippets = await getProjectSnippets(sources);

    Object.keys(allSnippets).forEach(snippetKey => {
      let [tagName] = tagNameReg.exec(snippetKey) || [];
      console.log('tagName', tagName);
      if (tagName) {
        allSnippetsCon[tagName] = handleSnippetBody(tagName, allSnippets[snippetKey].body);
      }
    });
  } else {
    console.error('Please give a sources settings, see');
  }
}
async function getProjectSnippets(sources = []) {
  let [folder] = workspace.workspaceFolders;
  if (folder) {
    let { fsPath } = folder.uri;
    let queen = sources.map(name => {
      return canAccessFile(path.resolve(`${fsPath}/.vscode/${name}.code-snippets`));
    });

    let allSnippets = {};
    await Promise.allSettled(queen).then(resList => {
      let accessFileList = resList.filter(curItem => curItem.status === 'fulfilled').map(curItem => curItem.value);
      accessFileList.forEach(filePath => {
        try {
          Object.assign(allSnippets, JSON.parse(fs.readFileSync(filePath)));
        } catch (err) {
          console.log('err', err.code, err);
        }
      });
    });

    return allSnippets;
  }
}
function canAccessFile(filePath = '') {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.constants.F_OK | fs.constants.W_OK, err => {
      if (!err) {
        resolve(filePath);
      } else {
        if (env !== '--prod') {
          console.error(`${filePath} ${err.code === 'ENOENT' ? 'does not exist' : 'is read-only'}`);
        }
        reject();
      }
    });
  });
}
function handleSnippetBody(tagName = '', body = []) {
  let result = [];

  // 匹配 props 范围。上一Tag的开头到末尾
  let preTagEndIndex = body.findIndex(str => str === '>');
  body.slice(1, preTagEndIndex + 1).forEach((curStr, index) => {
    let [, attrName, attrValue] = attrAndValueReg.exec(curStr) || [];

    if (attrName && attrValue) {
      let [comment] = commentReg.exec(curStr) || [];

      let label = attrName.replace(/[:@]/g, '');
      result.push({
        label, // 联想的选项名
        insertText: new vscode.SnippetString(
          `${attrName}="${snippetEnumReg.test(attrValue) ? attrValue : `\${2:${attrValue}}`}"`
        ),
        documentation: comment || '',
        detail: tagName,
        kind: vscode.CompletionItemKind.Snippet,
        sortText: `0_${tagName}_${label}`,
      });
    }
  });

  return result;
}

class CustomCompletionItemProvider {
  _document;
  _position;
  tagReg = /<([\w-]+)\s*/g;
  attrReg = /(?:\(|\s*)(\w+)=['"][^'"]*/; // todo: 为什么会有 ( 开头 ?
  tagStartReg = /<([\w-]*)$/;
  // pugTagStartReg = /^\s*[\w-]*$/;
  size;
  quotes;
  provideCompletionData = {};

  /**
   * @returns {Object} { text }
   */
  getPreTag() {
    let line = this._position.line;
    let tag;
    // note：除当前行获取光标前的字符, 回溯行都是全部获取
    let txt = this.getTextBeforePosition(this._position);

    // 往上回溯 9 行
    while (this._position.line - line < 10 && line >= 0) {
      if (line !== this._position.line) {
        txt = this._document.lineAt(line).text;
      }
      tag = this.matchTag(this.tagReg, txt, line);

      if (tag === 'break') return;
      if (tag) return tag;

      line--;
    }
    return;
  }
  getPreAttr() {
    // todo: 这里是怎么定位到 属性开头的？
    let txt = this.getTextBeforePosition(this._position).replace(/"[^'"]*(\s*)[^'"]*$/, '');
    let end = this._position.character;
    // 这里的目标：` type = ""` => text
    let start = txt.lastIndexOf(' ', end) + 1;
    let parsedTxt = this._document.getText(new Range(this._position.line, start, this._position.line, end));

    let match = this.attrReg.exec(parsedTxt);
    return !/"[^"]*"/.test(txt) && match && match[1];
  }
  matchTag(reg, txt = '', line = -1) {
    let match;
    let arr = [];

    if (
      /<\/?[-\w]+[^<>]*>[\s\w]*<?\s*[\w-]*$/.test(txt) ||
      (this._position.line === line && (/^\s*[^<]+\s*>[^<\/>]*$/.test(txt) || /[^<>]*<$/.test(txt[txt.length - 1])))
    ) {
      return 'break';
    }

    // note: 执行到有不满足的情况，防止多个标签在同一行的误判；
    while ((match = reg.exec(txt))) {
      arr.push({
        text: match[1],
      });
    }

    return arr.pop();
  }
  /** 获取当前位置到 0 的文本 */
  getTextBeforePosition(position) {
    // curLine: 0 ... cur
    let start = new Position(position.line, 0);
    let range = new Range(start, position);

    return this._document.getText(range);
  }

  isAttrValueStart(tag = '', attr) {
    return tag && attr;
  }
  // isTagStart(tag) {
  //   // let txt = this.getTextBeforePosition(this._position);
  //   // // todo: 有标签的判断；
  //   // return this.tagStartReg.test(txt);

  //   return tag;
  // }

  // tentative plan for vue file
  notInTemplate() {
    let line = this._position.line;
    while (line) {
      if (/^\s*<script.*>\s*$/.test(this._document.lineAt(line).text)) {
        return true;
      }
      line--;
    }
    return false;
  }

  // nav:
  provideCompletionItems(document, position, token) {
    // const normalQuotes = config.get('quotes') === 'double' ? '"' : "'";
    // this.quotes = normalQuotes;

    this._document = document;
    this._position = position;

    // this.size = config.get('indent-size');
    // https://code.visualstudio.com/api/references/vscode-api#workspaceE
    const config = workspace.getConfiguration('vue-ui-kit-helper');
    let sources = config.get('sources');

    let provideResult = [];

    // 1. 标签 2. 标签 + 属性
    if (sources.length) {
      let tag = this.getPreTag();
      let attr = this.getPreAttr();

      console.log('tag', tag, 'attr', attr);

      if (this.isAttrValueStart(tag, attr)) {
        console.log('isAttrValueStart');

        // 返回值 => 标签、属性名都有
        let attrList = allSnippetsCon[tag.text] || [];
        if (attrList.length) {
          let attrItem = attrList.find(curItem => curItem.label === attr);
          // 若是普通值，返回嵌套在默认值中的值；若是枚举，直接返回
          let { insertText } = attrItem;

          // todo: 定位不对，都横着写，会触发上一属性的联想
          let attrValue = insertText.value.replace(attrValueReg, '$1');
          if (attrValue) {
            if (!snippetEnumReg.test(attrValue)) {
              attrValue = attrValue.replace(snippetValueReg, '$1');
            }

            provideResult = Object.assign(attrItem, {
              insertText: attrValue,
            });
          }
        }
      } else if (tag.text && ['vue', 'html'].includes(document.languageId)) {
        // 标签 - 返回属性列表
        console.log('startWithTag', allSnippetsCon, allSnippetsCon[tag.text]);

        provideResult = this.notInTemplate() ? [] : allSnippetsCon[tag.text] || [];
      }

      console.log('provideResult', provideResult);

      return provideResult;
    }
  }
}

class App {
  WORD_REG = /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/gi;

  setConfig() {
    // https://github.com/Microsoft/vscode/issues/24464
    const config = workspace.getConfiguration('editor');
    const quickSuggestions = config.get('quickSuggestions');
    if (!quickSuggestions['strings']) {
      config.update('quickSuggestions', { strings: true }, true);
    }
  }
}

module.exports = { App, CustomCompletionItemProvider };
