# GeoNames 城市时区字典导入

本项目用 GeoNames 城市名数据为 CRM 客户补充 IANA 时区，优先支持多语种城市名，例如阿拉伯语城市名。

## 数据来源

- 城市文件：`https://download.geonames.org/export/dump/cities15000.zip`
- 更高覆盖：`https://download.geonames.org/export/dump/cities1000.zip`
- 可信多语言别名：`https://download.geonames.org/export/dump/alternateNamesV2.zip`
- GeoNames 数据采用 Creative Commons Attribution 许可，产品文档或关于页需要保留数据来源说明。

## 导入命令

```bash
curl -L -o /tmp/cities15000.zip https://download.geonames.org/export/dump/cities15000.zip
unzip -p /tmp/cities15000.zip cities15000.txt > /tmp/cities15000.txt
curl -L -o /tmp/alternateNamesV2.zip https://download.geonames.org/export/dump/alternateNamesV2.zip
unzip -p /tmp/alternateNamesV2.zip alternateNamesV2.txt > /tmp/alternateNamesV2.txt
pnpm --filter @soybean/server import:geonames -- --cities /tmp/cities15000.txt --alternate-names /tmp/alternateNamesV2.txt
```

先预览解析数量可以加 `--dry-run`：

```bash
pnpm --filter @soybean/server import:geonames -- --cities /tmp/cities15000.txt --alternate-names /tmp/alternateNamesV2.txt --dry-run
```

导入会刷新 `CrmGeoCityName` 表；CRM 导入客户时按 `country + city` 查询该表，查不到再回退到本地国家/城市规则。

`cities*.txt` 自带的 alternate names 没有语言和首选标记，只用于搜索匹配；城市中文展示名只使用 `alternateNamesV2.txt` 里带 `zh/zh-CN/zh-Hans/zh-Hant/zh-TW/zh-HK/zh-MO/cmn/yue` 语言标记的别名，避免把历史名、区名或机场别名误当作城市名展示。
