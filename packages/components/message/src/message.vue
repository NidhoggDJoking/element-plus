<!--
  @sfc-doc
  文件：packages/components/message/src/message.vue
  作用：单个 Message 实例的 UI 与生命周期。

  交互与生命周期：
  - 挂载后自动显示，并基于 duration 计时自动关闭（duration=0 不自动关闭）。
  - 鼠标移入暂停计时，移出恢复计时。
  - ESC 键关闭（监听 document keydown）。
  - 关闭流程：visible=false 触发过渡；before-leave 调用 onClose；after-leave emit('destroy') 通知外层销毁。

  堆叠布局：
  - offset/bottom 由 instance.ts 的队列偏移计算，结合当前组件高度得到。
  - defineExpose 暴露 bottom 给后续实例计算堆叠位置。
-->
<template>
  <transition
    :name="ns.b('fade')"
    @before-enter="isStartTransition = true"
    @before-leave="onClose"
    @after-leave="$emit('destroy')"
  >
    <div
      v-show="visible"
      :id="id"
      ref="messageRef"
      :class="[
        ns.b(),
        { [ns.m(type)]: type },
        ns.is('closable', showClose),
        ns.is('plain', plain),
        ns.is('bottom', verticalProperty === 'bottom'),
        horizontalClass,
        customClass,
      ]"
      :style="customStyle"
      role="alert"
      @mouseenter="clearTimer"
      @mouseleave="startTimer"
    >
      <el-badge
        v-if="repeatNum > 1"
        :value="repeatNum"
        :type="badgeType"
        :class="ns.e('badge')"
      />
      <el-icon v-if="iconComponent" :class="[ns.e('icon'), typeClass]">
        <component :is="iconComponent" />
      </el-icon>
      <slot>
        <p v-if="!dangerouslyUseHTMLString" :class="ns.e('content')">
          {{ message }}
        </p>
        <!--
          安全提示：dangerouslyUseHTMLString=true 时会使用 v-html 渲染。
          请勿把不可信的用户输入直接作为 message 内容，以避免 XSS 风险。
        -->
        <p v-else :class="ns.e('content')" v-html="message" />
      </slot>
      <el-icon v-if="showClose" :class="ns.e('closeBtn')" @click.stop="close">
        <Close />
      </el-icon>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useEventListener, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { TypeComponents, TypeComponentsMap } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import ElBadge from '@element-plus/components/badge'
import { useGlobalComponentSettings } from '@element-plus/components/config-provider'
import { ElIcon } from '@element-plus/components/icon'
import {
  MESSAGE_DEFAULT_PLACEMENT,
  messageEmits,
  messageProps,
} from './message'
import { getLastOffset, getOffsetOrSpace } from './instance'

import type { BadgeProps } from '@element-plus/components/badge'
import type { CSSProperties } from 'vue'

const { Close } = TypeComponents

defineOptions({
  name: 'ElMessage',
})

const props = defineProps(messageProps)
const emit = defineEmits(messageEmits)

const isStartTransition = ref(false)

const { ns, zIndex } = useGlobalComponentSettings('message')
const { currentZIndex, nextZIndex } = zIndex

const messageRef = ref<HTMLDivElement>()
const visible = ref(false)
const height = ref(0)

let stopTimer: (() => void) | undefined = undefined

const badgeType = computed<BadgeProps['type']>(() =>
  props.type ? (props.type === 'error' ? 'danger' : props.type) : 'info'
)
const typeClass = computed(() => {
  const type = props.type
  return { [ns.bm('icon', type)]: type && TypeComponentsMap[type] }
})
const iconComponent = computed(
  () => props.icon || TypeComponentsMap[props.type] || ''
)

const placement = computed(() => props.placement || MESSAGE_DEFAULT_PLACEMENT)

const lastOffset = computed(() => getLastOffset(props.id, placement.value))
const offset = computed(() => {
  return (
    getOffsetOrSpace(props.id, props.offset, placement.value) + lastOffset.value
  )
})
const bottom = computed(() => height.value + offset.value)
const horizontalClass = computed(() => {
  if (placement.value.includes('left')) return ns.is('left')
  if (placement.value.includes('right')) return ns.is('right')
  return ns.is('center')
})

const verticalProperty = computed(() =>
  placement.value.startsWith('top') ? 'top' : 'bottom'
)

const customStyle = computed<CSSProperties>(() => ({
  [verticalProperty.value]: `${offset.value}px`,
  zIndex: currentZIndex.value,
}))

/**
 * 启动自动关闭计时器：duration=0 表示不自动关闭
 */
function startTimer() {
  if (props.duration === 0) return
  ;({ stop: stopTimer } = useTimeoutFn(() => {
    close()
  }, props.duration))
}

/**
 * 清理计时器：用于鼠标移入暂停、repeatNum 变更时重置等场景
 */
function clearTimer() {
  stopTimer?.()
}

/**
 * 关闭消息：
 * - 设置 visible=false 触发离场过渡
 * - 若从未进入过过渡（极端情况下），则 nextTick 后直接触发 onClose 并销毁
 */
function close() {
  visible.value = false

  // 若尚未开始过渡（例如快速创建后立刻关闭），则直接走销毁流程，避免残留 DOM
  nextTick(() => {
    if (!isStartTransition.value) {
      props.onClose?.()
      emit('destroy')
    }
  })
}

/**
 * 键盘处理：按下 ESC 关闭消息
 */
function keydown({ code }: KeyboardEvent) {
  if (code === EVENT_CODE.esc) {
    close()
  }
}

onMounted(() => {
  // 挂载后开始计时并提升层级，再显示消息
  startTimer()
  nextZIndex()
  visible.value = true
})

watch(
  () => props.repeatNum,
  () => {
    // grouping 场景下 repeatNum 增加时，重置计时器以延长展示时间
    clearTimer()
    startTimer()
  }
)

useEventListener(document, 'keydown', keydown)

useResizeObserver(messageRef, () => {
  // 监听高度变化（例如内容换行、repeatNum Badge 出现），用于更新堆叠布局 bottom
  height.value = messageRef.value!.getBoundingClientRect().height
})

defineExpose({
  visible,
  bottom,
  close,
})
</script>
