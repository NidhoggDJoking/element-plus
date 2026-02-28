/*
  文件：packages/components/message/src/method.ts
  作用：ElMessage 的对外调用入口（message(options)）与实例创建/分组/关闭控制。

  核心流程：
  1) normalizeOptions：把多种入参形态统一为 MessageParamsNormalized（补齐默认值、处理 appendTo/placement、合并全局配置）。
  2) getOrCreatePlacementInstances：按 placement 维度维护实例队列，用于计算堆叠偏移与分组。
  3) createMessage：创建并挂载 Message 组件，返回包含 handler.close 的上下文对象。
  4) closeAll/closeAllByPlacement：提供批量关闭能力。

  注意：此文件与 Notification 的实现模式类似（未来可考虑抽象以减少重复）。
*/
import { createVNode, isVNode, render } from 'vue'
import {
  debugWarn,
  hasOwn,
  isBoolean,
  isClient,
  isElement,
  isFunction,
  isNumber,
  isString,
} from '@element-plus/utils'
import { messageConfig } from '@element-plus/components/config-provider'
import MessageConstructor from './message.vue'
import {
  MESSAGE_DEFAULT_PLACEMENT,
  messageDefaults,
  messagePlacement,
  messageTypes,
} from './message'
import { getOrCreatePlacementInstances, placementInstances } from './instance'

import type { MessageContext } from './instance'
import type { AppContext } from 'vue'
import type {
  Message,
  MessageFn,
  MessageHandler,
  MessageOptions,
  MessageParams,
  MessageParamsNormalized,
  MessagePlacement,
  MessageType,
} from './message'

let seed = 1

// TODO：Notify.ts 与此文件实现模式高度相似，可考虑抽象公共创建/队列管理逻辑以减少重复。

/**
 * 归一化 appendTo：
 * - 未传时默认挂载到 document.body
 * - 传入字符串选择器时尝试 querySelector，并在无效时回退到 document.body
 */
const normalizeAppendTo = (normalized: MessageOptions) => {
  const appendTo = normalized.appendTo
  if (!appendTo) {
    normalized.appendTo = document.body
  } else if (isString(normalized.appendTo)) {
    let appendTo = document.querySelector<HTMLElement>(normalized.appendTo)

    // should fallback to default value with a warning
    if (!isElement(appendTo)) {
      debugWarn(
        'ElMessage',
        'the appendTo option is not an HTMLElement. Falling back to document.body.'
      )
      appendTo = document.body
    }
    normalized.appendTo = appendTo
  }
}

/**
 * 归一化 placement：
 * - 优先使用调用方传入的 placement
 * - 否则尝试读取全局 messageConfig.placement
 * - 最终兜底为 MESSAGE_DEFAULT_PLACEMENT，并对非法值给出告警后回退
 */
const normalizePlacement = (normalized: MessageOptions) => {
  // 未显式传 placement 且存在全局配置时，使用全局配置
  if (
    !normalized.placement &&
    isString(messageConfig.placement) &&
    messageConfig.placement
  ) {
    normalized.placement = messageConfig.placement as
      | MessagePlacement
      | undefined
  }
  // 未显式传 placement 且全局无配置时，使用默认值
  if (!normalized.placement) {
    normalized.placement = MESSAGE_DEFAULT_PLACEMENT
  }
  // placement 非法时回退到默认值，并给出告警
  if (!messagePlacement.includes(normalized.placement!)) {
    debugWarn(
      'ElMessage',
      `Invalid placement: ${normalized.placement}. Falling back to '${MESSAGE_DEFAULT_PLACEMENT}'.`
    )
    normalized.placement = MESSAGE_DEFAULT_PLACEMENT
  }
}

/**
 * 归一化调用参数：
 * - 支持字符串/VNode/渲染函数等快捷写法（会被包装为 { message }）
 * - 合并 messageDefaults 与调用方 options
 * - 应用 appendTo/placement 规则
 * - 在调用方未显式覆盖时合并全局 messageConfig（grouping/duration/offset/showClose/plain/max）
 */
const normalizeOptions = (params?: MessageParams) => {
  const options: MessageOptions =
    !params || isString(params) || isVNode(params) || isFunction(params)
      ? { message: params }
      : params

  const normalized: MessageOptions = {
    ...messageDefaults,
    ...options,
  }

  normalizeAppendTo(normalized)
  normalizePlacement(normalized)

  // 当全局开启 grouping 时：
  // - 若调用方未显式开启 grouping（默认 false），则允许全局配置覆盖
  // - 若调用方显式指定 grouping，则以调用方为准
  if (isBoolean(messageConfig.grouping) && !normalized.grouping) {
    normalized.grouping = messageConfig.grouping
  }
  if (isNumber(messageConfig.duration) && normalized.duration === 3000) {
    normalized.duration = messageConfig.duration
  }
  if (isNumber(messageConfig.offset) && normalized.offset === 16) {
    normalized.offset = messageConfig.offset
  }
  if (isBoolean(messageConfig.showClose) && !normalized.showClose) {
    normalized.showClose = messageConfig.showClose
  }
  if (isBoolean(messageConfig.plain) && !normalized.plain) {
    normalized.plain = messageConfig.plain
  }

  return normalized as MessageParamsNormalized
}

/**
 * 从实例队列中移除指定 message，并触发其组件关闭流程
 */
const closeMessage = (instance: MessageContext) => {
  const placement = instance.props.placement || MESSAGE_DEFAULT_PLACEMENT
  const instances = placementInstances[placement]

  const idx = instances.indexOf(instance)
  if (idx === -1) return
  instances.splice(idx, 1)
  const { handler } = instance
  handler.close()
}

/**
 * 创建并挂载一个 Message 实例
 * - 生成唯一 id
 * - 组装组件 props（封装 onClose/onDestroy）
 * - createVNode + render 挂载到临时 container，再 append 到 appendTo
 * - 返回 MessageContext（含 handler.close）供外部控制
 */
const createMessage = (
  { appendTo, ...options }: MessageParamsNormalized,
  context?: AppContext | null
): MessageContext => {
  const id = `message_${seed++}`
  const userOnClose = options.onClose

  const container = document.createElement('div')

  const props = {
    ...options,
    // zIndex 由 message.vue 内部的 useGlobalComponentSettings 统一管理，这里仅透传配置
    id,

    // 关闭回调：先执行用户传入的 onClose，再从队列中移除当前实例
    onClose: () => {
      userOnClose?.()
      closeMessage(instance)
    },

    // 组件销毁后清理挂载点：render(null) 解除 VNode 与 DOM 关联，避免残留引用造成内存增长
    onDestroy: () => {
      render(null, container)
    },
  }
  const vnode = createVNode(
    MessageConstructor,
    props,
    isFunction(props.message) || isVNode(props.message)
      ? {
          default: isFunction(props.message)
            ? props.message
            : () => props.message,
        }
      : null
  )
  vnode.appContext = context || message._context

  render(vnode, container)
  // instances will remove this item when close function gets called. So we do not need to worry about it.
  appendTo.appendChild(container.firstElementChild!)

  const vm = vnode.component!

  const handler: MessageHandler = {
    // 通过调用组件暴露的 close() 触发完整的过渡与销毁生命周期
    close: () => {
      vm.exposed!.close()
    },
  }

  const instance: MessageContext = {
    id,
    vnode,
    vm,
    handler,
    props: (vnode.component as any).props,
  }

  return instance
}

// message 主函数：负责入参归一化、分组复用、数量上限控制、以及创建并入队
const message: MessageFn &
  Partial<Message> & { _context: AppContext | null } = (
  options = {},
  context
) => {
  if (!isClient) return { close: () => undefined }

  const normalized = normalizeOptions(options)
  const instances = getOrCreatePlacementInstances(
    normalized.placement || MESSAGE_DEFAULT_PLACEMENT
  )

  // grouping：相同 message 文本时复用既有实例，仅增加 repeatNum 并同步 type
  if (normalized.grouping && instances.length) {
    const instance = instances.find(
      ({ vnode: vm }) => vm.props?.message === normalized.message
    )
    if (instance) {
      instance.props.repeatNum += 1
      instance.props.type = normalized.type
      return instance.handler
    }
  }

  // 最大数量限制：达到上限时不再创建新实例
  if (isNumber(messageConfig.max) && instances.length >= messageConfig.max) {
    return { close: () => undefined }
  }

  const instance = createMessage(normalized, context)

  instances.push(instance)
  return instance.handler
}

messageTypes.forEach((type) => {
  message[type] = (options = {}, appContext) => {
    const normalized = normalizeOptions(options)
    return message({ ...normalized, type }, appContext)
  }
})

/**
 * 关闭所有 Message（可选按类型过滤）
 */
export function closeAll(type?: MessageType): void {
  for (const placement in placementInstances) {
    if (hasOwn(placementInstances, placement)) {
      // 复制一份数组，避免迭代过程中 close 导致的队列变更影响遍历
      const instances: MessageContext[] = [...placementInstances[placement]]
      for (const instance of instances) {
        if (!type || type === instance.props.type) {
          instance.handler.close()
        }
      }
    }
  }
}

/**
 * 按 placement 关闭该位置上的所有 Message
 */
export function closeAllByPlacement(placement: MessagePlacement) {
  if (!placementInstances[placement]) return
  // 复制一份数组，避免迭代过程中 close 导致的队列变更影响遍历
  const instances = [...placementInstances[placement]]
  instances.forEach((instance) => instance.handler.close())
}

message.closeAll = closeAll
message.closeAllByPlacement = closeAllByPlacement
message._context = null

export default message as Message
