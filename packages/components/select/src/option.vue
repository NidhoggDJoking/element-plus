<!--
  @sfc-doc
  文件：packages/components/select/src/option.vue
  作用：Select 下拉面板的单个选项（Option）渲染与交互承载。
  关键点：
  1) 选项的“可见/悬浮/禁用/选中”状态来源于 useOption 组合式逻辑；此处主要负责把状态映射到 DOM 与样式。
  2) 组件实例会注册到 Select 的 options/cachedOptions 中；卸载时需要做缓存清理，避免陈旧引用导致的错选/内存增长。
  3) 通过 aria-* 与 role="option" 提供无障碍语义，配合 Select 的 listbox 形成可访问结构。
-->
<template>
  <li
    v-show="visible"
    :id="id"
    :class="containerKls"
    role="option"
    :aria-disabled="isDisabled || undefined"
    :aria-selected="itemSelected"
    @mousemove="hoverItem"
    @click.stop="selectOptionClick"
  >
    <!--
      默认展示 currentLabel；业务方可通过默认插槽完全接管展示内容。
      注意：插槽内一般不建议再做阻止冒泡的点击逻辑，以免影响 Select 的选中行为。
    -->
    <slot>
      <span>{{ currentLabel }}</span>
    </slot>
  </li>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  reactive,
  toRefs,
  unref,
} from 'vue'
import { useId, useNamespace } from '@element-plus/hooks'
import { useOption } from './useOption'
import { COMPONENT_NAME, optionProps } from './option'

import type {
  OptionExposed,
  OptionInternalInstance,
  OptionStates,
} from './type'

export default defineComponent({
  name: COMPONENT_NAME,
  componentName: COMPONENT_NAME,

  props: optionProps,

  setup(props) {
    const ns = useNamespace('select')
    const id = useId()

    // 选项容器的类名组合：基础块 + 禁用/选中/悬浮三类状态
    const containerKls = computed(() => [
      ns.be('dropdown', 'item'),
      ns.is('disabled', unref(isDisabled)),
      ns.is('selected', unref(itemSelected)),
      ns.is('hovering', unref(hover)),
    ])

    // 选项内部状态：由 useOption 与 Select 逻辑共同维护
    const states = reactive<OptionStates>({
      index: -1,
      groupDisabled: false,
      visible: true,
      hover: false,
    })

    // useOption 负责：计算 label/禁用/选中、处理 hover、把选项注册到 Select 上下文等
    const {
      currentLabel,
      itemSelected,
      isDisabled,
      select,
      hoverItem,
      updateOption,
    } = useOption(props, states)

    const { visible, hover } = toRefs(states)

    // 这里拿到 Option 组件的公开实例（proxy），用于向 Select 注册/销毁
    const vm = (getCurrentInstance()! as OptionInternalInstance).proxy

    // 选项创建时注册到 Select（用于构建 optionsMap、cachedOptions、以及键盘导航）
    select.onOptionCreate(vm)

    onBeforeUnmount(() => {
      const key = vm.value

      // 卸载清理：如果该 option 已不在选中集合里，则从 cachedOptions 移除
      // 使用 nextTick 是为了等待“选中状态/选项列表”在同一轮更新内稳定，避免误删仍被选中的项
      nextTick(() => {
        const { selected: selectedOptions } = select.states
        const doesSelected = selectedOptions.some((item) => {
          return item.value === vm.value
        })
        if (select.states.cachedOptions.get(key) === vm && !doesSelected) {
          select.states.cachedOptions.delete(key)
        }
      })

      // 通知 Select 销毁该 option（同步从 optionsMap 等结构移除）
      select.onOptionDestroy(key, vm)
    })

    /**
     * 处理鼠标点击选项：在未禁用时通知 Select 执行选中逻辑
     */
    function selectOptionClick() {
      if (!isDisabled.value) {
        select.handleOptionSelect(vm)
      }
    }

    return {
      ns,
      id,
      containerKls,
      currentLabel,
      itemSelected,
      isDisabled,
      select,
      visible,
      hover,
      states,

      hoverItem,
      updateOption,
      selectOptionClick,
    } satisfies OptionExposed
  },
})
</script>
