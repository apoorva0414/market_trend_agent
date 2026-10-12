import type { RiskProfile, Tag } from "../types";

// Pre-written Mandarin for the offline "Translate to Mandarin" quick action.
// Figures, currency amounts and product names are never translated: they are inserted as they appear in the data.

export const TAG_LABEL_ZH: Record<Tag, string> = {
  "us-tech": "美国科技股",
  "us-tech-credit": "美国科技企业债券",
  "long-duration-usd-bonds": "长久期美元债券",
  "short-duration-bonds": "短久期债券",
  reits: "房地产投资信托（REITs）",
  energy: "能源股",
  airlines: "航空股",
  "china-equity": "中国股票",
  "hk-equity": "香港股票",
  "asia-credit": "亚洲信用债",
  gold: "黄金",
  "usd-cash": "美元现金",
  "sgd-cash": "新元现金",
  "structured-notes-tech-underlying": "挂钩科技股的结构性票据",
  "called-usd-perpetual": "被赎回的美元永续债",
};

export const RISK_PROFILE_ZH: Record<RiskProfile, string> = {
  Conservative: "保守型",
  Balanced: "平衡型",
  Growth: "成长型",
  Aggressive: "进取型",
};

export interface ThemeZh {
  title: string;
  /** One entry per sentence of the English clientSummary, in the same order. */
  clientSummary: string[];
  clientTalkingPoint: string;
  clientNextStep?: string;
  clientNextStepDiscretionary?: string;
}

export const THEME_ZH: Record<string, ThemeZh> = {
  "theme-us-yields": {
    title: "美联储释放鹰派信号，美国国债收益率跳升",
    clientSummary: [
      "美国利率看来将在更长时间内维持高位，债券收益率隔夜大幅上升。",
      "收益率上升时，长期债券和房地产投资信托（REITs）的价格通常会下跌。",
    ],
    clientTalkingPoint: "从长远看，较高的收益率对您也有利：到期债券和新增资金可以按比几个月前更好的利率再投资。",
  },
  "theme-ai-capex": {
    title: "科技巨头创纪录发债，为人工智能资本开支融资",
    clientSummary: [
      "美国几家最大的科技公司上周创纪录地举债，用于建设人工智能数据中心。",
      "大量新债发行压低了现有科技企业债券的价格，科技股也随之走低。",
    ],
    clientTalkingPoint: "相关公司的财务状况依然稳健。市场关注的是支出的速度，而不是它们的偿债能力。",
  },
  "theme-oil-sanctions": {
    title: "新一轮制裁收紧原油供应",
    clientSummary: [
      "针对两个主要石油出口国的新制裁于隔夜公布，油价大幅上涨。",
      "能源公司受益于油价上涨，而航空公司则面临更高的燃油成本。",
    ],
    clientTalkingPoint: "这是一项已经发生的市场事实。油价能在高位维持多久，取决于制裁的执行力度以及其他产油国的反应。",
  },
  "theme-china-stimulus": {
    title: "中国宣布新一轮刺激方案",
    clientSummary: ["中国宣布了一项规模超出预期的方案，以支持消费和房地产市场。", "中国内地和香港股市因此大幅上涨。"],
    clientTalkingPoint: "以往的刺激行情曾因落实缓慢而回落，因此我们会建议分步加仓或减仓，而不是一次性大幅调整。",
  },
  "theme-perp-call": {
    title: "合作银行对一只美元永续债发出赎回通知",
    clientSummary: [
      "合作银行A宣布将于2026年11月12日按面值全额赎回其票息5.875%的美元永续债。",
      "该债券此前的交易价格低于面值，因此价格已上涨以反映按面值赎回。",
    ],
    clientTalkingPoint: "这是一项已经确定的公司行动。赎回本身无需您发出任何指示，将由托管银行自动处理。",
    clientNextStep: "请考虑如何将预计于2026年11月12日到账的赎回款项进行再投资。",
    clientNextStepDiscretionary: "我们将按照您的委托授权，把预计于2026年11月12日到账的赎回款项进行再投资，并向您确认相关调整。",
  },
};

export const HOUSE_VIEW_ZH: Record<string, { assetClass: string; stance: string; view: string; action: string }> = {
  "hv-us-equity": {
    assetClass: "美国股票",
    stance: "中性",
    view: "继续持有优质资产，并在走强时减持过于集中的大型科技股仓位。",
    action: "继续持有优质资产，并在走强时逐步减持过于集中的大型科技股仓位",
  },
  "hv-asia-equity": {
    assetClass: "亚洲（除日本）股票",
    stance: "适度超配",
    view: "中国的政策支持改善了短期前景。建议循序渐进地建立仓位，并严格控制持仓规模。",
    action: "循序渐进地建立亚洲仓位，并严格控制持仓规模",
  },
  "hv-duration": {
    assetClass: "美元债券",
    stance: "久期中性，偏好短端",
    view: "锁定1至3年期的收益率，在利率路径更明朗之前避免增持长期债券。",
    action: "锁定1至3年期的收益率，在利率路径更明朗之前避免增持长期债券",
  },
  "hv-credit": {
    assetClass: "信用债",
    stance: "投资级优于高收益",
    view: "在供应量较大期间对科技发行人保持精选，并继续看好亚洲投资级信用债。",
    action: "以投资级发行人为主，并在供应量较大期间精选科技类债券",
  },
  "hv-reits": {
    assetClass: "房地产投资信托（REITs）",
    stance: "利率波动期间低配",
    view: "偏好负债率低、债务期限长的REITs，它们对再融资成本的敏感度较低。",
    action: "偏好负债率低、债务期限长的REITs",
  },
  "hv-energy": {
    assetClass: "能源及对油价敏感的板块",
    stance: "中性",
    view: "把地缘政治引发的价格波动视为再平衡的契机，而不是追涨的理由。",
    action: "借地缘政治引发的价格波动进行再平衡，而不是追涨",
  },
  "hv-gold": {
    assetClass: "黄金",
    stance: "持有3%至5%作为分散配置",
    view: "黄金仍是对冲地缘政治和通胀意外的有效工具。",
    action: "保留3%至5%的黄金作为分散配置",
  },
  "hv-structured": {
    assetClass: "结构性产品",
    stance: "审慎选用",
    view: "密切关注与障碍价的距离，并在市场波动期间优先选择保本型结构。",
    action: "密切关注与障碍价的距离，并在市场波动期间优先选择保本型结构",
  },
  "hv-cash": {
    assetClass: "现金",
    stance: "保持5%至10%的流动性",
    view: "充足的流动性让您在市场下跌时有行动空间，而不必被迫卖出。",
    action: "保留5%至10%的现金，以便有行动空间",
  },
};

export function joinListZh(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("、")}和${items[items.length - 1]}`;
}

/** Document and message labels, so a Mandarin version is not framed in English. */
export const LABELS = {
  en: {
    summary: "Summary",
    portfolio: "What it means for your portfolio",
    talkingPoints: "Talking points",
    nextSteps: "Suggested next steps",
    disclaimer: "Disclaimer",
    greeting: (name: string) => `Dear ${name},`,
    keyPoints: "Key points:",
    portfolioLine: "What it means for your portfolio:",
    nextStepsLine: "Suggested next steps:",
    signOff: "Kind regards,",
    estimated: "estimated",
  },
  zh: {
    summary: "摘要",
    portfolio: "对您投资组合的影响",
    talkingPoints: "沟通要点",
    nextSteps: "建议的后续步骤",
    disclaimer: "免责声明",
    greeting: (name: string) => `尊敬的 ${name}：`,
    keyPoints: "要点：",
    portfolioLine: "对您投资组合的影响：",
    nextStepsLine: "建议的后续步骤：",
    signOff: "此致",
    estimated: "估计",
  },
} as const;
