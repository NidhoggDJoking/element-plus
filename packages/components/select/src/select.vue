<!--
  @sfc-doc
  文件：packages/components/select/src/select.vue
  作用：ElSelect 组件主体（输入框/多选标签/下拉面板/选项渲染与交互）。

  模板结构概览：
  - 外层容器：负责点击外部关闭、hover 状态、以及作为宽度参考（selectRef）。
  - Tooltip/Popper：承载下拉面板内容（content slot），控制展开/收起与定位。
  - selection 区：
    - 单选：显示当前选中 label 或 placeholder。
    - 多选：渲染 Tag 列表，支持折叠 + Tooltip 展示被折叠的标签。
    - filterable：在 selection 内嵌入 input，用于输入过滤关键字。

  脚本关键点：
  1) modelValue 归一化：在 multiple 与非 multiple 间统一值类型，避免外部传入不符合预期导致状态错乱。
  2) persistent=false 时的 slot 预渲染：为让 useSelect 能收集 option 数据，会“手动遍历一次 slot VNode”，并忽略对应的 Vue 警告。
  3) provide(selectKey)：向下拉面板/option 传递上下文（states、操作方法等）。
-->
<template>
  <div
    ref="selectRef"
    v-click-outside:[popperRef]="handleClickOutside"
    :class="[nsSelect.b(), nsSelect.m(selectSize)]"
    @[mouseEnterEventName]="states.inputHovering = true"
    @mouseleave="states.inputHovering = false"
  >
    <el-tooltip
      ref="tooltipRef"
      :visible="dropdownMenuVisible"
      :placement="placement"
      :teleported="teleported"
      :popper-class="[nsSelect.e('popper'), popperClass]"
      :popper-style="popperStyle"
      :popper-options="popperOptions"
      :fallback-placements="fallbackPlacements"
      :effect="effect"
      pure
      trigger="click"
      :transition="`${nsSelect.namespace.value}-zoom-in-top`"
      :stop-popper-mouse-event="false"
      :gpu-acceleration="false"
      :persistent="persistent"
      :append-to="appendTo"
      :show-arrow="showArrow"
      :offset="offset"
      @before-show="handleMenuEnter"
      @hide="states.isBeforeHide = false"
    >
      <template #default>
        <div
          ref="wrapperRef"
          :class="[
            nsSelect.e('wrapper'),
            nsSelect.is('focused', isFocused),
            nsSelect.is('hovering', states.inputHovering),
            nsSelect.is('filterable', filterable),
            nsSelect.is('disabled', selectDisabled),
          ]"
          @click.prevent="toggleMenu"
        >
          <div
            v-if="$slots.prefix"
            ref="prefixRef"
            :class="nsSelect.e('prefix')"
          >
            <slot name="prefix" />
          </div>
          <div
            ref="selectionRef"
            :class="[
              nsSelect.e('selection'),
              nsSelect.is(
                'near',
                multiple && !$slots.prefix && !!states.selected.length
              ),
            ]"
          >
            <slot
              v-if="multiple"
              name="tag"
              :data="states.selected"
              :delete-tag="deleteTag"
              :select-disabled="selectDisabled"
            >
              <div
                v-for="item in showTagList"
                :key="getValueKey(item)"
                :class="nsSelect.e('selected-item')"
              >
                <el-tag
                  :closable="!selectDisabled && !item.isDisabled"
                  :size="collapseTagSize"
                  :type="tagType"
                  :effect="tagEffect"
                  disable-transitions
                  :style="tagStyle"
                  @close="deleteTag($event, item)"
                >
                  <span :class="nsSelect.e('tags-text')">
                    <slot
                      name="label"
                      :index="item.index"
                      :label="item.currentLabel"
                      :value="item.value"
                    >
                      {{ item.currentLabel }}
                    </slot>
                  </span>
                </el-tag>
              </div>

              <el-tooltip
                v-if="collapseTags && states.selected.length > maxCollapseTags"
                ref="tagTooltipRef"
                :disabled="dropdownMenuVisible || !collapseTagsTooltip"
                :fallback-placements="['bottom', 'top', 'right', 'left']"
                :effect="effect"
                placement="bottom"
                :popper-class="popperClass"
                :popper-style="popperStyle"
                :teleported="teleported"
              >
                <template #default>
                  <div
                    ref="collapseItemRef"
                    :class="nsSelect.e('selected-item')"
                  >
                    <el-tag
                      :closable="false"
                      :size="collapseTagSize"
                      :type="tagType"
                      :effect="tagEffect"
                      disable-transitions
                      :style="collapseTagStyle"
                    >
                      <span :class="nsSelect.e('tags-text')">
                        + {{ states.selected.length - maxCollapseTags }}
                      </span>
                    </el-tag>
                  </div>
                </template>
                <template #content>
                  <div ref="tagMenuRef" :class="nsSelect.e('selection')">
                    <div
                      v-for="item in collapseTagList"
                      :key="getValueKey(item)"
                      :class="nsSelect.e('selected-item')"
                    >
                      <el-tag
                        class="in-tooltip"
                        :closable="!selectDisabled && !item.isDisabled"
                        :size="collapseTagSize"
                        :type="tagType"
                        :effect="tagEffect"
                        disable-transitions
                        @close="deleteTag($event, item)"
                      >
                        <span :class="nsSelect.e('tags-text')">
                          <slot
                            name="label"
                            :index="item.index"
                            :label="item.currentLabel"
                            :value="item.value"
                          >
                            {{ item.currentLabel }}
                          </slot>
                        </span>
                      </el-tag>
                    </div>
                  </div>
                </template>
              </el-tooltip>
            </slot>
            <div
              :class="[
                nsSelect.e('selected-item'),
                nsSelect.e('input-wrapper'),
                nsSelect.is('hidden', !filterable),
              ]"
            >
              <input
                :id="inputId"
                ref="inputRef"
                v-model="states.inputValue"
                type="text"
                :name="name"
                :class="[nsSelect.e('input'), nsSelect.is(selectSize)]"
                :disabled="selectDisabled"
                :autocomplete="autocomplete"
                :style="inputStyle"
                :tabindex="tabindex"
                role="combobox"
                :readonly="!filterable"
                spellcheck="false"
                :aria-activedescendant="hoverOption?.id || ''"
                :aria-controls="contentId"
                :aria-expanded="dropdownMenuVisible"
                :aria-label="ariaLabel"
                aria-autocomplete="none"
                aria-haspopup="listbox"
                @keydown.down.stop.prevent="navigateOptions('next')"
                @keydown.up.stop.prevent="navigateOptions('prev')"
                @keydown.esc.stop.prevent="handleEsc"
                @keydown.enter.stop.prevent="selectOption"
                @keydown.delete.stop="deletePrevTag"
                @compositionstart="handleCompositionStart"
                @compositionupdate="handleCompositionUpdate"
                @compositionend="handleCompositionEnd"
                @input="onInput"
                @click.stop="toggleMenu"
              />
              <span
                v-if="filterable"
                ref="calculatorRef"
                aria-hidden="true"
                :class="nsSelect.e('input-calculator')"
                v-text="states.inputValue"
              />
            </div>
            <div
              v-if="shouldShowPlaceholder"
              :class="[
                nsSelect.e('selected-item'),
                nsSelect.e('placeholder'),
                nsSelect.is(
                  'transparent',
                  !hasModelValue || (expanded && !states.inputValue)
                ),
              ]"
            >
              <slot
                v-if="hasModelValue"
                name="label"
                :index="getOption(modelValue!).index"
                :label="currentPlaceholder"
                :value="modelValue"
              >
                <span>{{ currentPlaceholder }}</span>
              </slot>
              <span v-else>{{ currentPlaceholder }}</span>
            </div>
          </div>
          <div ref="suffixRef" :class="nsSelect.e('suffix')">
            <el-icon
              v-if="iconComponent && !showClearBtn"
              :class="[nsSelect.e('caret'), nsSelect.e('icon'), iconReverse]"
            >
              <component :is="iconComponent" />
            </el-icon>
            <el-icon
              v-if="showClearBtn && clearIcon"
              :class="[
                nsSelect.e('caret'),
                nsSelect.e('icon'),
                nsSelect.e('clear'),
              ]"
              @click="handleClearClick"
            >
              <component :is="clearIcon" />
            </el-icon>
            <el-icon
              v-if="validateState && validateIcon && needStatusIcon"
              :class="[
                nsInput.e('icon'),
                nsInput.e('validateIcon'),
                nsInput.is('loading', validateState === 'validating'),
              ]"
            >
              <component :is="validateIcon" />
            </el-icon>
          </div>
        </div>
      </template>
      <template #content>
        <el-select-menu ref="menuRef">
          <div
            v-if="$slots.header"
            :class="nsSelect.be('dropdown', 'header')"
            @click.stop
          >
            <slot name="header" />
          </div>
          <el-scrollbar
            v-show="states.options.size > 0 && !loading"
            :id="contentId"
            ref="scrollbarRef"
            tag="ul"
            :wrap-class="nsSelect.be('dropdown', 'wrap')"
            :view-class="nsSelect.be('dropdown', 'list')"
            :class="[nsSelect.is('empty', filteredOptionsCount === 0)]"
            role="listbox"
            :aria-label="ariaLabel"
            aria-orientation="vertical"
            @scroll="popupScroll"
          >
            <el-option
              v-if="showNewOption"
              :value="states.inputValue"
              :created="true"
            />
            <el-options>
              <slot>
                <template v-for="(option, index) in options" :key="index">
                  <el-option-group
                    v-if="getOptions(option)?.length"
                    :label="getLabel(option)"
                    :disabled="getDisabled(option)"
                  >
                    <el-option
                      v-for="item in getOptions(option)"
                      :key="getValue(item)"
                      v-bind="getOptionProps(item)"
                    />
                  </el-option-group>
                  <el-option v-else v-bind="getOptionProps(option)" />
                </template>
              </slot>
            </el-options>
          </el-scrollbar>
          <div
            v-if="$slots.loading && loading"
            :class="nsSelect.be('dropdown', 'loading')"
          >
            <slot name="loading" />
          </div>
          <div
            v-else-if="loading || filteredOptionsCount === 0"
            :class="nsSelect.be('dropdown', 'empty')"
          >
            <slot name="empty">
              <span>{{ emptyText }}</span>
            </slot>
          </div>
          <div
            v-if="$slots.footer"
            :class="nsSelect.be('dropdown', 'footer')"
            @click.stop
          >
            <slot name="footer" />
          </div>
        </el-select-menu>
      </template>
    </el-tooltip>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, getCurrentInstance, onBeforeUnmount, provide, reactive, toRefs, watch } from 'vue'
import { ClickOutside } from '@element-plus/directives'
import ElTooltip from '@element-plus/components/tooltip'
import ElScrollbar from '@element-plus/components/scrollbar'
import ElTag from '@element-plus/components/tag'
import ElIcon from '@element-plus/components/icon'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { flattedChildren, isArray, isObject } from '@element-plus/utils'
import { useCalcInputWidth } from '@element-plus/hooks'
import { useProps } from '@element-plus/components/select-v2/src/useProps'
import ElOption from './option.vue'
import ElSelectMenu from './select-dropdown.vue'
import { useSelect } from './useSelect'
import { selectKey } from './token'
import ElOptions from './options'
import { selectProps } from './select'
import ElOptionGroup from './option-group.vue';

import type { VNode } from 'vue';
import type { SelectContext } from './type'

const COMPONENT_NAME = 'ElSelect'
export default defineComponent({
  name: COMPONENT_NAME,
  componentName: COMPONENT_NAME,
  components: {
    ElSelectMenu,
    ElOption,
    ElOptions,
    ElOptionGroup,
    ElTag,
    ElScrollbar,
    ElTooltip,
    ElIcon,
  },
  directives: { ClickOutside },
  props: selectProps,
  emits: [
    UPDATE_MODEL_EVENT,
    CHANGE_EVENT,
    'remove-tag',
    'clear',
    'visible-change',
    'focus',
    'blur',
    'popup-scroll',
  ],

  setup(props, { emit, slots }) {
    const instance = getCurrentInstance()!

    // 临时覆盖 warnHandler：
    // 当 persistent=false 时，下方会“手动执行一次 slots.default()”来预收集 option 数据。
    // Vue 会提示“Slot 在 render 函数外被调用”的警告；此处明确过滤该条警告，避免影响开发体验。
    instance.appContext.config.warnHandler = (...args) => {
      const message = args[0]
      if (!message || message.includes('Slot "default" invoked outside of the render function')) {
        return
      }
      // eslint-disable-next-line no-console
      console.warn(...args)
    }
    // 统一 modelValue 的形态：
    // - multiple=true：始终返回数组（外部误传单值时兜底为 []）
    // - multiple=false：始终返回单值（外部误传数组时兜底为 undefined）
    // 这样可避免 useSelect 内部对 selected/optionsMap 的计算出现类型分支膨胀。
    const modelValue = computed(() => {
      const { modelValue: rawModelValue, multiple } = props
      const fallback = multiple ? [] : undefined

      if (isArray(rawModelValue)) {
        return multiple ? rawModelValue : fallback
      }

      return multiple ? fallback : rawModelValue
    })

    const _props = reactive({
      ...toRefs(props),
      modelValue,
    })

    const API = useSelect(_props, emit)
    const { calculatorRef, inputStyle } = useCalcInputWidth()
    const { getLabel, getValue, getOptions, getDisabled } = useProps(props)

    /**
     * 将普通对象数据转换为 ElOption 需要的 props 结构
     */
    const getOptionProps = (option: Record<string, any>) => ({
      label: getLabel(option),
      value: getValue(option),
      disabled: getDisabled(option),
    })

    /**
     * 扁平化 TreeSelect 的树形数据
     * 说明：TreeSelect 的选项数据位于 data.children 中；为了复用 Select 的 option 收集机制，需要把树拍平成一维数组。
     */
    const flatTreeSelectData = (data: any[]) => {
      return data.reduce((acc, item) => {
        acc.push(item)
        if (item.children && item.children.length > 0) {
          acc.push(...flatTreeSelectData(item.children))
        }
        return acc
      }, [])
    }

    /**
     * 手动遍历 slot 渲染结果并把 option 信息注入 useSelect 的内部状态
     * 触发场景：persistent=false 时，选项不会默认渲染，但仍需要收集 optionsMap/cachedOptions 用于回显与交互。
     */
    const manuallyRenderSlots = (vnodes: VNode[] | undefined) => {
      const children = flattedChildren(vnodes || []) as VNode[]
      children.forEach((item) => {
        // 这里通过运行时判断识别 ElOption / ElTree（TreeSelect）两类节点
        // @ts-expect-error
        if (
          isObject(item) &&
          (item.type.name === 'ElOption' || item.type.name === 'ElTree')
        ) {
          // @ts-expect-error
          const _name = item.type.name
          if (_name === 'ElTree') {
            // TreeSelect：从树数据中生成等价的“选项条目”并注册
            const treeData = item.props?.data || []
            const flatData = flatTreeSelectData(treeData)
            flatData.forEach((treeItem: any) => {
              treeItem.currentLabel =
                treeItem.label || (isObject(treeItem.value) ? '' : treeItem.value)
              API.onOptionCreate(treeItem)
            })
          } else if (_name === 'ElOption') {
            // 普通 Option：直接复用 props，补齐 currentLabel 后注册
            const obj = { ...item.props } as any
            obj.currentLabel = obj.label || (isObject(obj.value) ? '' : obj.value)
            API.onOptionCreate(obj)
          }
        }
      })
    }
    // 监听默认插槽内容变化：
    // - persistent=true：选项会正常渲染，useSelect 可在渲染过程中自然收集数据，无需额外处理。
    // - persistent=false：需要在此处手动遍历一次 slot 的 VNode，把选项数据喂给 useSelect。
    watch(
      () => {
        const slotsContent = slots.default?.()
        return slotsContent
      },
      (newSlot) => {
        if (props.persistent) {
          return
        }
        manuallyRenderSlots(newSlot)
      },
      {
        immediate: true,
      }
    )

    provide(
      selectKey,
      reactive({
        props: _props,
        states: API.states,
        selectRef: API.selectRef,
        optionsArray: API.optionsArray,
        setSelected: API.setSelected,
        handleOptionSelect: API.handleOptionSelect,
        onOptionCreate: API.onOptionCreate,
        onOptionDestroy: API.onOptionDestroy,
      }) satisfies SelectContext
    )

    const selectedLabel = computed(() => {
      if (!props.multiple) {
        return API.states.selectedLabel
      }
      return API.states.selected.map((i) => i.currentLabel as string)
    })

    onBeforeUnmount(() => {
      // https://github.com/element-plus/element-plus/issues/21279
      instance.appContext.config.warnHandler = undefined
    })

    return {
      ...API,
      modelValue,
      selectedLabel,
      calculatorRef,
      inputStyle,
      getLabel,
      getValue,
      getOptions,
      getDisabled,
      getOptionProps,
    }
  },
})
</script>
