/*
  文件：packages/components/loading/src/service.ts
  作用：Loading 服务入口（Loading(options)），负责创建/复用实例并处理样式与挂载。

  关键点：
  - fullscreen 模式下复用单例，避免重复创建覆盖遮罩。
  - 通过 addStyle/addClassList 设置定位与锁滚动样式。
  - 使用 loading-number 计数管理父元素样式回滚，避免多个 loading 叠加时互相干扰。
*/
// @ts-nocheck
import { nextTick } from 'vue'
import {
  addClass,
  getStyle,
  isClient,
  isString,
  removeClass,
} from '@element-plus/utils'
import { createLoadingComponent } from './loading'

import type { UseNamespaceReturn, UseZIndexReturn } from '@element-plus/hooks'
import type { LoadingInstance } from './loading'
import type { LoadingOptionsResolved } from '..'
import type { LoadingOptions } from './types'
import type { AppContext, CSSProperties } from 'vue'

let fullscreenInstance: LoadingInstance | undefined = undefined

// Loading 服务函数：创建并挂载 Loading 实例
const Loading = function (options: LoadingOptions = {}): LoadingInstance {
  if (!isClient) return undefined as any

  const resolved = resolveOptions(options)

  // fullscreen 复用单例，防止出现多个全屏遮罩叠加
  if (resolved.fullscreen && fullscreenInstance) {
    return fullscreenInstance
  }

  const instance = createLoadingComponent(
    {
      ...resolved,
      closed: () => {
        resolved.closed?.()
        if (resolved.fullscreen) fullscreenInstance = undefined
      },
    },
    Loading._context
  )

  addStyle(resolved, resolved.parent, instance)
  addClassList(resolved, resolved.parent, instance)

  // 记录补充样式方法，供后续子实例调用
  resolved.parent.vLoadingAddClassList = () =>
    addClassList(resolved, resolved.parent, instance)

  /**
   * 为父元素添加 loading-number 计数：
   * 说明：当 body 上已存在 v-loading.body，再触发全屏 loading 时，
   * 若直接移除 parent 的相对定位类会导致前者定位错误，因此通过计数控制回滚时机。
   */
  let loadingNumber: string | null =
    resolved.parent.getAttribute('loading-number')
  if (!loadingNumber) {
    loadingNumber = '1'
  } else {
    loadingNumber = `${Number.parseInt(loadingNumber) + 1}`
  }
  resolved.parent.setAttribute('loading-number', loadingNumber)

  resolved.parent.appendChild(instance.$el)

  // 在实例完成挂载后再切换 visible，触发过渡动画
  nextTick(() => (instance.visible.value = resolved.visible))

  if (resolved.fullscreen) {
    fullscreenInstance = instance
  }
  return instance
}

/**
 * 解析并补齐 LoadingOptions，得到内部使用的 LoadingOptionsResolved
 */
const resolveOptions = (options: LoadingOptions): LoadingOptionsResolved => {
  let target: HTMLElement
  if (isString(options.target)) {
    target =
      document.querySelector<HTMLElement>(options.target) ?? document.body
  } else {
    target = options.target || document.body
  }
  return {
    // parent：body 模式下固定为 document.body，否则为 target
    parent: target === document.body || options.body ? document.body : target,
    background: options.background || '',
    svg: options.svg || '',
    svgViewBox: options.svgViewBox || '',
    spinner: options.spinner || false,
    text: options.text || '',
    fullscreen: target === document.body && (options.fullscreen ?? true),
    lock: options.lock ?? false,
    customClass: options.customClass || '',
    visible: options.visible ?? true,
    beforeClose: options.beforeClose,
    closed: options.closed,
    target,
  }
}

const addStyle = async (
  options: LoadingOptionsResolved,
  parent: HTMLElement,
  instance: LoadingInstance
) => {
  // Compatible with the instance data format of vue@3.2.12 and earlier versions #12351
  const { nextZIndex } =
    ((instance.vm as any).zIndex as UseZIndexReturn) ||
    (instance.vm as any)._.exposed.zIndex

  const maskStyle: CSSProperties = {}
  if (options.fullscreen) {
    instance.originalPosition.value = getStyle(document.body, 'position')
    instance.originalOverflow.value = getStyle(document.body, 'overflow')
    maskStyle.zIndex = nextZIndex()
  } else if (options.parent === document.body) {
    instance.originalPosition.value = getStyle(document.body, 'position')
    /**
     * await dom render when visible is true in init,
     * because some component's height maybe 0.
     * e.g. el-table.
     */
    await nextTick()
    for (const property of ['top', 'left']) {
      const scroll = property === 'top' ? 'scrollTop' : 'scrollLeft'
      maskStyle[property] = `${
        (options.target as HTMLElement).getBoundingClientRect()[property] +
        document.body[scroll] +
        document.documentElement[scroll] -
        Number.parseInt(getStyle(document.body, `margin-${property}`), 10)
      }px`
    }
    for (const property of ['height', 'width']) {
      maskStyle[property] = `${
        (options.target as HTMLElement).getBoundingClientRect()[property]
      }px`
    }
  } else {
    instance.originalPosition.value = getStyle(parent, 'position')
  }
  for (const [key, value] of Object.entries(maskStyle)) {
    instance.$el.style[key] = value
  }
}

const addClassList = (
  options: LoadingOptions,
  parent: HTMLElement,
  instance: LoadingInstance
) => {
  // Compatible with the instance data format of vue@3.2.12 and earlier versions #12351
  const ns =
    ((instance.vm as any).ns as UseNamespaceReturn) ||
    (instance.vm as any)._.exposed.ns

  if (
    !['absolute', 'fixed', 'sticky'].includes(instance.originalPosition.value)
  ) {
    addClass(parent, ns.bm('parent', 'relative'))
  } else {
    removeClass(parent, ns.bm('parent', 'relative'))
  }
  if (options.fullscreen && options.lock) {
    addClass(parent, ns.bm('parent', 'hidden'))
  } else {
    removeClass(parent, ns.bm('parent', 'hidden'))
  }
}

Loading._context = null as AppContext | null
export default Loading
