/*
  文件：packages/components/message/src/instance.ts
  作用：维护 ElMessage 的运行时实例队列（按 placement 分组），并提供堆叠偏移相关的辅助方法。

  设计说明：
  - placementInstances：以 placement 为维度的浅响应式字典，每个 placement 对应一个消息实例数组。
  - getLastOffset/getOffsetOrSpace：用于 message.vue 计算每条消息的 top/bottom 偏移，实现“逐条堆叠”。
*/
import { shallowReactive } from 'vue'

import type { ComponentInternalInstance, VNode } from 'vue'
import type { Mutable } from '@element-plus/utils'
import type { MessageHandler, MessagePlacement, MessageProps } from './message'

export type MessageContext = {
  id: string
  vnode: VNode
  handler: MessageHandler
  vm: ComponentInternalInstance
  props: Mutable<MessageProps>
}

// 按 placement 分组维护的实例队列（浅响应式：只关心数组/键的变更，不深追踪实例内部）
export const placementInstances = shallowReactive(
  {} as Record<MessagePlacement, MessageContext[]>
)

/**
 * 获取指定 placement 的实例队列（不存在则创建）
 */
export const getOrCreatePlacementInstances = (placement: MessagePlacement) => {
  if (!placementInstances[placement]) {
    placementInstances[placement] = shallowReactive([])
  }
  return placementInstances[placement]
}

/**
 * 获取当前实例与其前一个实例（同 placement 队列内）
 * 说明：堆叠布局需要上一条消息的 bottom 值来计算当前消息的偏移。
 */
export const getInstance = (id: string, placement: MessagePlacement) => {
  const instances = placementInstances[placement] || []
  const idx = instances.findIndex((instance) => instance.id === id)
  const current = instances[idx]
  let prev: MessageContext | undefined
  if (idx > 0) {
    prev = instances[idx - 1]
  }
  return { current, prev }
}

/**
 * 获取当前消息在该 placement 下的“上一条消息的底部偏移”
 * 说明：message.vue 通过 defineExpose 暴露 bottom（自身高度 + 自身 offset），用于下一条消息继续往下堆叠。
 */
export const getLastOffset = (
  id: string,
  placement: MessagePlacement
): number => {
  const { prev } = getInstance(id, placement)
  if (!prev) return 0
  return prev.vm.exposed!.bottom.value
}

/**
 * 获取当前消息的起始偏移：
 * - 队列中第一个消息使用 props.offset
 * - 其余消息使用固定间距 16（作为消息间距），避免每条都叠加 offset 导致过大间隔
 */
export const getOffsetOrSpace = (
  id: string,
  offset: number,
  placement: MessagePlacement
) => {
  const instances = placementInstances[placement] || []
  const idx = instances.findIndex((instance) => instance.id === id)
  return idx > 0 ? 16 : offset
}
