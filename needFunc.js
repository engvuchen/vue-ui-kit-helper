const vscode = require('vscode');
const { workspace } = vscode;

function provideCompletionItems(document, position, token) {
  // this._document = document;
  // this._position = position;

  // const normalQuotes = config.get('quotes') === 'double' ? '"' : "'";
  // this.quotes = normalQuotes;

  // https://code.visualstudio.com/api/references/vscode-api#workspace
  const config = workspace.getConfiguration('vue-ui-kit-helper');
  // this.size = config.get('indent-size');

  let tag = getPreTag();
  let attr = getPreAttr();
  if (isAttrValueStart(tag, attr)) {
    // 属性值开始（标签、属性名都有）
    // todo:
    return getAttrValueSuggestion(tag.text, attr);
  } else if (isAttrStart(tag)) {
    // 属性开始
    return getAttrSuggestion(tag.text);
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

function getPreTag() {
  let line = this._position.line;
  let tag;
  let txt = getTextBeforePosition(this._position);

  // 往上回溯 9 行
  while (this._position.line - line < 10 && line >= 0) {
    // line 不等，说明当前行是 回溯行
    if (line !== this._position.line) {
      txt = this._document.lineAt(line).text;
    }
    tag = matchTag(this.tagReg, txt, line);

    if (tag === 'break') return;
    if (tag) return tag;
    line--;
  }
  return;
}

function getPreAttr() {
  let txt = getTextBeforePosition(this._position).replace(/"[^'"]*(\s*)[^'"]*$/, '');
  let end = this._position.character;
  let start = txt.lastIndexOf(' ', end) + 1;
  let parsedTxt = this._document.getText(new Range(this._position.line, start, this._position.line, end));

  return matchAttr(this.attrReg, parsedTxt);
}

function matchAttr(reg, txt = '') {
  let match = reg.exec(txt);
  return !/"[^"]*"/.test(txt) && match && match[1];
}
function matchTag(reg, txt = '', line = -1) {
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
function getTextBeforePosition(position) {
  // curLine: 0 ... cur
  let start = new Position(position.line, 0);
  let range = new Range(start, position);

  return this._document.getText(range);
}

function isAttrValueStart(tag = '', attr) {
  return tag && attr;
}
