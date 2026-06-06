import type { CrmClientSource, CrmPaymentMethod } from '@lele/shared-types'
import { t } from '../../i18n'

/** 客户来源选项（value 入库，label 走 i18n） */
export const CLIENT_SOURCES: Exclude<CrmClientSource, ''>[] = [
  'xiaohongshu', 'xianyu', 'referral', 'wechat', 'github', 'website', 'other',
]

const SOURCE_KEY: Record<Exclude<CrmClientSource, ''>, string> = {
  xiaohongshu: 'crm.sourceXiaohongshu',
  xianyu: 'crm.sourceXianyu',
  referral: 'crm.sourceReferral',
  wechat: 'crm.sourceWechat',
  github: 'crm.sourceGithub',
  website: 'crm.sourceWebsite',
  other: 'crm.sourceOther',
}

export function sourceLabel(v: CrmClientSource): string {
  return v === '' ? '' : t(SOURCE_KEY[v])
}

/** 收款方式选项（value 入库，label 走 i18n） */
export const PAYMENT_METHODS: Exclude<CrmPaymentMethod, ''>[] = [
  'bank', 'wechat', 'alipay', 'other',
]

const METHOD_KEY: Record<Exclude<CrmPaymentMethod, ''>, string> = {
  bank: 'crm.payBank',
  wechat: 'crm.payWechat',
  alipay: 'crm.payAlipay',
  other: 'crm.payOther',
}

export function paymentMethodLabel(v: CrmPaymentMethod): string {
  return v === '' ? '' : t(METHOD_KEY[v])
}
