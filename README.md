# 重庆 · 地点与影像地图

按地点查看重庆旅行视频关键帧与核验说明，支持电脑和手机屏幕。

[打开在线地图](https://key-kun.github.io/chongqing-travel-map/)

## 使用

- 电脑点击地图标记或地点列表；手机从底部“地图 / 找地点 / 详情”切换。
- 地图左上角“标记显示”可在分类字和地点名之间切换，记住上次选择；聚合数字展开后显示具体地点，手机在“地图”页切换。
- 搜索地点名、片区或原报告编号，按片区、类别和定位状态筛选。
- 点击截图查看原图，使用前后按钮或方向键切换，Esc关闭；手机触屏支持左右滑图。
- 主城、全部点位、大足和武隆可切换地图范围。地点列表底部可查看全部84张关键帧。

## 资料范围与来源

- 116条原报告记录全部可追溯，拆分和截图补录后共163个地点：78个已定位、85个待定位。
- 84张原截图均保留。共用画面可能是地图总览或照片插图，不代表各地点有独立实景证据。
- 报告日期：2026-09-12；坐标核对日期：2026-10-02。位置可确定不代表现时营业、开放或入口已核实。
- 视频来源：[哔哩哔哩 BV1ThXHY2EpQ](https://www.bilibili.com/video/BV1ThXHY2EpQ)。具体时间戳、摘录、检查结论和外部信息来源在地点详情中保留。
- 地图坐标统一为WGS84；部分高德来源坐标逆转换为近似WGS84，转换说明保留在详情中。

## 发布

本仓库为无构建步骤的静态网页，文件使用相对路径，适配GitHub Pages项目网址。

GitHub Pages的发布来源设置为 `main` 分支、`/ (root)`。根目录 `.nojekyll` 禁用Jekyll处理。推送更新到main后由GitHub自动发布。

网页、依赖和截图由GitHub Pages提供；真实底图仍按当前视图联网请求OpenStreetMap。底图中断时，已加载网页的地点资料与截图仍可查看；未下载的网页和截图仍需要网络。没有批量下载或打包OSM底图。

## 署名与许可

- 地图数据与底图：© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，遵循[标准瓦片使用规则](https://operations.osmfoundation.org/policies/tiles/)。
- Leaflet 1.9.4：BSD-2-Clause，许可文本见 `vendor/leaflet-LICENSE.txt`。
- Leaflet.markercluster 1.5.3：MIT，许可文本见 `vendor/markercluster-LICENSE.txt`。
- 视频截图及画面中的照片、文字等权利归相应权利人；本仓库保留原图署名和来源，不对这些素材授予额外许可。
