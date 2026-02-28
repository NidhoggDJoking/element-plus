<!--
  @sfc-doc
  文件：packages/components/tree/src/tree-node-content.vue
  作用：Tree 节点内容区的渲染适配层。
  渲染优先级：
  1) props.renderContent：外部传入的自定义渲染函数（优先级最高）。
  2) Tree 的默认插槽：<el-tree> 的 default slot（用于自定义节点展示）。
  3) 默认渲染：使用 ElText 渲染 node.label，并启用截断（truncated）。

  说明：这里通过注入拿到树上下文（ROOT_TREE_INJECTION_KEY）与当前节点组件实例（NODE_INSTANCE_INJECTION_KEY），
  以便在 renderContent 回调里保持与历史 API 兼容的参数形态（包含 _self）。
-->
<script lang="ts">
import { defineComponent, h, inject, renderSlot } from 'vue'
import ElText from '@element-plus/components/text'
import { useNamespace } from '@element-plus/hooks'
import { NODE_INSTANCE_INJECTION_KEY, ROOT_TREE_INJECTION_KEY } from './tokens'

import type { ComponentInternalInstance } from 'vue'
import type { RootTreeType } from './tree.type'

export default defineComponent({
  name: 'ElTreeNodeContent',
  props: {
    node: {
      type: Object,
      required: true,
    },
    renderContent: Function,
  },
  setup(props) {
    const ns = useNamespace('tree')

    // 当前 ElTreeNode 组件实例：用于 renderContent 回调的 _self 字段（兼容旧版渲染签名）
    const nodeInstance = inject<ComponentInternalInstance>(
      NODE_INSTANCE_INJECTION_KEY
    )

    // 根树上下文：用于访问 Tree 的 slots
    const tree = inject<RootTreeType>(ROOT_TREE_INJECTION_KEY)!

    // 渲染函数：每次节点状态变化（如 label 变化）会重新执行
    return () => {
      const node = props.node
      const { data, store } = node

      // renderContent 优先：由外部完全接管节点内容渲染
      return props.renderContent
        ? props.renderContent(h, { _self: nodeInstance, node, data, store })
        : renderSlot(tree.ctx.slots, 'default', { node, data }, () => [
            // 默认内容：渲染节点 label，并启用截断
            h(
              ElText,
              { tag: 'span', truncated: true, class: ns.be('node', 'label') },
              () => [node.label]
            ),
          ])
    }
  },
})
</script>
