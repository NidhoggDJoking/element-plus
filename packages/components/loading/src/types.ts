/*
  文件：packages/components/loading/src/types.ts
  作用：定义 Loading 相关类型（解析后配置、外部传入配置、父元素扩展字段）。
*/
import type { MaybeRef } from '@vueuse/core'

export type LoadingOptionsResolved = {
  parent: LoadingParentElement
  /**
   * @description 遮罩层背景色
   */
  background: MaybeRef<string>
  svg: MaybeRef<string>
  svgViewBox: MaybeRef<string>
  /**
   * @description 自定义加载图标类名/内容
   */
  spinner: MaybeRef<boolean | string>
  /**
   * @description 加载文案（显示在 spinner 下方）
   */
  text: MaybeRef<string>
  /**
   * @description 是否全屏（等同于 v-loading.fullscreen）
   */
  fullscreen: boolean
  /**
   * @description 是否锁定滚动（等同于 v-loading.lock）
   */
  lock: boolean
  /**
   * @description 自定义样式类名
   */
  customClass: MaybeRef<string>
  visible: boolean
  target: HTMLElement
  beforeClose?: () => boolean
  closed?: () => void
}
export type LoadingOptions = Partial<
  Omit<LoadingOptionsResolved, 'parent' | 'target'> & {
    /**
     * @description 需要覆盖的目标节点：可传 DOM 或选择器字符串（会使用 document.querySelector 获取）
     */
    target: HTMLElement | string
    /**
     * @description 是否以 body 为遮罩父容器（等同于 v-loading.body）
     */
    body: boolean
  }
>

export interface LoadingParentElement extends HTMLElement {
  vLoadingAddClassList?: () => void
}
