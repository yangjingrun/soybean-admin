import { Inject, Injectable } from '@nestjs/common';
import { defaultAiModelConfigKey, leadMatchAnalyzePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { AiLeadSearchContext, OptimizedKeywordPlan } from './ai-lead-search-orchestrator.service';
import {
  buildFallbackAiLeadEmailWritingContext,
  normalizeAiLeadEmailWritingContext
} from './ai-lead-email-writing-context';
import { buildAiLeadExclusionDecisionRules, normalizeAiLeadKeywordContextSnapshot } from './ai-lead-keyword-context';
import { normalizeAiLeadProductLineSnapshot } from './ai-lead-product-line-context';
import type {
  AiLeadPrecisionAnalysis,
  AiLeadPrecisionPriority,
  AiLeadTargetMarketFit,
  AiLeadWebsiteEvidence,
  AiLeadWebsiteEnrichedCandidate
} from './ai-lead-website-crawler.types';

const leadMatchAnalyzeBatchSize = 3;
const leadMatchAnalyzeMaxOutputTokens = 3600;
const minStrongProductEvidenceScore = 40;
const officialChinaCountry = '中国';
const chinaPhonePattern = /^\+86\b|^\+86[\s().-]/i;
const chinaAddressSignalPattern =
  /(?:中国|中國|中华人民共和国|الصين|جمهورية\s*الصين|الصين\s*الشعبية|китай|кнр|중국|चीन|\bchina\b|\bprc\b|\bxiamen\b|\bfujian\b|\bfujan\b|\bjiahe\b|\bsiming\b|\bxinjing\b|\bshenzhen\b|\bguangzhou\b|\bguangdong\b|\bningbo\b|\bzhejiang\b|\bshanghai\b|\bbeijing\b|\bjiangsu\b|\bhebei\b|\bshandong\b|\bwenzhou\b|\bfoshan\b|\bdongguan\b|\bcixi\b|\byuyao\b|\bquanzhou\b)/i;
const weakChinaOriginPattern =
  /(?:china\s+brands?|chinese\s+brands?|made\s+in\s+china|from\s+china|manufacturer\s+in\s+china|china\s+manufacturer|china\s+made|brands?\s+from\s+china|#\s*\d+\s+.*\bin\s+china)/i;
const regionNetworkPattern =
  /(?:across|regional|localized|operations?|network|global|worldwide|asia|countries|subsidiar|distributors?|partners?)/i;
const nonChinaCountryPattern =
  /(?:south\s+korea|korea|singapore|thailand|india|japan|malaysia|indonesia|vietnam|uae|united\s+arab\s+emirates|saudi\s+arabia|turkey|europe|america)/gi;
const buyerSignalKeywords = new Set([
  'supplier',
  'manufacturer',
  'factory',
  'import',
  'importer',
  'distributor',
  'dealer',
  'stockist',
  'wholesaler',
  'export',
  'catalog',
  'products',
  'product',
  'contact',
  'about'
]);
const commonRequirementTokens = new Set([
  'customer',
  'customers',
  'client',
  'clients',
  'buyer',
  'buyers',
  'target',
  'market',
  'overseas',
  'foreign',
  'china',
  'chinese',
  'import',
  'importer',
  'distributor',
  'dealer',
  'supplier',
  'manufacturer'
]);

interface AnalyzeCandidatesInput {
  requirement: string;
  keywordPlan: OptimizedKeywordPlan;
  candidates: AiLeadWebsiteEnrichedCandidate[];
}

interface AiLeadPrecisionCandidateOutput {
  dedupeKey?: unknown;
  score?: unknown;
  priority?: unknown;
  buyerType?: unknown;
  customerGroup?: unknown;
  companyCountry?: unknown;
  targetMarketFit?: unknown;
  reason?: unknown;
  matchedSignals?: unknown;
  risks?: unknown;
  recommendedAction?: unknown;
  reviewRequired?: unknown;
  emailWritingContext?: unknown;
}

@Injectable()
export class AiLeadPrecisionAnalysisService {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService) {}

  /** Scores website-enriched candidates against the original lead requirement. */
  async analyzeCandidates(input: AnalyzeCandidatesInput, context: AiLeadSearchContext = {}) {
    if (input.candidates.length === 0) {
      return [];
    }

    const outputByKey = new Map<
      string,
      {
        analysis: AiLeadPrecisionAnalysis;
        emailWritingContext: ReturnType<typeof normalizeAiLeadEmailWritingContext>;
      }
    >();

    for (const candidateBatch of chunkCandidates(input.candidates, leadMatchAnalyzeBatchSize)) {
      const result = await this.aiGatewayService.generateText(
        {
          modelConfigKey: defaultAiModelConfigKey,
          promptKey: leadMatchAnalyzePromptKey,
          prompt: buildLeadPrecisionPrompt({
            ...input,
            candidates: candidateBatch
          }),
          maxOutputTokens: leadMatchAnalyzeMaxOutputTokens
        },
        context
      );
      const analysisOutput = readAnalysisOutputs(result.text);

      for (const candidate of candidateBatch) {
        if (analysisOutput.parseErrorMessage) {
          const analysis = createDefaultAnalysis(candidate, analysisOutput.parseErrorMessage);

          outputByKey.set(normalizeString(candidate.dedupeKey), {
            analysis,
            emailWritingContext: buildFallbackAiLeadEmailWritingContext({
              candidate,
              precisionAnalysis: analysis,
              productLineSnapshot: normalizeAiLeadProductLineSnapshot(input.keywordPlan.productLineSnapshot)
            })
          });
        }
      }

      for (const item of analysisOutput.items) {
        outputByKey.set(normalizeString(item.dedupeKey), {
          analysis: toPrecisionAnalysis(item),
          emailWritingContext: normalizeAiLeadEmailWritingContext(item.emailWritingContext)
        });
      }
    }

    return input.candidates.map(candidate => {
      const aiOutput = outputByKey.get(normalizeString(candidate.dedupeKey));
      const aiAnalysis = aiOutput?.analysis ?? createDefaultAnalysis(candidate);
      const analysis = enforceOfficialCountryMismatch(
        input,
        candidate,
        protectStrongWebsiteProductEvidence(input, candidate, aiAnalysis)
      );
      const emailWritingContext =
        aiOutput?.emailWritingContext ??
        buildFallbackAiLeadEmailWritingContext({
          candidate,
          precisionAnalysis: analysis,
          productLineSnapshot: normalizeAiLeadProductLineSnapshot(input.keywordPlan.productLineSnapshot)
        });

      return {
        ...candidate,
        score: analysis.score,
        reason: analysis.reason,
        precisionAnalysis: analysis,
        ...(emailWritingContext ? { emailWritingContext } : {})
      };
    });
  }
}

/** 按固定小批次送入 LLM，避免单次客户过多导致证据读取和输出截断。 */
function chunkCandidates(candidates: AiLeadWebsiteEnrichedCandidate[], batchSize: number) {
  const batches: AiLeadWebsiteEnrichedCandidate[][] = [];

  for (let index = 0; index < candidates.length; index += batchSize) {
    batches.push(candidates.slice(index, index + batchSize));
  }

  return batches;
}

function buildLeadPrecisionPrompt(input: AnalyzeCandidatesInput) {
  const leadContextSnapshot = normalizeAiLeadKeywordContextSnapshot(input.keywordPlan.leadContextSnapshot);
  const exclusionDecisionRules = buildAiLeadExclusionDecisionRules(leadContextSnapshot?.exclusionRules);

  return JSON.stringify({
    instruction:
      '你是外贸获客质检助手。只根据 Serper 候选信息、CRM 产品线基准、用户结构化获客条件 leadContextSnapshot 和官网抓取证据判断客户精准度，不要编造事实。输出严格 JSON。必须先判断客户群体、官网归属地、目标市场匹配度、产品线匹配度；产品线是固定参照，用户输入只是本次搜索条件。若 leadContextSnapshot.exclusionRules 存在用户勾选的排除类型，必须逐条检查候选官网证据；命中排除规则时要在 risks 写明命中的排除类型和证据，严重命中时 priority=reject。若官网地址、页脚、联系页、电话或官网证据明确显示中国公司，而用户目标是海外/非中国客户，或用户排除类型包含中国供应商/出口商，必须标为 outside_target、priority=reject、score<=30，并说明官网证据。注意：China brands、made in China、manufacturer in China、Chinese brand 这类产品来源/品牌来源描述不是公司归属中国的充分证据；只有公司地址、页脚、Contact、电话 +86、工商主体或多语言地址块明确指向中国时，才按中国公司处理。若无归属地冲突但官网当前产品页、标题、描述、URL 或页面片段明确命中产品线或目标产品，不要直接 reject，应至少给 low 并标记 reviewRequired。',
    analysisGuidance: buildLeadMatchAnalyzeGuidance(leadContextSnapshot),
    outputContract: {
      candidates: [
        {
          dedupeKey: '必须原样返回输入 dedupeKey',
          score: '0-100 数字',
          priority: 'high | medium | low | reject',
          buyerType: '客户类型',
          customerGroup: '客户群体判断，例如海外经销商/本地进口商/中国供应商/非目标海外客户',
          companyCountry: '官网证据显示的公司归属国家；没有证据则为空字符串',
          targetMarketFit: 'target | uncertain | outside_target',
          reason: '一句中文原因，引用已给证据',
          matchedSignals: ['命中的官网/Serper 信号'],
          risks: ['不确定或不匹配风险'],
          recommendedAction: '下一步建议',
          reviewRequired: 'boolean；官网抓取失败或证据不足时为 true',
          emailWritingContext: {
            companyBackgroundSummary: '公司背景摘要，只能基于官网/About/Contact/Footer/搜索摘要等已给证据',
            industryChainPosition: '产业链位置，例如本地进口商/经销商/库存商/MRO 维修服务商/终端工程商/非目标供应商',
            mainProducts: ['客户官网展示的主要产品或品类，最多 6 条，不写邮箱电话社媒'],
            servedIndustries: ['服务行业/应用场景，最多 6 条'],
            businessModel: '经营模式，例如本地库存分销、授权代理、维修服务、工程项目、制造出口等',
            productFitSummary: '本客户与我方产品线/用户选择产业链的匹配点，引用已给证据，保守表达',
            recentBusinessTriggers: ['新闻、项目、招聘、仓库、展会、新增代理等近期触发点；没有则空数组'],
            recommendedFirstEmailAngle: '第一封建议切入角度，优先围绕相关性与初始价值，不把负面信号写成正向角度',
            negativeRelevanceSignals: ['不匹配、证据不足、排除风险，只放负面或不确定线索'],
            confidenceScore: '0-100 数字',
            evidenceItems: [
              {
                type: 'company_background | product | application | brand | recent_activity | purchase_signal | negative_relevance | address',
                url: '证据来源 URL',
                text: '短证据原文或摘要，最多 4 条，只放写第一封有用的证据；避免长网页原文；不要放邮箱、电话、WhatsApp、社媒链接'
              }
            ]
          }
        }
      ]
    },
    requirement: input.requirement,
    keywordPlan: {
      resolvedProductKeywords: input.keywordPlan.resolvedProductKeywords || '',
      resolvedTargetRegions: input.keywordPlan.resolvedTargetRegions || '',
      resolvedTargetCustomerProfile: input.keywordPlan.resolvedTargetCustomerProfile || '',
      productLineSnapshot: input.keywordPlan.productLineSnapshot || null,
      leadContextSnapshot,
      exclusionDecisionRules
    },
    candidates: input.candidates.map(candidate => ({
      dedupeKey: candidate.dedupeKey,
      title: candidate.title,
      website: candidate.website || candidate.url,
      snippet: candidate.snippet,
      address: candidate.address,
      phoneNumber: candidate.phoneNumber,
      sourceType: candidate.sourceType,
      country: candidate.country,
      websiteEvidence: candidate.websiteEvidence
    }))
  });
}

/** 按用户本次勾选的排除类型，给 lead_match_analyze 注入更细的网站主体判定规则。 */
function buildLeadMatchAnalyzeGuidance(leadContextSnapshot: ReturnType<typeof normalizeAiLeadKeywordContextSnapshot>) {
  const exclusionKeys = new Set((leadContextSnapshot?.exclusionRules ?? []).map(rule => rule.key));

  return {
    purpose: '把 B2B 外贸网站信息分析专家的判断框架用于 lead_match_analyze，但输出字段必须仍遵守 outputContract，不额外输出长报告。',
    evidencePriority: [
      '优先级从高到低：官网 Contact/About/Footer/地址/电话/邮箱/产品页 > Serper title/snippet > 页面风格和语言线索。',
      '公司归属地、客户角色、是否目标市场，必须引用官网证据；没有证据时写 uncertain/reviewRequired=true。',
      '不要把目录页、平台招商页、区域网络说明、产品来源说明，当成候选公司主体证据。'
    ],
    websiteAnalysisFlow: [
      '先判断页面类型：公司官网、工厂官网、经销商官网、目录页、平台店铺、产品推广页、SEO 采集页或信息不足。',
      '再提取公司主体、国家/城市、地址、电话、邮箱、社媒、About/Contact/Products/Footer 等公开证据。',
      '然后判断 B2B 角色：供应商/工厂/出口商/品牌方，还是进口商/经销商/批发商/库存商/维修商/承包商/终端买家。',
      '继续判断产品线匹配度、目标区域匹配度、开发价值、联系方式可触达性和真实性风险。',
      '最后把判断压缩到 outputContract 字段：score、priority、buyerType、customerGroup、companyCountry、targetMarketFit、reason、matchedSignals、risks、recommendedAction、reviewRequired。',
      '证据不足时必须输出 reviewRequired=true，不能为了满足排除类型而编造公司归属地。'
    ],
    websiteTypeGuidance: [
      '公司官网/品牌官网：有稳定域名、公司介绍、产品线、联系方式、地址或团队信息；可作为主体判断依据。',
      '工厂官网/制造商官网：强调 manufacturer/factory/OEM/production line/export/supplier，若用户排除供应商要重点检查。',
      '贸易商/出口商官网：强调 export、global supplier、sourcing、shipment、catalog，通常是供应侧角色。',
      '进口商/经销商/批发商/库存商官网：强调 Importer、Distributor、Dealer、Wholesaler、Stockist、Local supplier、authorized distributor、spare parts、maintenance/service。',
      '终端行业客户官网：主营工程、设备、维修、车队、工厂、承包、项目服务，可作为潜在买家但需看是否采购目标产品。',
      'B2C 零售/商城：购物车、个人消费品、零售价格、consumer only，若用户找 B2B 客户则低分或排除。',
      '目录页/黄页/地图页：展示多个公司或地点，不把页面国家、标题国家直接当候选公司归属地。',
      'B2B 平台店铺：Alibaba、Made-in-China、IndiaMART 等要识别店铺主体国家和角色，不把平台域名当客户官网。',
      '产品推广页/落地页：只有单品堆词、缺少公司主体和联系方式时，保留产品信号但降低可信度。',
      'SEO 采集页/内容农场：大量关键词拼接、跨品类无主体、联系方式弱或模板化，通常低价值或需人工复核。',
      '博客/新闻/资料页：除非能回到明确公司官网，否则不能单独作为客户主体。',
      '信息不足/抓取失败：不臆造客户类型和国家，reviewRequired=true。'
    ],
    companyInfoChecklist: [
      '公司主体：官网显示的公司名、法定/本地语言名称、品牌名、集团/分公司/代理关系。',
      '归属地：注册地址、办公室地址、仓库地址、工厂地址、门店地址、城市、国家、地图链接。',
      '联系方式：公司域名邮箱、部门邮箱、电话区号、WhatsApp、社媒主页、Contact 页面。',
      '经营范围：主营行业、产品目录、服务对象、目标市场、服务区域、代理品牌。',
      '规模与可信度：成立年份、证书、团队、案例、客户行业、仓储库存、授权代理证明。',
      '反向线索：只有个人邮箱、无地址、无公司名、模板站、过度堆词、跨无关品类。'
    ],
    contactQualityGuidance: {
      highQualitySignals: [
        '公司域名邮箱、清晰 Contact 页面、电话区号与地址国家一致、WhatsApp 或社媒与官网主体一致。',
        '地址、电话、邮箱、公司名之间能互相印证，且能定位到具体国家/城市。'
      ],
      mediumQualitySignals: [
        '有通用邮箱或电话但地址不完整；有社媒或地图但缺少公司介绍。',
        '有联系人姓名/职位但邮箱域名或主体归属需要复核。'
      ],
      lowQualitySignals: [
        '只有表单、免费邮箱、无地址、无电话、联系方式与官网主体不一致。',
        '抓取失败或只拿到搜索摘要，需 reviewRequired=true。'
      ],
      riskSignals: ['联系方式国家与目标市场冲突', '电话区号和地址冲突', '邮箱域名像供应商/平台而不是客户官网']
    },
    b2bRoleGuidance: {
      supplySideRoles: [
        'Manufacturer、Factory、Producer、Exporter、Supplier、Trading company、OEM/ODM、wholesale exporter，多数是供应侧。',
        '若用户排除中国供应商，供应侧角色还要结合中国主体强证据判断是否 reject。'
      ],
      buyerSideRoles: [
        'Importer、Distributor、Dealer、Wholesaler、Stockist、Retail chain、Spare parts supplier、Maintenance/service company、Contractor、End user。',
        '本地库存商、授权经销商、维修服务商、行业工程商通常更接近目标客户。'
      ],
      nonTargetRoles: [
        '目录站、招聘站、媒体站、纯新闻/博客、无主体采集页、竞品中国供应商、无关行业网站。',
        '纯 B2C 零售、个人卖家、平台搜索结果页通常不作为高质量 B2B 客户。'
      ],
      roleDecisionRules: [
        '角色判断必须看主营业务和页面语义，不只看 supplier 一个词；海外本地 supplier/stockist 可能是经销商，不一定是制造商。',
        '同一网站既卖产品又做服务时，优先判断它是否服务本地行业客户、是否有进口/库存/代理/维修语义。',
        '无法区分供应侧还是买方侧时，buyerType 写不确定角色，priority 不要 high，reviewRequired=true。'
      ]
    },
    leadValueGuidance: {
      highValueSignals: [
        '目标国家/地区明确，且是进口商、经销商、代理商、批发商、库存商、维修商、承包商或终端行业客户。',
        '官网展示目标产品/型号/应用场景，有本地地址和可触达公司邮箱。',
        '有库存、代理品牌、采购/服务行业、项目案例、售后维修、spare parts 等买家侧需求信号。'
      ],
      mediumValueSignals: [
        '区域和联系方式可信，但产品线只部分匹配。',
        '产品匹配强但客户角色或主体国家需要复核。',
        '看起来是本地供应商/服务商，可能采购或经销目标产品。'
      ],
      lowValueSignals: [
        '只有搜索摘要命中，官网证据少。',
        '产品线弱匹配、客户角色模糊、联系方式较弱但未命中明确排除。'
      ],
      rejectSignals: [
        '明确命中用户勾选的排除类型，例如中国供应商/出口商、纯 B2C、无关行业、目录采集页。',
        '公司主体国家与用户目标市场冲突，且不是目标市场分支/代理/办公室。',
        '官网几乎无真实公司信息或明显 SEO 垃圾站。'
      ]
    },
    productFitGuidance: {
      fitLevels: [
        '高匹配：标题、产品页、URL、官网目录、型号或应用场景直接命中 CRM 产品线/用户目标产品。',
        '中匹配：同类产品、相关配件、替代型号、行业应用匹配，但未直接出现目标型号。',
        '低匹配：只出现泛品类或搜索摘要命中，官网主体未展示清晰产品页。',
        '不匹配：主营行业、产品目录、负面关键词与目标产品明显无关。',
        '风险：产品来源 China/Made in China 只说明供应链或品牌来源，不等于公司主体在中国。'
      ],
      productLineRules: [
        'CRM 产品线是固定基准，用户输入是本次搜索条件；二者都要参考，但不能用用户条件覆盖产品线事实。',
        '产品强匹配但客户角色不清楚时，不直接 reject，priority 可为 low 并 reviewRequired=true。',
        '产品强匹配但主体明确命中用户排除类型时，按排除规则优先。'
      ]
    },
    authenticityRiskGuidance: {
      trustedSignals: [
        '公司主体、地址、电话、邮箱、社媒、地图、产品目录之间一致。',
        '有真实案例、证书、授权代理、库存/仓库/服务网络等可验证信息。'
      ],
      suspiciousSignals: [
        '跨大量无关品类、关键词堆砌、模板化描述、无 About/Contact、联系方式不一致。',
        '页面看似采集不同公司/国家信息，或标题国家与正文主体冲突。'
      ],
      handlingRules: [
        '真实性风险写入 risks；严重时 priority=reject。',
        '只有轻微风险但产品和客户角色较好时，保留为 low/medium 并 reviewRequired=true。'
      ]
    },
    scoreAndOutputMapping: {
      scoringBasis: [
        'score 综合：网站真实性、B2B 客户角色、目标区域匹配、产品线匹配、联系方式质量、排除规则风险。',
        '强排除命中优先于产品匹配；证据不足优先触发 reviewRequired，而不是编造高分。'
      ],
      priorityMapping: [
        'high：目标区域 + 买方侧角色 + 产品高/中匹配 + 联系方式可信，通常 score>=80。',
        'medium：大体匹配但有一个关键不确定项，通常 score 60-79。',
        'low：产品或角色有线索但证据不足/弱匹配，需要人工复核，通常 score 31-59。',
        'reject：无关行业、明确排除、主体国家冲突、明显垃圾/目录采集页，通常 score<=30。'
      ],
      outputFieldMapping: [
        'buyerType 写角色判断；customerGroup 写面向业务的客户群体标签。',
        'companyCountry 只写官网证据能支撑的主体归属国家，不能把产品来源或区域介绍当国家。',
        'targetMarketFit 用 target/uncertain/outside_target 表示目标市场匹配。',
        'matchedSignals 放正向证据原文；risks 放不确定、冲突、排除或真实性风险。',
        'reason 用一句中文解释结论，并至少引用一个关键证据。'
      ]
    },
    selectedExclusionGuidance: exclusionKeys.has('china_supplier') ? [buildChinaSupplierAnalysisGuidance()] : []
  };
}

/** 中国供应商排除来自用户勾选，强制使用证据分级，避免把产品来源误判为公司归属。 */
function buildChinaSupplierAnalysisGuidance() {
  return {
    key: 'china_supplier',
    title: '中国供应商排除融合规则',
    goal: '当用户勾选中国供应商/出口商排除时，只排除公司主体明确在中国大陆的供应商、工厂、出口商或中国平台店铺。',
    chinaRelationClassification: [
      '中国主体供应商：公司地址、电话、备案、平台店铺主体或工商主体明确在中国大陆，且角色是 supplier/factory/exporter，按排除处理。',
      '海外本地经销商销售中国品牌：公司地址和电话在目标国家，只是销售 China brands/Made in China 产品，不按中国供应商排除。',
      '海外进口商从中国采购：Importer from China、sourcing from China、imported Chinese products 更像买方或渠道角色，不按中国主体处理。',
      '跨国集团/区域网络含中国：亚洲区网络、全球分支或品牌覆盖 China，不能证明当前候选页面主体是中国公司。',
      '目录或平台聚合页：先找店铺/公司主体国家；找不到主体时标记 reviewRequired，不把平台或目录页面国家当客户国家。'
    ],
    evidenceReadingOrder: [
      '先看 Contact/About/Footer 的公司主体和地址，再看电话区号、邮箱域名、平台店铺主体。',
      '再看产品页和描述中的 China 语义，区分公司主体、生产地、品牌来源、采购来源、区域网络。',
      '最后结合用户目标区域和排除规则决定 priority，不允许只凭一个 China 词直接 reject。'
    ],
    strongEvidence: [
      '官网 Contact/About/footer/公司地址/注册地址/工厂地址/仓库地址明确在中国大陆或中国省市。',
      '官网联系电话为 +86，或主要联系方式为微信/QQ 且与公司主体绑定。',
      'ICP 备案、中国大陆法律主体、中国银行账户、中国发货港口与该公司主体强绑定。',
      'Alibaba、Made-in-China 等平台店铺主体明确是中国供应商/工厂/出口商。'
    ],
    mediumEvidence: [
      '邮箱为 qq、163、126、foxmail、aliyun 等中国常见邮箱，但没有地址或电话证据。',
      '页面提到 China factory、China warehouse、中国团队、中国员工，但主体地址不清楚。',
      '英文表达像中国外贸站，只能作为风格线索，不能单独定性。'
    ],
    insufficientSignals: [
      'Made in China、China brands、Chinese products、import from China 只说明产品或供应链来源，不等于网站主体在中国。',
      'Importer from China、sourcing from China 往往更像海外买家或经销商，不应按中国供应商排除。',
      '多国家网络、全球分支、亚洲区运营说明里出现 China，不能单独证明当前候选公司归属中国。',
      '中文名、亚洲头像、WhatsApp、销售中国品牌，都不能单独作为中国公司证据。'
    ],
    decisionPolicy: [
      '命中强证据：priority=reject，targetMarketFit=outside_target，score<=30，companyCountry=中国，customerGroup 写中国供应商/非目标海外客户，并在 matchedSignals 引用证据。',
      '只有中等或弱证据：不要强制 reject；写入 risks，targetMarketFit=uncertain，reviewRequired=true。',
      '如果官网同时有目标产品强证据但公司归属不清楚：至少保留 low 并人工复核，不要直接剔除。',
      '如果判断为目录页、平台页或 SEO 采集页：按 marketplace_listing/no_official_website 逻辑处理，不要把目录页国家当客户国家。'
    ],
    outputRequirements: [
      'reason 必须引用具体官网证据，不能只写疑似中国供应商。',
      'matchedSignals 放强证据原文；risks 放弱证据或反向证据。',
      '证据不足时 companyCountry 为空字符串或保留模型已知国家，不要臆造中国。'
    ]
  };
}

/**
 * 读取精准度模型输出；单批输出异常时降级为人工复核，避免整批采集任务失败。
 */
function readAnalysisOutputs(text: string): { items: AiLeadPrecisionCandidateOutput[]; parseErrorMessage?: string } {
  let parsed: { candidates?: unknown };

  try {
    parsed = JSON.parse(text) as { candidates?: unknown };
  } catch {
    return {
      items: [],
      parseErrorMessage: '模型返回的精准度 JSON 无法解析，需人工复核'
    };
  }

  if (!Array.isArray(parsed.candidates)) {
    return { items: [] };
  }

  return {
    items: parsed.candidates.filter(item => item && typeof item === 'object') as AiLeadPrecisionCandidateOutput[]
  };
}

function toPrecisionAnalysis(output: AiLeadPrecisionCandidateOutput): AiLeadPrecisionAnalysis {
  return {
    score: clampScore(output.score),
    priority: normalizePriority(output.priority),
    buyerType: normalizeString(output.buyerType),
    customerGroup: normalizeString(output.customerGroup),
    companyCountry: normalizeString(output.companyCountry),
    targetMarketFit: normalizeTargetMarketFit(output.targetMarketFit),
    reason: normalizeString(output.reason) || '模型未返回匹配原因',
    matchedSignals: normalizeStringArray(output.matchedSignals),
    risks: normalizeStringArray(output.risks),
    recommendedAction: normalizeString(output.recommendedAction),
    reviewRequired: output.reviewRequired === true
  };
}

function createDefaultAnalysis(candidate: AiLeadWebsiteEnrichedCandidate, reason?: string): AiLeadPrecisionAnalysis {
  const crawlFailed = candidate.websiteEvidence?.crawlStatus !== 'completed';

  return {
    score: crawlFailed ? 45 : 60,
    priority: crawlFailed ? 'medium' : 'medium',
    buyerType: '',
    customerGroup: '',
    companyCountry: '',
    targetMarketFit: 'uncertain',
    reason: reason || (crawlFailed ? '官网证据抓取失败，需人工复核' : '模型未返回该客户分析结果'),
    matchedSignals: candidate.websiteEvidence?.keywordHits ?? [],
    risks: reason ? [reason] : crawlFailed ? [candidate.websiteEvidence?.failureReason || '官网证据不足'] : ['模型未返回分析结果'],
    recommendedAction: '人工复核后再开发',
    reviewRequired: true
  };
}

function enforceOfficialCountryMismatch(
  input: AnalyzeCandidatesInput,
  candidate: AiLeadWebsiteEnrichedCandidate,
  analysis: AiLeadPrecisionAnalysis
): AiLeadPrecisionAnalysis {
  const officialCountry = detectOfficialCompanyCountry(candidate.websiteEvidence);

  if (officialCountry !== officialChinaCountry || !shouldRejectOfficialChinaCompany(input)) {
    return analysis;
  }

  const countrySignals = collectOfficialCountryEvidence(candidate.websiteEvidence);
  const matchedSignals = uniqueStrings([...countrySignals, ...analysis.matchedSignals], 8);

  return {
    ...analysis,
    score: Math.min(analysis.score, 25),
    priority: 'reject',
    buyerType: analysis.buyerType || '中国供应商',
    customerGroup: '中国供应商 / 非目标海外客户',
    companyCountry: officialChinaCountry,
    targetMarketFit: 'outside_target',
    reason: `官网地址显示中国公司，不符合当前海外客户开发目标：${countrySignals.slice(0, 2).join('；')}`,
    matchedSignals,
    risks: uniqueStrings(
      [
        '产品页命中目标产品但公司归属为中国，不能按海外客户纳入开发名单',
        ...analysis.risks
      ],
      8
    ),
    recommendedAction: '不纳入开发名单；如需中国供应商名单请单独建搜索任务',
    reviewRequired: false
  };
}

function protectStrongWebsiteProductEvidence(
  input: AnalyzeCandidatesInput,
  candidate: AiLeadWebsiteEnrichedCandidate,
  analysis: AiLeadPrecisionAnalysis
): AiLeadPrecisionAnalysis {
  if (analysis.priority !== 'reject' || !candidate.websiteEvidence) {
    return analysis;
  }

  const productEvidence = collectStrongProductEvidence(input, candidate);

  if (productEvidence.length === 0) {
    return analysis;
  }

  return {
    ...analysis,
    score: Math.max(analysis.score, minStrongProductEvidenceScore),
    priority: 'low',
    buyerType: analysis.buyerType || '官网产品页命中目标产品',
    customerGroup: analysis.customerGroup || '产品命中但需复核客户群体',
    targetMarketFit: analysis.targetMarketFit === 'outside_target' ? 'uncertain' : analysis.targetMarketFit,
    reason: `官网产品页命中目标产品，需人工复核，不应直接剔除：${productEvidence.slice(0, 2).join('；')}`,
    matchedSignals: uniqueStrings([...productEvidence, ...analysis.matchedSignals], 8),
    risks: uniqueStrings(['AI 原判 reject，已因官网强产品证据转人工复核', ...analysis.risks], 8),
    recommendedAction: analysis.recommendedAction || '人工复核后纳入低优先级开发名单',
    reviewRequired: true
  };
}

function detectOfficialCompanyCountry(evidence: AiLeadWebsiteEvidence | undefined) {
  if (!evidence || evidence.crawlStatus !== 'completed') {
    return '';
  }

  if (collectOfficialChinaCompanyEvidence(evidence).length > 0) {
    return officialChinaCountry;
  }

  return evidence.companyCountrySignals?.find(signal => signal !== officialChinaCountry) || '';
}

function collectOfficialCountryEvidence(evidence: AiLeadWebsiteEvidence | undefined) {
  if (!evidence) {
    return [];
  }

  const chinaEvidence = collectOfficialChinaCompanyEvidence(evidence);

  if (chinaEvidence.length > 0) {
    return chinaEvidence;
  }

  return uniqueStrings(
    [
      ...(evidence.companyAddressEvidence ?? []),
      ...(evidence.companyCountrySignals ?? []).map(signal => `官网归属地：${signal}`)
    ],
    8
  );
}

function collectOfficialChinaCompanyEvidence(evidence: AiLeadWebsiteEvidence) {
  const addressEvidence = (evidence.companyAddressEvidence ?? []).filter(hasOfficialChinaAddressSignal);
  const chinaPhones = (evidence.phones ?? [])
    .map(phone => phone.trim())
    .filter(phone => chinaPhonePattern.test(phone))
    .map(phone => `官网联系电话：${phone}`);
  const countrySignals =
    addressEvidence.length > 0 || chinaPhones.length > 0
      ? (evidence.companyCountrySignals ?? [])
          .filter(signal => signal === officialChinaCountry)
          .map(signal => `官网归属地：${signal}`)
      : [];

  return uniqueStrings([...addressEvidence, ...countrySignals, ...chinaPhones], 8);
}

function hasOfficialChinaAddressSignal(value: string) {
  if (!value) {
    return false;
  }

  return value
    .split(/(?<=[。.!?؛;])\s+|\s{2,}| \| /)
    .map(normalizeString)
    .filter(Boolean)
    .some(chunk => chinaAddressSignalPattern.test(chunk) && !weakChinaOriginPattern.test(chunk) && !isRegionNetworkChunk(chunk));
}

/** 判断是否只是多国家网络/区域介绍，不作为公司归属地证据。 */
function isRegionNetworkChunk(chunk: string) {
  const countryMatches = chunk.match(nonChinaCountryPattern) ?? [];

  return regionNetworkPattern.test(chunk) && countryMatches.length > 0;
}

function isTargetingNonChinaMarket(input: AnalyzeCandidatesInput) {
  const leadContextSnapshot = normalizeAiLeadKeywordContextSnapshot(input.keywordPlan.leadContextSnapshot);
  const leadContextRegions = leadContextSnapshot
    ? [
        leadContextSnapshot.targetRegion?.label,
        leadContextSnapshot.targetRegion?.countryCode,
        ...leadContextSnapshot.targetRegions.flatMap(region => [region.label, region.countryCode])
      ]
    : [];
  const targetText = normalizeComparableText(
    [
      input.keywordPlan.resolvedTargetRegions,
      input.keywordPlan.resolvedTargetCustomerProfile,
      input.requirement,
      ...leadContextRegions
    ].join(' ')
  );

  if (!targetText) {
    return false;
  }

  if (/(中国|中國|\bchina\b|\bchinese\b)/i.test(targetText) && !/(海外|国外|外贸|\boverseas\b|\bforeign\b)/i.test(targetText)) {
    return false;
  }

  return /(?:阿联酋|迪拜|沙特|土耳其|中东|海外|国外|外贸|\buae\b|\bdubai\b|\bsaudi\b|\bturkey\b|\boverseas\b|\bforeign\b|\bimporter\b|\bdistributor\b)/i.test(
    targetText
  );
}

function shouldRejectOfficialChinaCompany(input: AnalyzeCandidatesInput) {
  return isTargetingNonChinaMarket(input) || hasSelectedLeadContextExclusion(input, 'china_supplier');
}

function hasSelectedLeadContextExclusion(input: AnalyzeCandidatesInput, ruleKey: string) {
  const leadContextSnapshot = normalizeAiLeadKeywordContextSnapshot(input.keywordPlan.leadContextSnapshot);

  return leadContextSnapshot?.exclusionRules.some(rule => rule.key === ruleKey) ?? false;
}

function collectStrongProductEvidence(input: AnalyzeCandidatesInput, candidate: AiLeadWebsiteEnrichedCandidate) {
  const evidence = candidate.websiteEvidence;

  if (!evidence || evidence.crawlStatus !== 'completed') {
    return [];
  }

  const phrases = collectProductPhrases(input);
  const tokens = collectProductTokens(input);
  const evidenceText = normalizeComparableText(
    [
      candidate.title,
      candidate.snippet,
      candidate.url,
      candidate.website,
      evidence.finalUrl,
      evidence.title,
      evidence.description,
      ...evidence.keywordHits,
      ...evidence.evidenceSnippets
    ].join(' ')
  );
  const matchedPhrases = phrases.filter(phrase => evidenceText.includes(phrase));
  const matchedTokens = tokens.filter(token => evidenceText.includes(token));
  const signals = uniqueStrings([...matchedPhrases, ...matchedTokens], 6);

  if (matchedPhrases.length > 0 || matchedTokens.length >= 2 || hasProductKeywordHit(evidence, tokens)) {
    return signals.length > 0 ? signals : uniqueStrings(evidence.keywordHits, 6);
  }

  return [];
}

function collectProductPhrases(input: AnalyzeCandidatesInput) {
  return uniqueStrings(
    [
      input.keywordPlan.resolvedProductKeywords,
      ...collectProductLineKeywordSources(input.keywordPlan),
      ...splitKeywordText(input.keywordPlan.resolvedProductKeywords),
      ...splitKeywordText(input.requirement)
    ]
      .map(normalizeComparableText)
      .filter(phrase => phrase.length >= 4 && !buyerSignalKeywords.has(phrase) && !commonRequirementTokens.has(phrase)),
    24
  );
}

function collectProductTokens(input: AnalyzeCandidatesInput) {
  const sourceText = [
    input.requirement,
    input.keywordPlan.resolvedProductKeywords,
    input.keywordPlan.resolvedTargetCustomerProfile,
    ...collectProductLineKeywordSources(input.keywordPlan)
  ].join(' ');

  return uniqueStrings(
    normalizeComparableText(sourceText)
      .split(/[^a-z0-9]+/i)
      .filter(token => token.length >= 4 || /^\d{3,}$/.test(token))
      .filter(token => !buyerSignalKeywords.has(token) && !commonRequirementTokens.has(token)),
    32
  );
}

function splitKeywordText(value: string | undefined) {
  return (value ?? '')
    .split(/[,，;；|、/]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function collectProductLineKeywordSources(keywordPlan: OptimizedKeywordPlan) {
  const productLine = keywordPlan.productLineSnapshot;

  if (!productLine || typeof productLine !== 'object' || Array.isArray(productLine)) {
    return [];
  }

  return [
    'name',
    'targetCustomerType',
    'coreSellingPoints',
    'commonModelsText',
    'certifications',
    'moq',
    'leadTime'
  ]
    .map(key => (productLine as Record<string, unknown>)[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function hasProductKeywordHit(evidence: AiLeadWebsiteEvidence, productTokens: string[]) {
  if (productTokens.length === 0) {
    return false;
  }

  return evidence.keywordHits.some(hit => {
    const normalizedHit = normalizeComparableText(hit);

    return productTokens.some(token => normalizedHit.includes(token));
  });
}

function normalizePriority(value: unknown): AiLeadPrecisionPriority {
  return value === 'high' || value === 'medium' || value === 'low' || value === 'reject' ? value : 'medium';
}

function normalizeTargetMarketFit(value: unknown): AiLeadTargetMarketFit {
  return value === 'target' || value === 'uncertain' || value === 'outside_target' ? value : 'uncertain';
}

function clampScore(value: unknown) {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : 50;

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeString).filter(Boolean).slice(0, 8) : [];
}

function normalizeComparableText(value: unknown) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map(normalizeString).filter(Boolean))).slice(0, limit);
}
