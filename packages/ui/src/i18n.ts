import { ref } from 'vue'

export type Locale = 'zh' | 'en'
export const LOCALE_LABEL: Record<Locale, string> = { zh: '简体中文', en: 'English' }

export const locale = ref<Locale>('zh')
export function setLocale(l: Locale): void {
  const prev = locale.value
  locale.value = l
  // 同步切 Monaco NLS：对「未来新打开」的编辑器立刻生效；
  // 已渲染编辑器的内置菜单 label 由 Monaco 在模块加载期已缓存，需要刷新窗口才能完整跟随。
  if (prev !== l) {
    void import('./monaco-nls').then((m) => m.applyMonacoLocale(l))
  }
}

/** 壳层文案字典；工具名/描述不在这里（见 registry.ts ToolMeta.name）。 */
const dict: Record<string, Record<Locale, string>> = {
  'app.title': { zh: '乐乐的工具箱', en: 'Lele Tools' },
  'nav.search': { zh: '搜索工具…', en: 'Search tools…' },
  'nav.recent': { zh: '最近使用', en: 'Recent' },
  'nav.collapse': { zh: '收起导航', en: 'Collapse nav' },
  'nav.expand': { zh: '展开导航', en: 'Expand nav' },
  'welcome.hint': { zh: '从左侧选择一个工具开始', en: 'Pick a tool from the sidebar to start' },
  'tabs.close': { zh: '关闭', en: 'Close' },
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.language': { zh: '语言', en: 'Language' },
  'settings.theme': { zh: '主题', en: 'Theme' },
  'settings.theme.dark': { zh: '深色', en: 'Dark' },
  'settings.theme.light': { zh: '浅色', en: 'Light' },
  'settings.theme.system': { zh: '跟随系统', en: 'System' },
  'settings.ai': { zh: 'AI 助手', en: 'AI Assistant' },
  'settings.ai.provider': { zh: '服务商', en: 'Provider' },
  'settings.ai.apiKey': { zh: 'API Key', en: 'API Key' },
  'settings.ai.model': { zh: '模型', en: 'Model' },
  'settings.ai.baseUrl': { zh: 'Base URL', en: 'Base URL' },
  'settings.ai.test': { zh: '测试连接', en: 'Test connection' },
  'settings.ai.testOk': { zh: '连接成功', en: 'Connected' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.copy': { zh: '复制', en: 'Copy' },
  'common.copied': { zh: '已复制', en: 'Copied' },
  'common.clear': { zh: '清空', en: 'Clear' },
  'ai.title': { zh: 'AI 助手', en: 'AI Assistant' },
  'ai.placeholder': { zh: '问点什么…（Enter 发送，Shift+Enter 换行）', en: 'Ask anything… (Enter to send)' },
  'ai.send': { zh: '发送', en: 'Send' },
  'ai.stop': { zh: '停止', en: 'Stop' },
  'ai.notConfigured': { zh: '先在设置里配置 AI 服务商', en: 'Configure an AI provider in Settings first' },
  'crm.title': { zh: 'CRM', en: 'CRM' },
  'crm.contacts': { zh: '干系人', en: 'Contacts' },
  'crm.projects': { zh: '项目', en: 'Projects' },
  'crm.company': { zh: '公司', en: 'Company' },
  'crm.person': { zh: '个人', en: 'Person' },
  'crm.confirmDelete': { zh: '确认删除?', en: 'Confirm?' },
  'crm.clients': { zh: '客户', en: 'Clients' },
  'crm.add': { zh: '新增', en: 'Add' },
  'crm.searchName': { zh: '搜索名称…', en: 'Search name…' },
  'crm.all': { zh: '全部', en: 'All' },
  'crm.statusActive': { zh: '进行中', en: 'Active' },
  'crm.statusDone': { zh: '已完结', en: 'Done' },
  'crm.client': { zh: '所属客户', en: 'Client' },
  'crm.actions': { zh: '操作', en: 'Actions' },
  'crm.detail': { zh: '详情', en: 'Detail' },
  'crm.delete': { zh: '删除', en: 'Delete' },
  'crm.name': { zh: '名称', en: 'Name' },
  'crm.type': { zh: '类型', en: 'Type' },
  'crm.note': { zh: '备注', en: 'Note' },
  'crm.createdAt': { zh: '创建时间', en: 'Created' },
  'crm.status': { zh: '状态', en: 'Status' },
  'crm.amount': { zh: '金额', en: 'Amount' },
  'crm.endDate': { zh: '截止日期', en: 'End date' },
  'crm.role': { zh: '职位', en: 'Role' },
  'crm.phone': { zh: '电话', en: 'Phone' },
  'crm.wechat': { zh: '微信', en: 'WeChat' },
  'crm.email': { zh: '邮箱', en: 'Email' },
  'crm.empty': { zh: '暂无数据', en: 'No data' },
  'crm.hint': { zh: '从左侧选择 客户 / 干系人 / 项目', en: 'Pick Clients / Contacts / Projects on the left' },
  'notes.tree': { zh: '笔记', en: 'Notes' },
  'notes.newFolder': { zh: '新建文件夹', en: 'New folder' },
  'notes.newNote': { zh: '新建笔记', en: 'New note' },
  'notes.untitled': { zh: '无标题', en: 'Untitled' },
  'notes.empty': { zh: '从左侧选择或新建一篇笔记', en: 'Select or create a note on the left' },
  'notes.insertImage': { zh: '插入图片', en: 'Insert image' },
  'notes.insertFile': { zh: '插入文件', en: 'Insert file' },
  'notes.editPane': { zh: '编辑', en: 'Edit' },
  'notes.previewPane': { zh: '预览', en: 'Preview' },
  'notes.saved': { zh: '已保存 ✓', en: 'Saved ✓' },
  'notes.saving': { zh: '保存中…', en: 'Saving…' },
  'notes.confirmDelete': { zh: '确认删除?', en: 'Confirm?' },
  'notes.rename': { zh: '重命名', en: 'Rename' },
  'notes.search': { zh: '搜索笔记…', en: 'Search notes…' },
  'notes.exportPdf': { zh: '导出 PDF', en: 'Export PDF' },
  'notes.watermark': { zh: '水印', en: 'Watermark' },
  'notes.watermarkText': { zh: '水印文字', en: 'Watermark text' },
  'notes.export': { zh: '导出', en: 'Export' },
  'notes.cancel': { zh: '取消', en: 'Cancel' },
  'notes.exported': { zh: '已导出 ✓', en: 'Exported ✓' },
}

export function t(key: string): string {
  return dict[key]?.[locale.value] ?? key
}
