<script setup>
import { galleryCategoryOptions, galleryCharacterOptions } from '../../services/galleryMetadata.js';
const props = defineProps({ model: { type: Object, required: true }, prefix: { type: String, default: 'image' }, disabled: Boolean });
function toggleCharacter(id, checked) {
  const current = props.model.characters || [];
  props.model.characters = checked ? [...new Set([...current, id])] : current.filter(item => item !== id);
}
</script>
<template>
  <fieldset class="metadata-fields" :disabled="disabled">
    <label :for="`${prefix}-title`">标题（必填）</label>
    <input :id="`${prefix}-title`" v-model="model.title" required maxlength="120" placeholder="给这一刻取个名字">
    <label :for="`${prefix}-alt`">画面描述</label>
    <textarea :id="`${prefix}-alt`" v-model="model.alt" maxlength="300" rows="2" placeholder="描述画面，方便读屏与搜索"></textarea>
    <div class="metadata-pair">
      <div><label :for="`${prefix}-creator`">作者</label><input :id="`${prefix}-creator`" v-model="model.creator" maxlength="120" placeholder="未确认时留空"></div>
      <div><label :for="`${prefix}-credit`">来源说明</label><input :id="`${prefix}-credit`" v-model="model.credit" maxlength="200" placeholder="保留已知来源，不猜测作者"></div>
    </div>
    <label :for="`${prefix}-source`">原作 / 作者网址</label>
    <input :id="`${prefix}-source`" v-model="model.source_url" type="url" maxlength="1000" placeholder="https://…">
    <label :for="`${prefix}-category`">分类</label>
    <select :id="`${prefix}-category`" v-model="model.category"><option v-for="category in galleryCategoryOptions" :key="category.id" :value="category.id">{{ category.label }}</option></select>
    <span class="field-label">画面中的角色（可多选）</span>
    <div class="character-checks"><label v-for="character in galleryCharacterOptions" :key="character.id"><input type="checkbox" :checked="model.characters?.includes(character.id)" @change="toggleCharacter(character.id, $event.target.checked)">{{ character.label }}</label></div>
    <p v-if="model.characters === null" class="metadata-help">这张旧图仍按原有文字识别角色。勾选后才保存显式角色；不批量改动其他图片。</p>
    <label :for="`${prefix}-tags`">标签（最多 8 个，用逗号分隔）</label>
    <input :id="`${prefix}-tags`" :value="Array.isArray(model.tags) ? model.tags.join('，') : model.tags" maxlength="168" placeholder="演出夜，四人合照" @input="model.tags = $event.target.value">
  </fieldset>
</template>
<style scoped>
.metadata-fields{display:grid;gap:8px;border:0;padding:0;margin:0;min-width:0}.metadata-fields>label,.field-label{font-weight:700;margin-top:12px;font-size:14px}.metadata-fields :is(input,select,textarea){width:100%;min-width:0;min-height:44px;background:#fffcf5;color:#493b47;border:1px solid #b8a491;padding:10px;font:inherit;font-size:16px}.metadata-fields input[type=checkbox]{width:20px;min-height:20px;flex:none;accent-color:#ac456e}.character-checks{display:flex;flex-wrap:wrap;gap:4px 12px}.character-checks label{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px}.metadata-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.metadata-pair label{display:block;font-size:14px;font-weight:700;margin:12px 0 8px}.metadata-help{font-size:12px;line-height:1.7;color:#755f70}fieldset:disabled{opacity:.65}@media(max-width:500px){.metadata-pair{grid-template-columns:1fr}}
</style>
