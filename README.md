# Vue-Ui-Kit-Helper

[demo 地址](https://github.com/engvuchen/helper-demo)

## 功能

- 自动补全

1. 需先使用 [`vue-snippet-gen`](https://www.npmjs.com/package/vue-snippet-gen) 解析指定组件库；

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
