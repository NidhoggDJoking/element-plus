<!--
  @sfc-doc
  文件：packages/components/tree/src/tree-node.vue
  作用：Tree 的单个节点渲染与交互承载（展开/折叠、勾选、当前节点、高亮、拖拽等）。

  结构说明：
  - 外层 div(role="treeitem")：承载无障碍语义与拖拽事件，data-key 用于定位节点。
  - content 区：包含展开图标、复选框、loading 图标、以及节点内容（NodeContent）。
  - children 区(role="group")：递归渲染子节点，配合折叠过渡组件。

  交互说明：
  - 点击节点：可能触发 current 变更、展开/折叠、以及勾选（取决于 props 配置）。
  - 拖拽：事件会转交给 useDragNode 中注入的 dragEvents 统一处理。
-->
<template>
  <div
    v-show="node.visible"
    ref="node$"
    :class="[
      ns.b('node'),
      ns.is('expanded', expanded),
      ns.is('current', node.isCurrent),
      ns.is('hidden', !node.visible),
      ns.is('focusable', !node.disabled),
      ns.is('checked', !node.disabled && node.checked),
      getNodeClass(node),
    ]"
    role="treeitem"
    tabindex="-1"
    :aria-expanded="expanded"
    :aria-disabled="node.disabled"
    :aria-checked="node.checked"
    :draggable="tree.props.draggable"
    :data-key="getNodeKey(node)"
    @click.stop="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart.stop="handleDragStart"
    @dragover.stop="handleDragOver"
    @dragend.stop="handleDragEnd"
    @drop.stop="handleDrop"
  >
    <div
      :class="ns.be('node', 'content')"
      :style="{ paddingLeft: (node.level - 1) * tree.props.indent + 'px' }"
    >
      <!-- 展开图标：叶子节点会增加 leaf 类并在点击时被忽略 -->
      <el-icon
        v-if="tree.props.icon || CaretRight"
        :class="[
          ns.be('node', 'expand-icon'),
          ns.is('leaf', node.isLeaf),
          {
            expanded: !node.isLeaf && expanded,
          },
        ]"
        @click.stop="handleExpandIconClick"
      >
        <component :is="tree.props.icon || CaretRight" />
      </el-icon>

      <!-- 复选框：由 showCheckbox 控制，change 时由 Node 统一更新选中态并回传 Tree 事件 -->
      <el-checkbox
        v-if="showCheckbox"
        :model-value="node.checked"
        :indeterminate="node.indeterminate"
        :disabled="!!node.disabled"
        @click.stop
        @change="handleCheckChange"
      />

      <!-- 异步加载中图标：lazy/load 模式下常见 -->
      <el-icon
        v-if="node.loading"
        :class="[ns.be('node', 'loading-icon'), ns.is('loading')]"
      >
        <loading />
      </el-icon>

      <!-- 节点内容：renderContent 优先，其次 Tree 默认插槽，最后是 label 文本 -->
      <node-content :node="node" :render-content="renderContent" />
    </div>

    <!-- 子节点容器：仅在展开时展示；renderAfterExpand=true 时首次展开后才会渲染子树 -->
    <el-collapse-transition>
      <div
        v-if="!renderAfterExpand || childNodeRendered"
        v-show="expanded"
        :class="ns.be('node', 'children')"
        role="group"
        :aria-expanded="expanded"
        @click.stop
      >
        <el-tree-node
          v-for="child in node.childNodes"
          :key="getNodeKey(child)"
          :render-content="renderContent"
          :render-after-expand="renderAfterExpand"
          :show-checkbox="showCheckbox"
          :node="child"
          :accordion="accordion"
          :props="props"
          @node-expand="handleChildNodeExpand"
        />
      </div>
    </el-collapse-transition>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  getCurrentInstance,
  inject,
  nextTick,
  provide,
  ref,
  watch,
} from 'vue'
import { debugWarn, isFunction, isString } from '@element-plus/utils'
import ElCollapseTransition from '@element-plus/components/collapse-transition'
import ElCheckbox from '@element-plus/components/checkbox'
import { ElIcon } from '@element-plus/components/icon'
import { CaretRight, Loading } from '@element-plus/icons-vue'
import { useNamespace } from '@element-plus/hooks'
import NodeContent from './tree-node-content.vue'
import { getNodeKey as getNodeKeyUtil, handleCurrentChange } from './model/util'
import { useNodeExpandEventBroadcast } from './model/useNodeExpandEventBroadcast'
import { dragEventsKey } from './model/useDragNode'
import Node from './model/node'
import { NODE_INSTANCE_INJECTION_KEY, ROOT_TREE_INJECTION_KEY } from './tokens'

import type { ComponentInternalInstance, PropType } from 'vue'
import type { RootTreeType, TreeNodeData, TreeOptionProps } from './tree.type'
import type { CheckboxValueType } from '@element-plus/components/checkbox'

export default defineComponent({
  name: 'ElTreeNode',
  components: {
    ElCollapseTransition,
    ElCheckbox,
    NodeContent,
    ElIcon,
    Loading,
  },
  props: {
    node: {
      type: Node,
      default: () => ({}),
    },
    props: {
      type: Object as PropType<TreeOptionProps>,
      default: () => ({}),
    },
    accordion: Boolean,
    renderContent: Function,
    renderAfterExpand: Boolean,
    showCheckbox: Boolean,
  },
  emits: ['node-expand'],
  setup(props, ctx) {
    const ns = useNamespace('tree')
    const { broadcastExpanded } = useNodeExpandEventBroadcast(props)
    const tree = inject<RootTreeType>(ROOT_TREE_INJECTION_KEY)!
    const expanded = ref(false)
    const childNodeRendered = ref(false)
    const oldChecked = ref<boolean>()
    const oldIndeterminate = ref<boolean>()
    const node$ = ref<HTMLElement>()
    const dragEvents = inject(dragEventsKey)!
    const instance = getCurrentInstance()

    provide(NODE_INSTANCE_INJECTION_KEY, instance)
    if (!tree) {
      debugWarn('Tree', "Can not find node's tree.")
    }

    if (props.node.expanded) {
      expanded.value = true
      childNodeRendered.value = true
    }

    // data 中 children 字段名可由 Tree.props.props.children 自定义
    const childrenKey = tree.props.props['children'] || 'children'

    // 监听原始数据 children 的变更：同步更新 Node.childNodes（保持数据源与渲染树一致）
    watch(
      () => {
        const children = props.node.data?.[childrenKey]
        return children && [...children]
      },
      () => {
        props.node.updateChildren()
      }
    )

    watch(
      () => props.node.indeterminate,
      (val) => {
        handleSelectChange(props.node.checked, val)
      }
    )

    watch(
      () => props.node.checked,
      (val) => {
        handleSelectChange(val, props.node.indeterminate)
      }
    )

    watch(
      () => props.node.childNodes.length,
      () => props.node.reInitChecked()
    )

    watch(
      () => props.node.expanded,
      (val) => {
        nextTick(() => (expanded.value = val))
        if (val) {
          childNodeRendered.value = true
        }
      }
    )

    const getNodeKey = (node: Node): any => {
      return getNodeKeyUtil(tree.props.nodeKey, node.data)
    }

    const getNodeClass = (node: Node) => {
      const nodeClassFunc = props.props.class
      if (!nodeClassFunc) {
        return {}
      }
      let className
      if (isFunction(nodeClassFunc)) {
        const { data } = node
        className = nodeClassFunc(data, node)
      } else {
        className = nodeClassFunc
      }

      if (isString(className)) {
        return { [className]: true }
      } else {
        return className
      }
    }

    const handleSelectChange = (checked: boolean, indeterminate: boolean) => {
      if (
        oldChecked.value !== checked ||
        oldIndeterminate.value !== indeterminate
      ) {
        tree.ctx.emit('check-change', props.node.data, checked, indeterminate)
      }
      oldChecked.value = checked
      oldIndeterminate.value = indeterminate
    }

    /**
     * 处理节点点击：
     * 1) 设置当前节点（current）
     * 2) 根据配置决定是否点击展开
     * 3) 根据配置决定是否点击勾选
     * 4) 触发 node-click 事件
     */
    const handleClick = (e: MouseEvent) => {
      handleCurrentChange(tree.store, tree.ctx.emit, () => {
        const nodeKeyProp = tree?.props?.nodeKey
        if (nodeKeyProp) {
          const curNodeKey = getNodeKey(props.node)
          tree.store.value.setCurrentNodeKey(curNodeKey)
        } else {
          tree.store.value.setCurrentNode(props.node)
        }
      })
      tree.currentNode.value = props.node

      if (tree.props.expandOnClickNode) {
        handleExpandIconClick()
      }

      if (
        (tree.props.checkOnClickNode ||
          (props.node.isLeaf &&
            tree.props.checkOnClickLeaf &&
            props.showCheckbox)) &&
        !props.node.disabled
      ) {
        handleCheckChange(!props.node.checked)
      }
      tree.ctx.emit('node-click', props.node.data, props.node, instance, e)
    }

    const handleContextMenu = (event: Event) => {
      if (tree.instance.vnode.props?.['onNodeContextmenu']) {
        event.stopPropagation()
        event.preventDefault()
      }
      tree.ctx.emit(
        'node-contextmenu',
        event,
        props.node.data,
        props.node,
        instance
      )
    }

    /**
     * 处理展开图标点击：
     * - 叶子节点不响应
     * - 折叠：先发出 node-collapse，再调用 Node.collapse()
     * - 展开：调用 Node.expand()（可能触发懒加载），完成后抛出 node-expand
     */
    const handleExpandIconClick = () => {
      if (props.node.isLeaf) return
      if (expanded.value) {
        tree.ctx.emit('node-collapse', props.node.data, props.node, instance)
        props.node.collapse()
      } else {
        props.node.expand(() => {
          ctx.emit('node-expand', props.node.data, props.node, instance)
        })
      }
    }

    /**
     * 处理勾选变化：
     * - checkStrictly=false 时会级联更新父子节点勾选状态
     * - nextTick 后抛出 check 事件，并携带当前全量选中/半选集合
     */
    const handleCheckChange = (value: CheckboxValueType) => {
      props.node.setChecked(value as boolean, !tree?.props.checkStrictly)
      nextTick(() => {
        const store = tree.store.value
        tree.ctx.emit('check', props.node.data, {
          checkedNodes: store.getCheckedNodes(),
          checkedKeys: store.getCheckedKeys(),
          halfCheckedNodes: store.getHalfCheckedNodes(),
          halfCheckedKeys: store.getHalfCheckedKeys(),
        })
      })
    }

    const handleChildNodeExpand = (
      nodeData: TreeNodeData,
      node: Node,
      instance: ComponentInternalInstance
    ) => {
      broadcastExpanded(node)
      tree.ctx.emit('node-expand', nodeData, node, instance)
    }

    const handleDragStart = (event: DragEvent) => {
      if (!tree.props.draggable) return
      dragEvents.treeNodeDragStart({ event, treeNode: props })
    }

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
      if (!tree.props.draggable) return
      dragEvents.treeNodeDragOver({
        event,
        treeNode: { $el: node$.value, node: props.node },
      })
    }

    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
    }

    const handleDragEnd = (event: DragEvent) => {
      if (!tree.props.draggable) return
      dragEvents.treeNodeDragEnd(event)
    }

    return {
      ns,
      node$,
      tree,
      expanded,
      childNodeRendered,
      oldChecked,
      oldIndeterminate,
      getNodeKey,
      getNodeClass,
      handleSelectChange,
      handleClick,
      handleContextMenu,
      handleExpandIconClick,
      handleCheckChange,
      handleChildNodeExpand,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      CaretRight,
    }
  },
})
</script>
