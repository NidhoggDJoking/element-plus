<!--
  @sfc-doc
  文件：packages/components/select/src/select-dropdown.vue
  作用：Select 的下拉面板容器（仅负责外层结构与宽度控制）。
  关键点：
  1) 宽度策略：fitInputWidth=true 时使用 width 固定等于输入框宽度；否则使用 min-width 保证下拉不小于输入框。
  2) 通过 ResizeObserver 监听 selectRef 尺寸变化，动态更新 minWidth，避免窗口缩放/布局变化造成错位。
  3) 支持 header/footer 具名插槽：用于扩展下拉面板顶部/底部内容（例如全选、操作区）。
-->
<template>
  <div
    :class="[ns.b('dropdown'), ns.is('multiple', isMultiple), popperClass]"
    :style="{ [isFitInputWidth ? 'width' : 'minWidth']: minWidth }"
  >
    <!-- header 插槽：仅在提供该插槽时渲染 -->
    <div v-if="$slots.header" :class="ns.be('dropdown', 'header')">
      <slot name="header" />
    </div>

    <!-- 默认插槽：Select 的实际选项列表内容由上层组件注入 -->
    <slot />

    <!-- footer 插槽：仅在提供该插槽时渲染 -->
    <div v-if="$slots.footer" :class="ns.be('dropdown', 'footer')">
      <slot name="footer" />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, inject, onMounted, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useNamespace } from '@element-plus/hooks'
import { selectKey } from './token'

export default defineComponent({
  name: 'ElSelectDropdown',

  componentName: 'ElSelectDropdown',

  setup() {
    const select = inject(selectKey)!
    const ns = useNamespace('select')

    // 透传来自 Select 的关键 props
    const popperClass = computed(() => select.props.popperClass)
    const isMultiple = computed(() => select.props.multiple)
    const isFitInputWidth = computed(() => select.props.fitInputWidth)

    // 下拉面板宽度（px 字符串），由 updateMinWidth 统一更新
    const minWidth = ref('')

    /**
     * 更新下拉面板宽度：以 select 容器的 offsetWidth 为准
     */
    function updateMinWidth() {
      minWidth.value = `${select.selectRef?.offsetWidth}px`
    }

    onMounted(() => {
      // 初始化时立即同步一次宽度
      updateMinWidth()

      // 监听 select 容器尺寸变化（如窗口缩放/父容器布局变化），持续更新宽度
      useResizeObserver(select.selectRef, updateMinWidth)

      // TODO: 若后续需要在宽度变化时强制更新 popper 位置，可在此处补齐 updatePopper
      // popper.value.update()
    })

    return {
      ns,
      minWidth,
      popperClass,
      isMultiple,
      isFitInputWidth,
    }
  },
})
</script>
