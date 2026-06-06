import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'crm',
  name: { zh: 'CRM', en: 'CRM' },
  desc: { zh: '客户 / 干系人 / 项目管理', en: 'Clients / contacts / projects management' },
  category: 'misc',
  keywords: ['crm', 'customer', 'client', '客户', '干系人', '项目', 'kehu', 'ganxiren', 'xiangmu'],
  icon: '🗂️',
  load: () => import('../../components/crm/CrmPanel.vue'),
}
