# Vue-Ui-Kit-Helper

## 开发背景

1. 实践过 `项目 Snippet`、vscode 插件补全能力的搭配，给 wecomponent 做了 [`cls-helper`](https://marketplace.visualstudio.com/items?itemName=engvuchen.cls-helper)；
2. 这套方案的优势在于：备注写在 Vue 文件内，当组件库有更新，自动补全也可以快速被更新；
3. 试试看这套方案对其他组件库的支持。

## 用途

1. 用作 `helper` 插件模板。快速制作对应组件库的 `helper` 插件。

## 功能

- 支持任意 Vue2.0 组件库的组件属性自动补全，且支持多个组件库。需提供指定的数据源。

1. 依赖 [`vue-snippet-gen`](https://www.npmjs.com/package/vue-snippet-gen) 解析指定组件库生成的数据源。

```bash
npx vue-snippet-gen --conf --filter
```

![演示-vue-ui-kit-helper.gif](https://i.loli.net/2021/09/07/vjGDdiu3ZHXwM7n.gif)

## 设置

1. vscode 侧栏左小角 -> 设置；或 `ctrl + ,` 转到 `Extensions`（拓展），找到 `vue-ui-kit-helper`；

![配置-vue-ui-kit-helper.png](https://i.loli.net/2021/09/07/Gjog1ZdzHYRXUla.png)
![配置2-vue-ui-kit-helper.png](https://i.loli.net/2021/09/07/Mjxm8p4fSWX1lUh.png)

2. 添加配置；

```json
  "vue-ui-kit-helper.sources": ["element-test-demo"]
```

## 体验

[demo 地址](https://github.com/engvuchen/helper-demo)

## 已知缺陷

1. 没有 文档速查、Snippet 能力；
2. 仅支持 Vue2。依赖的 `vue-docgen-api` 尚未支持 Vue3；
3. 不支持解析 typescript 语法。
4. 不可解析 `mixins`。已提 [ISSUE](https://github.com/vue-styleguidist/vue-styleguidist/issues/1191)；
5. 不支持组件嵌套；
6. 开源的组件库一般都不带有 prop/event 备注，插件开发者需要另行维护另一套带备注的组件库。见 [demo](https://github.com/engvuchen/element-test-demo)。
