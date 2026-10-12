import { data as defaultData } from "../data";
import { fmtDayMonth, fmtMove, fmtPct, fmtUsd, joinList, monthAndDay, TAG_LABEL } from "../logic/format";
import { joinSentences, splitSentences } from "../logic/text";
import type { LockedFacts, RankedClient, RefineRequest, TalkingPointsDoc, TalkingPointsWording } from "../types";
import {
  type BuildContext,
  compactDate,
  DISCLAIMER,
  exposedTags,
  header,
  holdingLines,
  houseViewsFor,
  productLines,
  roundedPct,
  versusCost,
} from "./builders";
import { HOUSE_VIEW_ZH, joinListZh, RISK_PROFILE_ZH, TAG_LABEL_ZH, THEME_ZH } from "./mandarin";

// 8.1 Client talking points (client-shareable).
//
// Every sentence of the first draft is written once in English and once in Mandarin, and some
// next steps also have a calmer variant. The English text is the v1 draft. The pairs are what
// the offline quick actions ("Translate to Mandarin", "More conservative tone") work from.

export type Lang = "en" | "zh";

export interface Line {
  en: string;
  zh: string;
  /** Less urgent wording, used by "More conservative tone". */
  calm?: { en: string; zh: string };
}

export interface BilingualDraft {
  summary: Line[];
  /** The summary sentences that carry the estimated impact. "WhatsApp length" keeps the first of them. */
  impact: Line[];
  talkingPoints: Line[];
  nextSteps: Line[];
  /** Lines the quick actions can add. */
  caution: Line;
  personal: Line;
  nextAction: Line;
}

export function draftTalkingPoints(row: RankedClient, ctx: BuildContext): BilingualDraft {
  const dataSet = ctx.dataSet ?? defaultData;
  const { client, primary, others } = row;
  const { theme, exposure, nextStep } = primary;
  const negative = exposure.estImpactUsd < 0;
  const discretionary = client.mandate === "Discretionary";

  const themeEn = splitSentences(theme.clientSummary);
  const themeZh = THEME_ZH[theme.id];
  const share = roundedPct(exposure.exposurePct);
  const tags = exposedTags(exposure);
  const labelsEn = joinList(tags.map((tag) => TAG_LABEL[tag]));
  const labelsZh = joinListZh(tags.map((tag) => TAG_LABEL_ZH[tag]));
  const impactUsd = fmtUsd(exposure.estImpactUsd, true);
  const impactPct = fmtPct(exposure.estImpactPct, 2, true);

  // ---- Summary: what happened, then what it means in money terms.
  const impact: Line[] = negative
    ? [
        {
          en: `For your portfolio, we estimate an effect of about ${impactUsd} (${impactPct} of the total) on the holdings concerned.`,
          zh: `就您的投资组合而言，我们估计相关持仓受到的影响约为 ${impactUsd}（占总资产的 ${impactPct}）。`,
        },
        {
          en: "This is an estimate based on indicative market moves, not a realised loss.",
          zh: "这是根据参考性市场变动作出的估算，并非已实现的亏损。",
        },
      ]
    : [
        {
          en: `For your portfolio, we estimate a gain of about ${impactUsd} (${impactPct} of the total) on the holdings concerned, based on indicative market moves.`,
          zh: `就您的投资组合而言，根据参考性市场变动，我们估计相关持仓的收益约为 ${impactUsd}（占总资产的 ${impactPct}）。`,
        },
      ];
  const summary: Line[] = [...themeEn.map((en, index) => ({ en, zh: themeZh?.clientSummary[index] ?? en })), ...impact];

  // ---- Talking points: sizing, house view, the theme's own point, then barrier or cost context.
  const views = houseViewsFor(exposure, dataSet.houseView);
  const noteHolding = exposure.holdings.find((h) => h.holding.barrierDistancePct !== undefined);
  const barrier: Line | null =
    nextStep.flag === "Barrier risk" && noteHolding
      ? {
          en: `Your structured note is linked to large US technology shares. The weakest of them is now about ${noteHolding.holding.barrierDistancePct}% above the barrier, so we would like to walk you through what happens at maturity if it stays above, touches or closes below that level.`,
          zh: `您的结构性票据挂钩美国大型科技股。其中表现最弱的一只目前高于障碍价约${noteHolding.holding.barrierDistancePct}%，因此我们希望向您说明：到期时股价维持在障碍价之上、触及障碍价或收于其下，分别会出现什么情况。`,
        }
      : null;

  const vsCost = versusCost(exposure);
  const vsCostPct = `${Math.abs(Math.round(vsCost * 100))}%`;
  let cost: Line;
  if (negative && vsCost > 0.005) {
    cost = {
      en: `Even after this move, these holdings remain about ${vsCostPct} above their purchase cost overall.`,
      zh: `即使经过这次变动，这些持仓整体上仍比买入成本高出约${vsCostPct}。`,
    };
  } else if (negative) {
    cost = {
      en: `These holdings are now about ${vsCostPct} below their purchase cost, so it is worth checking that the original reason for holding them still applies.`,
      zh: `这些持仓目前比买入成本低约${vsCostPct}，因此值得确认当初持有它们的理由是否依然成立。`,
    };
  } else if (vsCost > 0.005) {
    cost = {
      en: `These holdings are now about ${vsCostPct} above their purchase cost, which makes this a natural moment to review position sizes.`,
      zh: `这些持仓目前比买入成本高出约${vsCostPct}，现在正是检视仓位大小的合适时机。`,
    };
  } else {
    cost = {
      en: `The move recovers part of an earlier decline. These holdings remain about ${vsCostPct} below their purchase cost.`,
      zh: `这次上涨收复了此前的部分跌幅，这些持仓仍比买入成本低约${vsCostPct}。`,
    };
  }

  const talkingPoints: Line[] = [
    {
      en: `The holdings concerned make up about ${share} of your portfolio. The rest is not directly exposed to this theme.`,
      zh: `相关持仓约占您投资组合的${share}，其余部分并不直接受这一主题影响。`,
    },
    ...views.slice(0, barrier ? 1 : 2).map((view) => {
      const zh = HOUSE_VIEW_ZH[view.id];
      const en = `House view on ${view.assetClass}: ${view.stance}. ${view.view}`;
      return { en, zh: zh ? `我们对${zh.assetClass}的投资观点：${zh.stance}。${zh.view}` : en };
    }),
    { en: theme.clientTalkingPoint, zh: themeZh?.clientTalkingPoint ?? theme.clientTalkingPoint },
    barrier ?? cost,
  ];
  if (talkingPoints.length < 5 && others.length > 0) {
    talkingPoints.push({
      en: `Your portfolio is also touched by ${joinList(others.map((o) => `"${o.theme.title}"`))}. We can cover ${others.length > 1 ? "these" : "this"} in the same conversation.`,
      zh: `您的投资组合还受到${joinListZh(others.map((o) => `「${THEME_ZH[o.theme.id]?.title ?? o.theme.title}」`))}的影响，我们可以在同一次沟通中一并说明。`,
    });
  }

  // ---- Next steps: who decides, what to look at, and a call.
  const options = productLines(theme, dataSet, client);
  const nextSteps: Line[] = [];
  if (discretionary) {
    nextSteps.push(
      theme.clientNextStepDiscretionary
        ? { en: theme.clientNextStepDiscretionary, zh: themeZh?.clientNextStepDiscretionary ?? theme.clientNextStepDiscretionary }
        : {
            en: "This is a discretionary mandate, so no action is needed from you. We are reviewing the positioning and will tell you about any change we make.",
            zh: "这是全权委托账户，因此您无需采取任何行动。我们正在检视持仓配置，如有任何调整会及时告知您。",
          },
    );
  } else {
    if (theme.clientNextStep) {
      nextSteps.push({ en: theme.clientNextStep, zh: themeZh?.clientNextStep ?? theme.clientNextStep });
    } else if (barrier) {
      nextSteps.push({
        en: "Go through the note's maturity scenarios together and decide whether to hold the position or reduce it.",
        zh: "我们一起梳理该票据到期时的各种情形，再决定继续持有还是减持。",
        calm: {
          en: "There is no need to decide now. Let us first go through the note's maturity scenarios together.",
          zh: "您不必现在就作决定。我们先一起梳理该票据到期时的各种情形。",
        },
      });
    } else if (negative) {
      const risk = client.riskProfile.toLowerCase();
      const riskZh = RISK_PROFILE_ZH[client.riskProfile];
      nextSteps.push({
        en: `Review together whether the current allocation to ${labelsEn} still fits your ${risk} risk profile.`,
        zh: `我们一起检视目前对${labelsZh}的配置是否仍符合您的${riskZh}风险取向。`,
        calm: {
          en: `There is no need for a quick decision. Let us review together whether the current allocation to ${labelsEn} still fits your ${risk} risk profile.`,
          zh: `您不必急于作决定。我们可以一起检视目前对${labelsZh}的配置是否仍符合您的${riskZh}风险取向。`,
        },
      });
    } else {
      nextSteps.push({
        en: "Consider rebalancing part of the gain back towards your target allocation.",
        zh: "可以考虑把部分收益再平衡，回到您的目标配置。",
        calm: {
          en: "There is no urgency. We could consider gradually rebalancing part of the gain back towards your target allocation.",
          zh: "此事并不紧急。我们可以考虑逐步把部分收益再平衡，回到您的目标配置。",
        },
      });
    }
    if (options.length > 0) {
      const names = options.slice(0, 2).map((o) => o.name);
      nextSteps.push({
        en: `Options we could discuss, without obligation: ${joinList(names)}.`,
        zh: `可供讨论的选项（不构成任何义务）：${joinListZh(names)}。`,
      });
    }
  }
  nextSteps.push({
    en: "We suggest a short call this week to go through this in more detail.",
    zh: "我们建议本周安排一次简短通话，更详细地说明这些内容。",
    calm: {
      en: "We suggest a short call this week to go through this calmly. There is no need to act before then.",
      zh: "我们建议本周安排一次简短通话，从容地说明这些内容。在此之前您无需采取任何行动。",
    },
  });

  // ---- Lines the quick actions can add.
  const { month, day } = monthAndDay(client.lastContactDate);
  const action = views[0];
  const actionZh = action ? HOUSE_VIEW_ZH[action.id]?.action : undefined;
  return {
    summary,
    impact,
    talkingPoints,
    nextSteps,
    caution: {
      en: "Markets can move further in either direction, so we would avoid reacting to a single day's move. Any change should fit your long-term plan.",
      zh: "市场仍可能朝任一方向进一步波动，因此我们不建议因单日行情而仓促行动。任何调整都应符合您的长期规划。",
    },
    personal: {
      en: `Since we last spoke on ${fmtDayMonth(client.lastContactDate)}, there has been a development I wanted you to hear from me directly.`,
      zh: `自我们${month}月${day}日上次联系以来，有一项进展，我想亲自向您说明。`,
    },
    nextAction: action
      ? {
          en: `${discretionary ? "What we plan to do next" : "What we would do next"}: ${action.action}.`,
          zh: `${discretionary ? "我们下一步的计划" : "我们下一步的建议"}：${actionZh ?? action.action}。`,
        }
      : {
          en: "What we would do next: review this together before making any change.",
          zh: "我们下一步的建议：在作出任何调整之前，先一起检视。",
        },
  };
}

export function wordingOf(draft: BilingualDraft, lang: Lang): TalkingPointsWording {
  return {
    summary: joinSentences(draft.summary.map((line) => line[lang])),
    talkingPoints: draft.talkingPoints.map((line) => line[lang]),
    nextSteps: draft.nextSteps.map((line) => line[lang]),
  };
}

export function buildTalkingPoints(row: RankedClient, ctx: BuildContext): TalkingPointsDoc {
  const { client, primary } = row;
  const { theme, exposure, nextStep } = primary;
  const negative = exposure.estImpactUsd < 0;
  const labels = joinList(exposedTags(exposure).map((tag) => TAG_LABEL[tag]));

  const whyNow = `About ${roundedPct(exposure.exposurePct)} of your portfolio (${fmtUsd(exposure.exposureUsd)}) is in ${labels}, ${
    negative ? "which this move weighs on directly" : "which benefits from this move"
  }.`;

  return {
    id: `tp-${compactDate(ctx.date)}-${client.id}-${theme.id}`,
    kind: "talking-points",
    header: header("Client", client.name, theme, whyNow, ctx),
    clientId: client.id,
    themeId: theme.id,
    holdings: holdingLines(exposure),
    totalExposureUsd: exposure.exposureUsd,
    totalImpactUsd: exposure.estImpactUsd,
    disclaimer: DISCLAIMER,
    ...(nextStep.flag ? { flag: nextStep.flag } : {}),
    wording: wordingOf(draftTalkingPoints(row, ctx), "en"),
  };
}

/** The fact fields, formatted exactly as the RM sees them. The model may quote these but never change them. */
export function buildLockedFacts(row: RankedClient, doc: TalkingPointsDoc, ctx: BuildContext): LockedFacts {
  const dataSet = ctx.dataSet ?? defaultData;
  const { client, primary, others } = row;
  const { theme, exposure } = primary;
  const vsCost = versusCost(exposure);
  const noteHolding = exposure.holdings.find((h) => h.holding.barrierDistancePct !== undefined);
  return {
    clientName: client.name,
    themeTitle: theme.title,
    whyNow: doc.header.whyNow,
    dataAsOf: doc.header.dataAsOf,
    holdings: doc.holdings.map((h) => ({
      instrument: h.instrument,
      value: fmtUsd(h.marketValueUsd),
      pctOfPortfolio: fmtPct(h.pctOfAum),
      estMove: fmtMove(h.estMovePct),
      estImpact: fmtUsd(h.estImpactUsd, true),
    })),
    totals: {
      exposure: fmtUsd(exposure.exposureUsd),
      exposureShare: `about ${roundedPct(exposure.exposurePct)} of the portfolio (${fmtPct(exposure.exposurePct)})`,
      estImpact: fmtUsd(exposure.estImpactUsd, true),
      estImpactPct: fmtPct(exposure.estImpactPct, 2, true),
      portfolio: fmtUsd(client.aumUsd),
    },
    versusPurchaseCost: `about ${Math.abs(Math.round(vsCost * 100))}% ${vsCost >= 0 ? "above" : "below"} purchase cost after this move`,
    ...(noteHolding ? { barrierDistance: `${noteHolding.holding.barrierDistancePct}% above the barrier` } : {}),
    lastContact: { iso: client.lastContactDate, spoken: fmtDayMonth(client.lastContactDate) },
    options: productLines(theme, dataSet, client).map((o) => ({ name: o.name, riskLevel: `${o.riskLevel} of 5` })),
    otherThemes: others.map((o) => o.theme.title),
    disclaimer: doc.disclaimer,
  };
}

/** Everything the refine endpoint needs apart from the current wording, the instruction and the chat history. */
export function buildRefineContext(
  row: RankedClient,
  doc: TalkingPointsDoc,
  ctx: BuildContext,
): Pick<RefineRequest, "factsLocked" | "theme" | "client" | "houseView"> {
  const dataSet = ctx.dataSet ?? defaultData;
  const { client, primary } = row;
  const { theme, exposure } = primary;
  return {
    factsLocked: buildLockedFacts(row, doc, ctx),
    theme: {
      title: theme.title,
      type: theme.type,
      whatHappened: theme.updateNote ? `${theme.whatHappened} ${theme.updateNote}` : theme.whatHappened,
      whyItMatters: theme.whyItMatters,
      clientSummary: theme.clientSummary,
      ...(theme.stressTest ? { stressTest: theme.stressTest } : {}),
    },
    client: {
      name: client.name,
      mandate: client.mandate,
      riskProfile: client.riskProfile,
      ...(client.notes ? { notes: client.notes } : {}),
    },
    houseView: houseViewsFor(exposure, dataSet.houseView).map((view) => ({
      assetClass: view.assetClass,
      stance: view.stance,
      view: `${view.view} In practice: ${view.action}.`,
    })),
  };
}
