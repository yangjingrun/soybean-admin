ALTER TABLE "AiLeadDirectorySourceRule"
  ADD COLUMN IF NOT EXISTS "builtin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AiLeadDirectorySourceRule_builtin_idx"
  ON "AiLeadDirectorySourceRule"("builtin");

INSERT INTO "AiLeadDirectorySourceRule"
  (id, value, "matchMode", enabled, builtin, description)
VALUES
  ('builtin-domain-yellowpages-uae-com', 'yellowpages-uae.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-yellowpages-uae-ae', 'yellowpages-uae.ae', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-yellowpages-ae', 'yellowpages.ae', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-reachuae-com', 'reachuae.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-atninfo-com', 'atninfo.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-dcciinfo-com', 'dcciinfo.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-connect-ae', 'connect.ae', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-yello-ae', 'yello.ae', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-aiwa-ae', 'aiwa.ae', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-uaebusinessdirectory-com', 'uaebusinessdirectory.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-yallapages-ae', 'yallapages.ae', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-dubaibusinessdirectory-com', 'dubaibusinessdirectory.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-abudhabidirectory-com', 'abudhabidirectory.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-saudiyellowpagesonline-com', 'saudiyellowpagesonline.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-saudiayp-com', 'saudiayp.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-ksadirectoryonline-com', 'ksadirectoryonline.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-kuwaityellowpagesonline-com', 'kuwaityellowpagesonline.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-yellowpages-qa', 'yellowpages.qa', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-omanyellowpagesonline-com', 'omanyellowpagesonline.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-bahrainyellowpagesonline-com', 'bahrainyellowpagesonline.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-arabiantalks-com', 'arabiantalks.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-gulfyp-com', 'gulfyp.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-mymidlist-com', 'mymidlist.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-yellowpagegulf-com', 'yellowpagegulf.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-allofgcc-com', 'allofgcc.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-thegulfdirectory-com', 'thegulfdirectory.com', 'domain_suffix', true, true, '系统内置黄页/目录域名'),
  ('builtin-domain-gulf-business-net', 'gulf-business.net', 'domain_suffix', true, true, '系统内置黄页/目录域名')
ON CONFLICT (value, "matchMode") DO UPDATE
SET builtin = true,
    enabled = true,
    description = EXCLUDED.description,
    "updatedAt" = now();
