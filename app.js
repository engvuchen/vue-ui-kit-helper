const vscode = require('vscode');
const { window, workspace, Position, CompletionItemKind, SnippetString, Range } = vscode;

const fs = require('fs');
const path = require('path');

const tagNameReg = /(?<= ).+/;
const attrAndValueReg = /\s*([\:@]?[a-zA-Z-_]+)="(.*)"/;
const attrValueReg = /(?<==)"(.*)"/;
const snippetEnumReg = /\$\{\d+\|.*\|\}/;
const commentReg = /(?<=\/\/ ).+/;

const beforeAttrReg = /[:@\w]/;

const allSnippetsCon = {};
main();

async function main() {
  let sources = (await getSelectedUiKits()) || [];
  console.log('sources', sources);

  if (sources && sources.length) {
    let allSnippets = await getProjectSnippets(sources);

    Object.keys(allSnippets).forEach(snippetKey => {
      let [tagName] = tagNameReg.exec(snippetKey) || [];
      if (tagName) {
        allSnippetsCon[tagName] = handleSnippetBody(tagName, allSnippets[snippetKey].body);
      }
    });

    // let { fsPath } = workspace.workspaceFolders[0].uri; // 生成测试文件
    // fs.writeFileSync(`${fsPath}/kit-helper.json`, JSON.stringify(allSnippetsCon, undefined, 4));
  } else {
    console.error('Please give a sources setting');
  }
}
async function getProjectSnippets(sources = []) {
  // https://code.visualstudio.com/api/references/vscode-api#workspace
  let [folder] = workspace.workspaceFolders;
  if (folder) {
    let { fsPath } = folder.uri;
    let queen = sources.map(name => {
      return canAccessFile(path.resolve(`${fsPath}/.vscode/${name}.json`));
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
        console.error(`${filePath} ${err.code === 'ENOENT' ? 'does not exist' : 'is read-only'}`);
        reject();
      }
    });
  });
}
function handleSnippetBody(tagName = '', body = []) {
  let result = [];

  // note: props 范围 - 上一Tag的开头到末尾
  body.forEach((curStr, index) => {
    let [, attrName, attrValue] = attrAndValueReg.exec(curStr) || [];

    if (attrName) {
      let label = attrName.replace(/[:@]/g, '');
      let [comment] = commentReg.exec(curStr) || [];

      result.push({
        label, // 联想的选项名 - 键入时-匹配选项名
        insertText: new SnippetString(`${attrName}="${handleSnippetValue(attrValue)}"`),
        documentation: comment || '',
        detail: tagName,
        kind: CompletionItemKind.Snippet,
        sortText: `0_${tagName}_${label}`,
      });
    }
  });

  return result;
}
function handleSnippetValue(attrValue = '') {
  let result = attrValue || '';
  if (attrValue && !snippetEnumReg.test(attrValue)) {
    result = `\${2:${attrValue}}`;
  }
  return result;
}
async function getSelectedUiKits() {
  // 用户配置
  let sources = workspace.getConfiguration('vue-ui-kit-helper').get('sources') || [];
  if (sources && sources.length) return sources;

  // 使用 vue-snippet-gen 配置
  if (!sources.length) {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length) {
      let { fsPath } = workspace.workspaceFolders[0].uri;

      let pkgStr = await readFileAsync(fsPath);
      if (pkgStr) {
        let genConf = JSON.parse(pkgStr)['vue-snippet-gen'] || [];

        const reg = /.+?(?=\/)/;
        sources = genConf
          .map(curItem => {
            let [result] = reg.exec(curItem.path) || [];
            return result || curItem.path;
          })
          .filter(str => str);
      }
    }
  }

  // demo 配置
  if (!sources.length) sources = ['element-test-demo'];

  return sources;
}
function readFileAsync(fsPath = '') {
  return new Promise((resolve, reject) => {
    fs.readFile(`${fsPath}/package.json`, (err, buffer) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve(buffer);
      }
    });
  });
}

class CustomCompletionItemProvider {
  _document;
  _position;
  tagReg = /<([\w-]+)\s*/g;
  attrReg = /[:@]?([\w-]+)=['"][^'"]*/g;
  tagStartReg = /<([\w-]*)$/;
  tagEndReg = /<\s*\/[a-zA-Z_-]+/;

  getPreTag() {
    let line = this._position.line;
    let tag;
    // note: 除当前行获取光标前的字符, 回溯行都是全部获取
    let txt = this.getTextBeforePosition(this._position);

    // 上溯 30 行
    /**
     * 中止：
     * 1. 回溯遇到尾标签（不可跨标签）
     * 2. 标签内
     * 3. 末尾标签内
     */
    while (this._position.line - line < 30 && line >= 0) {
      if (line !== this._position.line) txt = this._document.lineAt(line).text;

      tag = this.matchTag(this.tagReg, txt, line);
      tag === 'break' && console.log('中止匹配标签');

      if (tag === 'break') return;
      if (tag) return tag;

      line--;
    }
  }
  getPreAttr() {
    // 去掉刚敲的双引号、和他后面的内容？
    // .replace(/['"][^'"]*(\s*)[^'"]*$/, '');
    let txt = this.getTextBeforePosition(this._position);
    let end = this._position.character;
    // 末尾倒数的第一个空格后，从当前位置开始
    let start = txt.lastIndexOf(' ', end) + 1;
    let parsedTxt = txt.slice(start, end);

    let matchList = [...parsedTxt.matchAll(this.attrReg)];
    let match = matchList.pop();

    return match && match[1];
  }
  matchTag(reg, txt = '', line = -1) {
    /**
     * 1. 检测所有行
     * 1.1 <button *>  - 标签内
     * 1.2 </button  - 末尾标签
     *
     * 1.4 (原代码) <div><button - 未正确闭合的标签 ？这未必是错误的匹配
     *
     * 2. 仅当前行
     * 2.1  ** > ** - 标签内 ? 可能是标签的最后一行 ageag>
     * 2.2 最后一个字符是 < => ? => el-helper 原代码敲 <，拉标签，排除这个干扰
     */

    //  /<\/?[-\w]+[^<>]*>[\s\w]*<?\s*[\w-]*$/
    if (/<\/?[-\w]+[^<>]*>(.*)$/.test(txt)) {
      // 最后一个 < 和其后的内容 不是 标签
      let afterFirstTagTxt = RegExp.$1;
      if (afterFirstTagTxt) {
        if (!/<[-\w]+\s*$/.test(afterFirstTagTxt)) return 'break';
      } else {
        return 'break';
      }
    }
    // /<\/?[-\w]+[^<>]*>[^<]*$/.test(txt) ||
    if (this._position.line === line && (/^\s*[^<]+\s*>[^<\/>]*$/.test(txt) || /[^<>]*<$/.test(txt[txt.length - 1]))) {
      console.log('当前行匹配失败');
      return 'break';
    }

    let matchList = [...txt.matchAll(reg)];
    let match = matchList.pop();
    if (match) return match[1];
  }
  getTextBeforePosition(position) {
    let start = new Position(position.line, 0);
    let range = new Range(start, position);

    return this._document.getText(range);
  }
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

  provideCompletionItems(document, position, token) {
    this._document = document;
    this._position = position;

    let provideResult = [];
    let tagName = this.getPreTag();
    let attr = this.getPreAttr();

    console.log('tagName', tagName, 'attr', attr);

    // note: 在下一属性前，不补全。用户可能只是想排版，优化体验
    let { line, character } = this._position;
    let nextCharacter = this._document.lineAt(line).text.slice(character, character + 1);
    if (beforeAttrReg.test(nextCharacter)) return [];

    if (tagName && attr) {
      console.log('isAttrValueStart');

      // 返回值 => 标签、属性名都有
      let attrList = allSnippetsCon[tagName] || [];
      if (attrList.length) {
        let attrItem = attrList.find(curItem => curItem.label === attr);

        // 若是普通值，返回嵌套在默认值中的值；若是枚举，直接返回
        if (attrItem) {
          let newAttrItem = JSON.parse(JSON.stringify(attrItem));
          let { insertText } = newAttrItem;
          let [, attrValue] = attrValueReg.exec(insertText.value) || [];

          if (attrValue) {
            provideResult = [
              Object.assign(newAttrItem, {
                insertText: new SnippetString(attrValue),
                label: snippetEnumReg.test(attrValue) ? `${attr}_enum` : `${attr}_default`,
              }),
            ];
          }
        }
      }
    } else if (tagName && ['vue', 'html'].includes(document.languageId)) {
      // 标签 - 返回属性列表
      console.log('isTagStart', allSnippetsCon[tagName]);

      provideResult = this.notInTemplate() ? [] : allSnippetsCon[tagName] || [];
    }

    console.log('provideResult', provideResult);

    return provideResult;
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
