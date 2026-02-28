<!--
  @sfc-doc
  文件：packages/components/select/src/option-group.vue
  作用：Select 下拉面板的选项分组容器（OptionGroup）。
  关键点：
  1) 通过 provide(selectGroupKey) 向分组内的 ElOption 下发 label/disabled 等上下文。
  2) 分组本身是否显示，取决于其子选项是否至少存在一个 visible === true。
  3) 子选项可能被 slot、条件渲染、组件包装等多层结构包裹，因此需要递归地从 VNode 树中“扁平化”收集 Option 实例。
-->
<template>
  <!--
    v-show：分组容器仅在内部至少有一个可见选项时才显示
    ref：用于 MutationObserver 监听 DOM 结构变化，触发子选项重新收集
  -->
  <ul v-show="visible" ref="groupRef" :class="ns.be('group', 'wrap')">
    <!-- 分组标题：只负责展示，不参与选中交互 -->
    <li :class="ns.be('group', 'title')">{{ label }}</li>
    <li>
      <ul :class="ns.b('group')">
        <!-- 分组内容：由用户插入 ElOption/自定义结构 -->
        <slot />
      </ul>
    </li>
  </ul>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  getCurrentInstance,
  isVNode,
  onMounted,
  provide,
  reactive,
  ref,
  toRefs,
} from 'vue'
import { useMutationObserver } from '@vueuse/core'
import { ensureArray, isArray } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { selectGroupKey } from './token'

import type { Component, VNode, VNodeArrayChildren } from 'vue'
import type { OptionInternalInstance, OptionPublicInstance } from './type'

export default defineComponent({
  name: 'ElOptionGroup',
  componentName: 'ElOptionGroup',

  props: {
    /**
     * @description 分组标题文案
     */
    label: String,
    /**
     * @description 是否禁用整个分组（分组内所有 option 都会视为禁用）
     */
    disabled: Boolean,
  },
  setup(props) {
    const ns = useNamespace('select')
    const groupRef = ref<HTMLElement>()
    const instance = getCurrentInstance()!

    // 分组内收集到的 Option 公开实例列表（用于判断 visible 等信息）
    const children = ref<OptionPublicInstance[]>([])

    // 向后代 option 提供分组上下文（label/disabled）
    provide(
      selectGroupKey,
      reactive({
        ...toRefs(props),
      })
    )

    // 分组是否可见：至少存在一个可见 option
    const visible = computed(() =>
      children.value.some((option) => option.visible === true)
    )

    // 判断某个 VNode 是否为 ElOption，并且已挂载拿得到 proxy
    const isOption = (
      node: VNode
    ): node is VNode & { component: OptionInternalInstance } =>
      (node.type as Component).name === 'ElOption' && !!node.component?.proxy

    /**
     * 扁平化收集 node 内的所有 ElOption 组件实例（proxy）
     * 说明：slot/包装组件/条件渲染可能导致 option 不在同一层级，需要递归处理 children/subTree
     */
    const flattedChildren = (node: VNode | VNodeArrayChildren) => {
      const nodes = ensureArray(node) as VNode[] | VNodeArrayChildren
      const children: OptionPublicInstance[] = []

      nodes.forEach((child) => {
        if (!isVNode(child)) return

        if (isOption(child)) {
          children.push(child.component.proxy)
        } else if (isArray(child.children) && child.children.length) {
          children.push(...flattedChildren(child.children))
        } else if (child.component?.subTree) {
          children.push(...flattedChildren(child.component.subTree))
        }
      })

      return children
    }

    /**
     * 重新扫描并更新 children 列表
     */
    const updateChildren = () => {
      children.value = flattedChildren(instance.subTree)
    }

    onMounted(() => {
      updateChildren()
    })

    // 监听分组 DOM 结构变化：当 slot 内容增删/属性变化时，重新收集 option
    useMutationObserver(groupRef, updateChildren, {
      attributes: true,
      subtree: true,
      childList: true,
    })

    return {
      groupRef,
      visible,
      ns,
    }
  },
})
</script>
