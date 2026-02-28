/*
  文件：packages/components/loading/src/loading.ts
  作用：创建 Loading 组件实例（应用于指令与服务调用），负责渲染与关闭销毁流程。

  说明：
  - createLoadingComponent 返回一个包含响应式状态与控制方法的实例对象。
  - 组件内部通过 Transition + vShow 控制显示/隐藏，并在离场结束后清理 DOM。
*/
import {
  Transition,
  createApp,
  createVNode,
  defineComponent,
  h,
  reactive,
  ref,
  toRefs,
  vShow,
  withCtx,
  withDirectives,
} from 'vue'
import { removeClass } from '@element-plus/utils'
import { useGlobalComponentSettings } from '@element-plus/components/config-provider'

import type { AppContext } from 'vue'
import type { UseNamespaceReturn } from '@element-plus/hooks'
import type { LoadingOptionsResolved } from './types'

/**
 * 创建 Loading 组件实例：
 * - 根据 options 初始化响应式状态
 * - 通过 createApp 动态挂载组件
 * - 暴露 close/setText 等方法供外部控制
 */
export function createLoadingComponent(
  options: LoadingOptionsResolved,
  appContext: AppContext | null
) {
  let afterLeaveTimer: ReturnType<typeof setTimeout>

  // 重要说明：这里只是为了向实例暴露注入信息的权宜实现，请勿在业务代码中照搬
  const afterLeaveFlag = ref(false)
  const data = reactive({
    ...options,
    originalPosition: '',
    originalOverflow: '',
    visible: false,
  })

  /**
   * 动态更新加载文案
   */
  function setText(text: string) {
    data.text = text
  }

  /**
   * 销毁当前实例：
   * - 维护 parent 的 loading-number 计数与样式类
   * - 移除 DOM 并卸载应用实例
   */
  function destroySelf() {
    const target = data.parent
    const ns = (vm as any).ns as UseNamespaceReturn

    if (!target.vLoadingAddClassList) {
      let loadingNumber: number | string | null =
        target.getAttribute('loading-number')
      loadingNumber = Number.parseInt(loadingNumber as any) - 1 // 递减计数

      if (!loadingNumber) {
        removeClass(target, ns.bm('parent', 'relative'))
        target.removeAttribute('loading-number')
      } else {
        target.setAttribute('loading-number', loadingNumber.toString())
      }

      // 解除锁定滚动的样式类
      removeClass(target, ns.bm('parent', 'hidden'))
    }

    removeElLoadingChild()
    loadingInstance.unmount()
  }

  /**
   * 从 DOM 中移除 Loading 根节点
   */
  function removeElLoadingChild(): void {
    vm.$el?.parentNode?.removeChild(vm.$el)
  }

  /**
   * 关闭 Loading：
   * - beforeClose 返回 false 时中断关闭
   * - 触发过渡后延迟清理，保证离场动画完整执行
   */
  function close() {
    if (options.beforeClose && !options.beforeClose()) return

    afterLeaveFlag.value = true
    clearTimeout(afterLeaveTimer)

    afterLeaveTimer = setTimeout(handleAfterLeave, 400)
    data.visible = false

    options.closed?.()
  }

  /**
   * 过渡结束后的收尾处理：防止重复执行，清理父元素标记后销毁实例
   */
  function handleAfterLeave() {
    if (!afterLeaveFlag.value) return
    const target = data.parent
    afterLeaveFlag.value = false
    target.vLoadingAddClassList = undefined
    destroySelf()
  }

  const elLoadingComponent = defineComponent({
    name: 'ElLoading',
    setup(_, { expose }) {
      const { ns, zIndex } = useGlobalComponentSettings('loading')

      expose({
        ns,
        zIndex,
      })

      return () => {
        // 优先使用自定义 spinner/svg，其次使用内置圆环
        const svg = data.spinner || data.svg
        const spinner = h(
          'svg',
          {
            class: 'circular',
            viewBox: data.svgViewBox ? data.svgViewBox : '0 0 50 50',
            ...(svg ? { innerHTML: svg } : {}), // 传入自定义 svg 时采用 innerHTML 注入
          },
          [
            h('circle', {
              class: 'path',
              cx: '25',
              cy: '25',
              r: '20',
              fill: 'none',
            }),
          ]
        )

        // 文案可选：只有 text 有值时才渲染
        const spinnerText = data.text
          ? h('p', { class: ns.b('text') }, [data.text])
          : undefined

        return h(
          Transition,
          {
            name: ns.b('fade'),
            onAfterLeave: handleAfterLeave,
          },
          {
            default: withCtx(() => [
              withDirectives(
                createVNode(
                  'div',
                  {
                    style: {
                      backgroundColor: data.background || '', // 覆盖遮罩层背景色
                    },
                    class: [
                      ns.b('mask'),
                      data.customClass,
                      data.fullscreen ? 'is-fullscreen' : '',
                    ],
                  },
                  [
                    h(
                      'div',
                      {
                        class: ns.b('spinner'),
                      },
                      [spinner, spinnerText]
                    ),
                  ]
                ),
                [[vShow, data.visible]] // 通过 v-show 触发过渡与显示控制
              ),
            ]),
          }
        )
      }
    },
  })

  const loadingInstance = createApp(elLoadingComponent)
  Object.assign(loadingInstance._context, appContext ?? {})
  const vm = loadingInstance.mount(document.createElement('div'))

  return {
    ...toRefs(data),
    setText,
    removeElLoadingChild,
    close,
    handleAfterLeave,
    vm,
    get $el(): HTMLElement {
      return vm.$el
    },
  }
}

export type LoadingInstance = ReturnType<typeof createLoadingComponent>
