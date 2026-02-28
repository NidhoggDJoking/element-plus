/*
  文件：packages/components/message/src/message.ts
  作用：定义 ElMessage 的类型、可选值、默认值、props/emits 以及对外调用签名。

  说明：
  - messageDefaults：运行时默认配置（创建实例时会被 method.ts 合并与归一化）。
  - messageProps：Message 组件的 props 定义（供 message.vue 使用）。
  - MessageFn/Message：对外方法类型（message() 以及 message.success/info 等快捷方法）。
*/
import {
  buildProps,
  definePropType,
  iconPropType,
  isClient,
  mutable,
} from '@element-plus/utils'

import type {
  AppContext,
  ExtractPropTypes,
  VNode,
  __ExtractPublicPropTypes,
} from 'vue'
import type { Mutable } from '@element-plus/utils'
import type MessageConstructor from './message.vue'

export const messageTypes = [
  'primary',
  'success',
  'info',
  'warning',
  'error',
] as const

export const messagePlacement = [
  'top',
  'top-left',
  'top-right',
  'bottom',
  'bottom-left',
  'bottom-right',
] as const

export const MESSAGE_DEFAULT_PLACEMENT = 'top'

export type MessageType = typeof messageTypes[number]
export type MessagePlacement = typeof messagePlacement[number]
/** @deprecated 请使用 `MessageType`，该别名将在 3.0.0 移除 */
export type messageType = MessageType

export interface MessageConfigContext {
  max?: number
  grouping?: boolean
  duration?: number
  offset?: number
  showClose?: boolean
  plain?: boolean
  placement?: string
}

// Message 的运行时默认值：
// - method.ts 会以此为基础合并调用参数与全局配置
// - appendTo 在非浏览器环境下不可用，因此使用 isClient 做保护
export const messageDefaults = mutable({
  customClass: '',
  dangerouslyUseHTMLString: false,
  duration: 3000,
  icon: undefined,
  id: '',
  message: '',
  onClose: undefined,
  showClose: false,
  type: 'info',
  plain: false,
  offset: 16,
  placement: undefined,
  zIndex: 0,
  grouping: false,
  repeatNum: 1,
  appendTo: isClient ? document.body : (undefined as never),
} as const)

export const messageProps = buildProps({
  /**
   * @description Message 的自定义 class
   */
  customClass: {
    type: String,
    default: messageDefaults.customClass,
  },
  /**
   * @description 是否将 message 按 HTML 字符串渲染（存在 XSS 风险，请勿使用不可信输入）
   */
  dangerouslyUseHTMLString: {
    type: Boolean,
    default: messageDefaults.dangerouslyUseHTMLString,
  },
  /**
   * @description 展示时长（毫秒）；为 0 时不自动关闭
   */
  duration: {
    type: Number,
    default: messageDefaults.duration,
  },
  /**
   * @description 自定义图标组件（传入后会覆盖 type 默认图标）
   */
  icon: {
    type: iconPropType,
    default: messageDefaults.icon,
  },
  /**
   * @description message DOM id（由 method.ts 生成并注入）
   */
  id: {
    type: String,
    default: messageDefaults.id,
  },
  /**
   * @description message 内容：支持字符串 / VNode / 返回 VNode 的函数
   */
  message: {
    type: definePropType<string | VNode | (() => VNode)>([
      String,
      Object,
      Function,
    ]),
    default: messageDefaults.message,
  },
  /**
   * @description 关闭回调（由 method.ts 包装后在关闭流程中触发）
   */
  onClose: {
    type: definePropType<() => void>(Function),
    default: messageDefaults.onClose,
  },
  /**
   * @description 是否显示关闭按钮
   */
  showClose: {
    type: Boolean,
    default: messageDefaults.showClose,
  },
  /**
   * @description 消息类型（影响主题色与默认图标）
   */
  type: {
    type: String,
    values: messageTypes,
    default: messageDefaults.type,
  },
  /**
   * @description 是否为朴素样式（plain）
   */
  plain: {
    type: Boolean,
    default: messageDefaults.plain,
  },
  /**
   * @description 距离视口顶部/底部的起始偏移（第一个消息使用该值）
   */
  offset: {
    type: Number,
    default: messageDefaults.offset,
  },
  /**
   * @description 消息出现位置（placement）
   */
  placement: {
    type: String,
    values: messagePlacement,
    default: messageDefaults.placement,
  },
  /**
   * @description z-index 增量（最终 zIndex 由 message.vue 内部统一计算）
   */
  zIndex: {
    type: Number,
    default: messageDefaults.zIndex,
  },
  /**
   * @description 是否合并相同内容的消息（VNode 类型的 message 不支持合并）
   */
  grouping: {
    type: Boolean,
    default: messageDefaults.grouping,
  },
  /**
   * @description 重复次数（配合 grouping 使用，类似 Badge 的计数展示）
   */
  repeatNum: {
    type: Number,
    default: messageDefaults.repeatNum,
  },
} as const)
export type MessageProps = ExtractPropTypes<typeof messageProps>
export type MessagePropsPublic = __ExtractPublicPropTypes<typeof messageProps>

export const messageEmits = {
  destroy: () => true,
}
export type MessageEmits = typeof messageEmits

export type MessageInstance = InstanceType<typeof MessageConstructor> & unknown

export type MessageOptions = Partial<
  Mutable<
    Omit<MessageProps, 'id'> & {
      appendTo?: HTMLElement | string
    }
  >
>
export type MessageParams = MessageOptions | MessageOptions['message']
export type MessageParamsNormalized = Omit<MessageProps, 'id'> & {
  /**
   * @description set the root element for the message, default to `document.body`
   */
  appendTo: HTMLElement
}
export type MessageOptionsWithType = Omit<MessageOptions, 'type'>
export type MessageParamsWithType =
  | MessageOptionsWithType
  | MessageOptions['message']

export interface MessageHandler {
  /**
   * @description close the Message
   */
  close: () => void
}

export type MessageFn = {
  (options?: MessageParams, appContext?: null | AppContext): MessageHandler
  closeAll(type?: MessageType): void
  closeAllByPlacement(position: MessagePlacement): void
}
export type MessageTypedFn = (
  options?: MessageParamsWithType,
  appContext?: null | AppContext
) => MessageHandler

export type Message = MessageFn & {
  primary: MessageTypedFn
  success: MessageTypedFn
  warning: MessageTypedFn
  info: MessageTypedFn
  error: MessageTypedFn
}
