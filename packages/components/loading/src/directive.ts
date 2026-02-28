/*
  文件：packages/components/loading/src/directive.ts
  作用：v-loading 指令实现，负责根据绑定值创建/更新/销毁 Loading 实例。

  设计要点：
  - 使用 Symbol 作为实例缓存键，避免污染 DOM 属性名空间。
  - 支持三种配置来源：指令绑定对象、元素属性、指令修饰符（fullscreen/body/lock）。
  - 通过 ref 包装可响应的配置项，便于在 updated 阶段动态更新。
*/
// @ts-nocheck
import { isRef, ref } from 'vue'
import { hyphenate, isObject, isString } from '@element-plus/utils'
import Loading from './service'

import type { Directive, DirectiveBinding, UnwrapRef } from 'vue'
import type { LoadingOptions } from './types'
import type { LoadingInstance } from './loading'

// 私有实例缓存键：挂载到 DOM 节点上
const INSTANCE_KEY = Symbol('ElLoading')

// 将配置名转换为 element-loading-xxx 的属性名格式
const getAttributeName = (name: string) => {
  return `element-loading-${hyphenate(name)}`
}

export type LoadingBinding = boolean | UnwrapRef<LoadingOptions>
export interface ElementLoading extends HTMLElement {
  [INSTANCE_KEY]?: {
    instance: LoadingInstance
    options: LoadingOptions
  }
}

/**
 * 创建 Loading 实例并缓存到元素上
 */
const createInstance = (
  el: ElementLoading,
  binding: DirectiveBinding<LoadingBinding>
) => {
  const vm = binding.instance

  // 从指令绑定对象中读取配置项
  const getBindingProp = <K extends keyof LoadingOptions>(
    key: K
  ): LoadingOptions[K] =>
    isObject(binding.value) ? binding.value[key] : undefined

  // 解析表达式：
  // - 若 key 为字符串且在组件实例上有同名字段，则取实例字段（用于 v-loading="loadingText" 这类写法）
  // - 否则直接使用 key 本身
  const resolveExpression = (key: any) => {
    const data = (isString(key) && vm?.[key]) || key // 优先解析为组件实例字段
    return ref(data) // 包装为 ref，便于后续动态更新
  }

  // 从绑定对象或 DOM attribute 中读取配置项
  const getProp = <K extends keyof LoadingOptions>(name: K) =>
    resolveExpression(
      getBindingProp(name) || el.getAttribute(getAttributeName(name))
    )

  // fullscreen 优先级：绑定对象 > 指令修饰符
  const fullscreen =
    getBindingProp('fullscreen') ?? binding.modifiers.fullscreen

  const options: LoadingOptions = {
    text: getProp('text'),
    svg: getProp('svg'),
    svgViewBox: getProp('svgViewBox'),
    spinner: getProp('spinner'),
    background: getProp('background'),
    customClass: getProp('customClass'),
    fullscreen,
    target: getBindingProp('target') ?? (fullscreen ? undefined : el), // 全屏时 target 交由 service 处理
    body: getBindingProp('body') ?? binding.modifiers.body,
    lock: getBindingProp('lock') ?? binding.modifiers.lock,
  }

  const instance = Loading(options)
  instance._context = vLoading._context
  el[INSTANCE_KEY] = {
    options,
    instance,
  }
}

/**
 * 更新已存在实例的响应式配置（仅对 ref 类型字段生效）
 */
const updateOptions = (
  originalOptions: LoadingOptions,
  newOptions: UnwrapRef<LoadingOptions>
) => {
  for (const key of Object.keys(originalOptions)) {
    if (isRef(originalOptions[key]))
      originalOptions[key].value = newOptions[key]
  }
}

const vLoading: Directive<ElementLoading, LoadingBinding> = {
  mounted(el, binding) {
    // 初次挂载：当绑定值为 truthy 时创建 Loading
    if (binding.value) {
      createInstance(el, binding)
    }
  },
  updated(el, binding) {
    const instance = el[INSTANCE_KEY]

    // 绑定值变为 falsy：关闭并清理实例
    if (!binding.value) {
      instance?.instance.close()
      el[INSTANCE_KEY] = null
      return
    }

    if (!instance) createInstance(el, binding)
    else {
      // 已存在实例：根据新值或 DOM 属性更新配置
      updateOptions(
        instance.options,
        isObject(binding.value)
          ? binding.value
          : {
              text: el.getAttribute(getAttributeName('text')),
              svg: el.getAttribute(getAttributeName('svg')),
              svgViewBox: el.getAttribute(getAttributeName('svgViewBox')),
              spinner: el.getAttribute(getAttributeName('spinner')),
              background: el.getAttribute(getAttributeName('background')),
              customClass: el.getAttribute(getAttributeName('customClass')),
            }
      )
    }
  },
  unmounted(el) {
    // 元素卸载：兜底关闭并释放实例
    el[INSTANCE_KEY]?.instance.close()
    el[INSTANCE_KEY] = null
  },
}

vLoading._context = null
export default vLoading
