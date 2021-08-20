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

const kebabCaseTAGS = require('element-helper-json-new/element-tags.json');
const kebabCaseATTRS = require('element-helper-json-new/element-attributes.json');

const prettyHTML = require('pretty');
const fs = require('fs');

// let TAGS = {};
// for (const key in kebabCaseTAGS) {
//   if (kebabCaseTAGS.hasOwnProperty(key)) {
//     const tag = kebabCaseTAGS[key];
//     let subtags = tag.subtags;
//     TAGS[key] = tag;

//     let camelCase = toUpperCase(key);
//     TAGS[camelCase] = JSON.parse(JSON.stringify(kebabCaseTAGS[key]));
//     if (subtags) {
//       subtags = subtags.map(item => toUpperCase(item));
//       TAGS[camelCase].subtags = subtags;
//     }
//   }
// }

// let ATTRS = {};
// for (const key in kebabCaseATTRS) {
//   if (kebabCaseATTRS.hasOwnProperty(key)) {
//     const element = kebabCaseATTRS[key];
//     ATTRS[key] = element;
//     const tagAttrs = key.split('/');
//     const hasTag = tagAttrs.length > 1;
//     let tag = '';
//     let attr = '';
//     if (hasTag) {
//       tag = toUpperCase(tagAttrs[0]) + '/';
//       attr = tagAttrs[1];
//       ATTRS[tag + attr] = JSON.parse(JSON.stringify(element));
//     }
//   }
// }
// function toUpperCase(key = '') {
//   let camelCase = key.replace(/\-(\w)/g, function (all, letter) {
//     return letter.toUpperCase();
//   });
//   camelCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
//   return camelCase;
// }


async function getProjectSnippets(sources = []) {
  let [folder] = workspace.workspaceFolders;
  if (folder) {
    let { fsPath } = folder.uri;
    let queen = sources.map(name => canAccessFile(path.resolve(`${fsPath}/.vscode/${name}.code-snippets`)));

    let allSnippets = {};
    await Promise.allSettled(queen).then(resList => {
      let accessFileList = resList.filter(curItem => curItem.status === 'fulfilled').map(curItem => curItem.value);

      accessFileList.forEach(filePath => {
        try {
          Object.assign(allSnippets, JSON.parse(fs.readFileSync(snippetPath)));
        } catch (err) {
          console.log('err', err.code, err);
        }
      });
    });

    return;
  }
}
function canAccessFile(filePath = '') {
  return new Promise((resolve, reject) => {
    fs.access(filePath, s.constants.F_OK | fs.constants.W_OK, err => {
      if (!err) {
        resolve(filePath);
      } else {
        if (env !== '--prod') {
          console.error(`${filePath} ${err.code === 'ENOENT' ? 'does not exist' : 'is read-only'}`);
        }
        reject(undefined);
      }
    });
  });
}
function getComplementItem(componentName = '', attrName = '', parseResult = {}) {
  let keyName = `@cls cls-${componentName}-${attrName}`;

  if (parseResult[keyName]) {
    let { body } = parseResult[keyName];
    let complementItem = handleSnippetBody(componentName, attrName, body);

    if (!this.collection[componentName]) this.collection[componentName] = {};
    this.collection[componentName][attrName] = complementItem;
  }
}
function handleSnippetBody(componentName = '' = '', body = []) {
  let result = {

  };
  body.forEach((curStr, index) => {
    let matchAttrResult = curStr.match(matchAttr);
    let attrName = matchAttrResult ? matchAttrResult[1] : '';
    let attrValue = matchAttrResult ? matchAttrResult[2] : '';

    let matchCommentResult = curStr.match(matchComment);
    let comment = matchCommentResult ? matchCommentResult[1] : '';

    if (attrName && attrValue) {
      attrs.push({
        detail: `cls-ui`,
        kind: vscode.CompletionItemKind.Snippet,
        label: attrName, // 联想的选项名
        sortText: `0${componentName}_${attrType}_${attrName}`,
        insertText: new vscode.SnippetString(`${attrName}: \${2:${attrValue}},`),
        documentation: comment || '',
      });
    }
  });

  return result;
}

class CustomCompletionItemProvider {
  _document;
  _position;
  tagReg = /<([\w-]+)\s*/g;
  attrReg = /(?:\(|\s*)(\w+)=['"][^'"]*/; // todo: 为什么会有 ( 开头？
  tagStartReg = /<([\w-]*)$/;
  pugTagStartReg = /^\s*[\w-]*$/;
  size;
  quotes;
  provideCompletionData = {};

  getPreTag() {
    let line = this._position.line;
    let tag;
    let txt = this.getTextBeforePosition(this._position);

    // 往上回溯 9 行
    while (this._position.line - line < 10 && line >= 0) {
      // line 不等，说明当前行是 回溯行
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
    let txt = this.getTextBeforePosition(this._position).replace(/"[^'"]*(\s*)[^'"]*$/, '');
    let end = this._position.character;
    let start = txt.lastIndexOf(' ', end) + 1;
    let parsedTxt = this._document.getText(new Range(this._position.line, start, this._position.line, end));

    return this.matchAttr(this.attrReg, parsedTxt);
  }

  matchAttr(reg, txt = '') {
    let match;

    // nav: attrReg exec
    match = reg.exec(txt);
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
    while ((match = reg.exec(txt))) {
      arr.push({
        text: match[1],
        offset: this._document.offsetAt(new Position(line, match.index)),
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

  // todo:
  // getTagSuggestion() {
  //   let suggestions = [];

  //   let id = 100;
  //   for (let tag in TAGS) {
  //     suggestions.push(this.buildTagSuggestion(tag, TAGS[tag], id));
  //     id++;
  //   }
  //   return suggestions;
  // }
  // todo:
  getAttrValueSuggestion(tag = '', attr = '') {
    let suggestions = [];
    const values = this.getAttrValues(tag, attr);
    values.forEach(value => {
      suggestions.push({
        label: value,
        kind: CompletionItemKind.Value,
      });
    });
    return suggestions;
  }
  // todo: 重写书香联想，直接返回 tag: [] 对应的数组
  getAttrSuggestion(tag = '') {
    // let suggestions = [];
    // let tagAttrs = this.getTagAttrs(tag);
    // let preText = this.getTextBeforePosition(this._position);
    // let prefix = preText
    //   .replace(/['"]([^'"]*)['"]$/, '')
    //   .split(/\s|\(+/)
    //   .pop();
    // // method attribute
    // const method = prefix[0] === '@';
    // // bind attribute
    // const bind = prefix[0] === ':';

    // prefix = prefix.replace(/[:@]/, '');

    // if (/[^@:a-zA-z\s]/.test(prefix[0])) {
    //   return suggestions;
    // }

    // tagAttrs.forEach(attr => {
    //   const attrItem = this.getAttrItem(tag, attr);
    //   if (attrItem && (!prefix.trim() || this.firstCharsEqual(attr, prefix))) {
    //     const sug = this.buildAttrSuggestion({ attr, tag, bind, method }, attrItem);
    //     sug && suggestions.push(sug);
    //   }
    // });
    // for (let attr in ATTRS) {
    //   const attrItem = this.getAttrItem(tag, attr);
    //   if (attrItem && attrItem.global && (!prefix.trim() || this.firstCharsEqual(attr, prefix))) {
    //     const sug = this.buildAttrSuggestion({ attr, tag: null, bind, method }, attrItem);
    //     sug && suggestions.push(sug);
    //   }
    // }

    return suggestions;
  }

  buildTagSuggestion(tag, tagVal, id) {
    const snippets = [];
    let index = 0;
    let that = this;
    function build(tag, { subtags, defaults }, snippets) {
      let attrs = '';
      defaults &&
        defaults.forEach((item, i) => {
          attrs += ` ${item}=${that.quotes}$${index + i + 1}${that.quotes}`;
        });
      snippets.push(`${index > 0 ? '<' : ''}${tag}${attrs}>`);
      index++;
      subtags && subtags.forEach(item => build(item, TAGS[item], snippets));
      snippets.push(`</${tag}>`);
    }
    build(tag, tagVal, snippets);

    return {
      label: tag,
      sortText: `0${id}${tag}`,
      insertText: new SnippetString(prettyHTML('<' + snippets.join(''), { indent_size: this.size }).substr(1)),
      kind: CompletionItemKind.Snippet,
      detail: `element-ui ${tagVal.version ? `(version: ${tagVal.version})` : ''}`,
      documentation: tagVal.description,
    };
  }

  buildAttrSuggestion({ attr, tag, bind, method }, { description, type, version }) {
    if ((method && type === 'method') || (bind && type !== 'method') || (!method && !bind)) {
      return {
        label: attr,
        insertText:
          type && type === 'flag' ? `${attr} ` : new SnippetString(`${attr}=${this.quotes}$1${this.quotes}$0`),
        kind: type && type === 'method' ? CompletionItemKind.Method : CompletionItemKind.Property,
        detail: tag
          ? `<${tag}> ${version ? `(version: ${version})` : ''}`
          : `element-ui ${version ? `(version: ${version})` : ''}`,
        documentation: description,
      };
    } else {
      return;
    }
  }

  getAttrValues(tag, attr) {
    let attrItem = this.getAttrItem(tag, attr);
    let options = attrItem && attrItem.options;
    if (!options && attrItem) {
      if (attrItem.type === 'boolean') {
        options = ['true', 'false'];
      } else if (attrItem.type === 'icon') {
        options = ATTRS['icons'];
      } else if (attrItem.type === 'shortcut-icon') {
        options = [];
        ATTRS['icons'].forEach(icon => {
          options.push(icon.replace(/^el-icon-/, ''));
        });
      }
    }
    return options || [];
  }

  getTagAttrs(tag = '') {
    return (TAGS[tag] && TAGS[tag].attributes) || [];
  }

  getAttrItem(tag = string, attr = string) {
    return ATTRS[`${tag}/${attr}`] || ATTRS[attr];
  }

  isAttrValueStart(tag = '', attr) {
    return tag && attr;
  }

  isAttrStart(tag = '') {
    return tag;
  }

  isTagStart() {
    let txt = this.getTextBeforePosition(this._position);
    // return this.isPug() ? this.pugTagStartReg.test(txt) : this.tagStartReg.test(txt);
    return this.tagStartReg.test(txt);
  }

  firstCharsEqual(str1 = '', str2 = '') {
    if (str2 && str1) {
      return str1[0].toLowerCase() === str2[0].toLowerCase();
    }
    return false;
  }
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
    // https://code.visualstudio.com/api/references/vscode-api#workspace
    const config = workspace.getConfiguration('vue-ui-kit-helper');
    let sources = config.get('sources');

    if (sources.length) {
      let tag = this.getPreTag();
      let attr = this.getPreAttr();
      if (this.isAttrValueStart(tag, attr)) {
        // 属性值开始（标签、属性名都有）

        return this.getAttrValueSuggestion(tag.text, attr);
      } else if (this.isAttrStart(tag)) {
        // 属性开始

        return this.getAttrSuggestion(tag.text);
      }

      // else if (this.isTagStart()) {
      //   // 标签开始
      //   // todo:
      //   switch (document.languageId) {
      //     case 'vue':
      //       return this.notInTemplate() ? [] : this.getTagSuggestion();
      //     case 'html':
      //       // todo
      //       return this.getTagSuggestion();
      //   }
      // } else {
      //   return [];
      // }
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
