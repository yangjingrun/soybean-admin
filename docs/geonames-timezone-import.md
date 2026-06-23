# GeoNames 城市时区字典导入

本项目用 GeoNames 城市名数据为 CRM 客户补充 IANA 时区，优先支持多语种城市名，例如阿拉伯语城市名。

## 数据来源

- 城市文件：`https://download.geonames.org/export/dump/cities15000.zip`
- 更高覆盖：`https://download.geonames.org/export/dump/cities1000.zip`
- GeoNames 数据采用 Creative Commons Attribution 许可，产品文档或关于页需要保留数据来源说明。

## 导入命令

```bash
curl -L -o /tmp/cities15000.zip https://download.geonames.org/export/dump/cities15000.zip
unzip -p /tmp/cities15000.zip cities15000.txt > /tmp/cities15000.txt
pnpm --filter @soybean/server import:geonames -- --cities /tmp/cities15000.txt
```

先预览解析数量可以加 `--dry-run`：

```bash
pnpm --filter @soybean/server import:geonames -- --cities /tmp/cities15000.txt --dry-run
```

导入会刷新 `CrmGeoCityName` 表；CRM 导入客户时按 `country + city` 查询该表，查不到再回退到本地国家/城市规则。
