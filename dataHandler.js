const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const MAIN_COMPONENT_NAMES = require('cls-main-component-names');

// 匹配 snippet 字符串中的 属性名、属性值(英文、中文、函数、数组,)
const matchAttr = /\s*"([a-zA-Z]+)":\s*([a-zA-Z0-9\u4e00-\u9fa5\s\[\]\(\)\{\}"'=>]+)(?=,|\s)/;
const matchComment = /\/\/\s(.+)/;
const matchComponentExit = /^\s*component\s*:\s*("[a-zA-Z]+"|'[a-zA-Z]+')\s*,$/;
const matchAttrExit = /attributes\s*:/;
const matchValidExit = /validity\s*:/;
const matchObjectKey = /^\s*[a-zA-Z]+\s*:.+,$/;

let complementsMap = {};

if (vscode.workspace.workspaceFolders) {
  let [folder] = vscode.workspace.workspaceFolders;
  let { fsPath } = folder.uri;

  let snippetPath = path.resolve(`${fsPath}/.vscode/snippets.code-snippets`);
  fs.access(snippetPath, fs.constants.F_OK | fs.constants.W_OK, err => {
    if (err) {
      console.error(`${snippetPath} ${err.code === 'ENOENT' ? 'does not exist' : 'is read-only'}`);
      return;
    } else {
      // # 生成 complementItem 列表
      let parseResult = JSON.parse(fs.readFileSync(snippetPath));
      MAIN_COMPONENT_NAMES.forEach(componentName => {
        getComplementItem(componentName, 'attributes', parseResult, complementsMap);
        getComplementItem(componentName, 'validity', parseResult, complementsMap);
      });

      // # 根据指定模式，动态生成匹配文本
      const provider = vscode.languages.registerCompletionItemProvider(
        'vue',
        /**
         * 1. 通过 未写完的属性名联想（attributes.hi） 。拉取 snippet；
         * 2. todo: 通过 写完的属性名联想（attributes.hide）。拉取 值的范围；
         * 联想符：' '， ':', '"', "'"
         */
        {
          provideCompletionItems(document, position) {
            const curLine = document.lineAt(position.line).text.substr(0, position.character);

            /**
             * todo: 2. 当前行 'component' +'attributes' / 'validity' + 属性名
             */
            if (curLine.match(matchComponentExit)) {
              let [, componentName] = curLine.match(matchComponentExit);
              let attrExit = matchAttrExit.test(curLine);
              let validExit = matchValidExit.test(curLine);
              let attrType = (attrExit && 'attributes') || (validExit && 'validity');
              let { attrs, values } = complementsMap[componentName][attrType];
              if (attrs.length) return attrs;
            } else {
              let { line: originLineNum } = position;
              let newLineNum = originLineNum;
              let curLine = document.lineAt(position).text.substr(0, position.character);

              // line 往上回溯，找到 component 名停止
              let lineRecord = [];
              while (originLineNum - newLineNum <= 30 && newLineNum >= 0) {
                if (newLineNum !== originLineNum) curLine = document.lineAt(newLineNum).text;
                lineRecord.push(curLine);
                if (matchComponentExit.test(curLine)) break;
                newLineNum--;
              }

              lineRecord = lineRecord.map(curStr => curStr.replace(/\s+/g, '')).filter(curStr => curStr.length);
              lineRecord.reverse();

              let matchComponentNameResult = lineRecord[0].match(matchComponentExit);
              if (matchComponentNameResult) {
                let [, componentName] = matchComponentNameResult;
                componentName = componentName.replace(/"|'/g, '');

                let attrExistIndex = lineRecord.findIndex(curLine => matchAttrExit.test(curLine));
                let validExistIndex = lineRecord.findIndex(curLine => matchValidExit.test(curLine));

                if (componentName && (attrExistIndex > -1 || validExistIndex > -1)) {
                  // 若 当前行不紧跟 attributes/validty，判断中间内容是否都符合条件
                  let inWrapperObject = true;
                  let wrapperKeyIndex = Math.max(attrExistIndex, validExistIndex);

                  if (wrapperKeyIndex !== lineRecord.length - 1) {
                    if (lineRecord.slice(wrapperKeyIndex + 1).some(curStr => !matchObjectKey.test(curStr))) {
                      inWrapperObject = false;
                    }
                  }

                  let attrName = wrapperKeyIndex === attrExistIndex ? 'attributes' : 'validity';
                  if (inWrapperObject && complementsMap[componentName] && complementsMap[componentName][attrName]) {
                    return complementsMap[componentName][attrName].attrs;
                  } else {
                    console.error(`输入位置不在 attributes/validity 中 或 ${componentName}.${attrName} 不存在`);
                  }
                }
              } else {
                console.error('组件名未匹配');
              }
            }
          },
        },
        '\n'
      );

      context.subscriptions.push(provider);
    }
  });
}

/**
 * 给 complementsMap 添加 complementItem
 * @param {String} componentName
 * @param {String} attrName
 * @param {Object} parseResult
 * @param {Object} collection
 */
function getComplementItem(componentName = '', attrName = '', parseResult = {}, collection = {}) {
  let keyName = `@cls cls-${componentName}-${attrName}`;

  if (parseResult[keyName]) {
    let { body } = parseResult[keyName];
    let complementItem = handleSnippetBody(componentName, attrName, body);

    if (!collection[componentName]) collection[componentName] = {};
    collection[componentName][attrName] = complementItem;
  }
}
/**
 * 根据 body 构造 complementItem
 * @param {String} componentName 组件名, eg: button
 * @param {String} attrType 属性名, eg: attributes/validity
 * @param {Array} body 对应 snippet 结构的 body
 */
function handleSnippetBody(componentName = '', attrType = '', body = []) {
  let result = {
    attrs: [],
    values: [],
  };
  let { attrs, values } = result;
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
      values.push({
        detail: `cls-ui`,
        kind: vscode.CompletionItemKind.Value,
        label: attrName,
        sortText: `0_${componentName}_${attrType}_${attrName}`,
        // todo: 应该是个 snippet 选项，但 CLS 的 snippet 只有备注; new attrstring(`"\${1|${attrValue}|}"`)
        insertText: attrValue,
        documentation: comment || '',
      });
    }
  });

  return result;
}

module.exports = {
  activate,
  deactivate,
};
