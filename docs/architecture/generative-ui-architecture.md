# 对话可视化与历史 GenUI

## FlowChat 的交互式可视化

新回复可以保存为 `openbitfun://current-session/artifacts/visualizations/v2/<slug>.html`。FlowChat 按原始内容引用中的 URI 找到同一轮、同一子 Agent 的成功 Write，使用调用中保存的字节创建隔离的 iframe。同轮 Edit 在回复发出前生效。执行端在成功的 Write 和 Edit 结果中记录会话 URI；通过该会话本地存储目录的绝对路径修改图时，也会带上同一 URI。新的 Edit 还保存该次修改的完整源码。执行端完成对话轮次时，将最后一次通过检查的 Write 或 Edit 中的原始源码和 UTF-8 字节数保存在该轮记录中。旧版写入记录沿用完成时的文件快照。通过脚本生成的图也能发布，前提是该轮使用了可视化技能，且被引用的文件在该轮内生成或修改。FlowChat 收到已完成的回复和重开历史消息时都使用这份源码。读取旧回复时，执行端从已记录的 Write 或完整 Edit 开始，按顺序精确回放截至该条回复的修改。后续对话可以只修改已有图，新的回复使用当轮 Edit 返回的完整源码，上一条回复保持修改前的样子。生成成功后，图直接出现在回复里。若模型在最终文本里漏写内容引用，FlowChat 会在已完成的该轮回复中补上有成功记录的图，已引用的图只显示一次。原版图表的 `mountChart`、四个专用组件、地图、插图、变体轮播和设计控件都能使用同一入口。参考图仅用于测试。模型按用户的题目自行编排内容。 FlowChat 将当前聊天区域的颜色和字体通过展示通道传给已打开的图。切换主题或皮肤时，图内使用原版 CSS 变量的标记和控件会随之更新，交互状态留在原来的文档中。

常规构建随源码提供 OpenBitFun 的技能入口、隔离渲染外壳、Apache ECharts 和离线地图。Vite 打包地图投影 worker 及其数据，Rust 嵌入技能。构建入口会通过 SHA-256 检查随仓库分发的依赖和地理数据，开发者也可以运行 `pnpm run visualize:verify` 单独检查。Write 和 Edit 在桌面后台实际渲染并返回本次产物的引用；无图形宿主时检查延至阅读端。Codex Visualize 1.0.103 的本地兼容套件是可选项。已有原包的开发者可以运行 `pnpm run visualize:prepare` 导入扩展指南及兼容资源。

普通城市标注图可以在技能交付的 HTML 中声明地点及可选范围。FlowChat 使用随产品分发的 Natural Earth 底图与地名，将声明投影成 SVG，检查城市标注和底图并保存该次检查的 SVG。断网重开历史图时，地理图层已经包含在回复中。皮肤控制画布和字体，水域、陆地、标记各自使用独立的语义颜色。

![暖色主题下的长三角城市标注图](../images/flowchat-regional-map.png)

宿主绑定 `window.openai.setWidgetState`、`visualization.onData` 和 Tweak。阅读状态按设备来源、会话、对话轮次、模型轮次、写入及 URI 保存，单份上限 16 KiB。追问可携带 `modelContent`。`privateContent` 留在阅读端。部分已有图把选择保存在 `privateContent`，却从 `widgetState` 顶层读取。阅读端提供不可枚举的同名读取属性，保留已有顶层字段，持久化和追问仍使用原有格式。原版导出脚本支持按需生成独立 HTML。

数据声明使用片段开头的 `vis-bindings`。JSON 直接返回，图片声明提供 HTTPS 地址，相对文件和 `libfile_…` 数据从同一轮已完成的写入中取值，工具输入必须与同轮成功的调用一致。打开「数据来源」可以查看声明、订阅此会话以后完成的匹配结果，或将刷新请求放入输入框，由正常的 Agent 工具权限流程执行。读者还可选取已连接的 MCP 服务所公布的只读资源，按声明的间隔更新 JSON 或文件。关闭来源面板时连接继续，离开图表时结束。连接失败或未能取得数据时，来源面板显示当前状态。使用远程工作区时，图表回放读取原会话记录，连接宿主 MCP 资源会提示不可用。

浏览器验收运行 `node scripts/test-visualize-host.mjs`。默认使用本地 Vite 测试页，`OPENBITFUN_VISUALIZE_OFFLINE=1` 拦截外部网络，`OPENBITFUN_REFERENCE_FRAGMENT` 可指定用于对照的原图。使用 `OPENBITFUN_VISUALIZE_TEST_SKIN` 可替换默认测试皮肤。

## 早期 visualize 会话产物

启用内置 `visualize` 技能的会话可以通过普通 Write 生成 HTML。模型在回复里用单独一段 Markdown 链接引用 `openbitfun://current-session/artifacts/visualizations/<slug>.html`，链接文字提供纯文本摘要。组件输入及示例见[技能契约](../../src/crates/assembly/core/builtin_skills/visualize/references/components.md)。

FlowChat 按会话、轮次和子 Agent 身份查找该段文字之前最后一次成功的对应 Write。历史呈现使用工具调用中已记录的 HTML，并对照 Write 结果的 UTF-8 长度；同名文件的后续修改不会改变此前回复。已有 Write 记录可用 bytes_written 校验，新结果另外包含 content_bytes，支持重复写入相同内容时的校验。记录缺失、传输截断或格式未知时保留文字摘要并说明交互不可用。读取记录不需要沿链接打开文件或访问控制端的工作区。无图形渲染的入口可以呈现原有 Markdown。

版本 1 使用惰性 HTML 模板解析声明式 figure，用产品自带的图表运行时呈现已校验的数据，普通 HTML 使用禁用脚本的隔离文档。筛选和所选行属于当前阅读设备的视图偏好，按来源设备、会话、回复和写入记录保存。追问由阅读者加入输入框，阅读者可以修改和发送。旧的 GenerativeUI 工具已退出注册表、智能体默认工具、能力搜索及组件库设置。历史记录保留原有 schema 和组件库版本，直接调用和 CallDeferredTool 的旧消息均按只读方式回放。当前运行时使用通用工具参数事件；旧主机发送或日志中保存的 GenUIStream 仍可解码。打开历史消息不会向模型提交修复请求。

## 组件验收

对照 Codex visualize 1.0.103 的 charts 1.6.5 与 widgets 1.0.59 文档，OpenBitFun 使用独立的声明式输入和本地渲染器。可信代码随产品提供。macOS WKWebView 也验证了图表筛选、参数滑块、请求自身耗时、非连续 CPU 调用与刷新恢复。以下用例通过实际组件数据验算以及 Chromium 中的 FlowChat 回复回放检查。可运行的验收位于 [图表断言](../../src/web-ui/src/tools/visualize/components.test.ts) 和 [浏览器用例](../../scripts/test-visualize-browser.mjs)。

| 组件 | 核对内容 |
| --- | --- |
| 折线 | 数值横轴排序、零值和缺口、参考线、点标注与置信带 |
| 面积 | 绝对堆叠与零观测 |
| 柱状 | 横向布局，隐藏系列后百分比重新归一化 |
| 饼图 | 环形比例、中心值与份额 |
| 直方图 | 原始观测重复计数、最大值归箱、非等宽密度面积 |
| 收支瀑布 | 起止余额核对、负值跨零 |
| 热力图 | 类别次序、颜色值域与空单元格 |
| 散点 | 分组拟合、二次拟合、退化输入 |
| 漏斗 | 保留给定阶段顺序，区分零值和缺失 |
| 箱线 | 原始观测插值四分位、离群点、给定五数概括 |
| 迷你趋势图 | 隐藏轴和点、键盘读数 |
| 排名 | 三种排序与展开剩余行 |
| 桑基 | 多阶段同名节点与共享流量汇总 |
| 日历 | 日周月切换、事件详情和恢复 |
| 请求瀑布 | 嵌套重叠耗时、父行折叠、关键路径、缩放与恢复 |
| CPU 火焰图 | 空闲区间、非连续调用、递归、函数汇总与恢复 |
| 错误堆栈 | 异步边界、运行时分组、源代码行和原始异常链 |
| 基础交互 | 卡片、表格、按钮、表单、键盘标签页、进度条、参数滑块与追问草稿 |

`layers` 是 OpenBitFun 给分层架构概览提供的组件。它按给定顺序显示各层，支持鼠标和方向键切换职责、路径和代表模块。窄屏把详情移到图下方，重新打开同一条回复可恢复阅读位置。

图解型标签页复用 `tabs`。每页可组合流程节点、可切换的方案和有序层级；节点使用内置线稿，也可提供自定义 SVG 路径。产品对照用例保留了 Codex 示例的三个视角、四种工作模式与四种远程场景。图随消息排版，阅读位置由当前设备保存。

## 旧版 GenUI 设计记录

下文记录旧版生成链路和组件格式，供历史回放与跨版本排查使用。


本文定义 GenUI 的目标产品和运行时边界。迁移未完成前，已接线代码仍是生产事实；本文中的目标能力不得据此描述为已交付。产品架构索引链接到本文件，本文件是 GenUI 架构的唯一专题设计文档。

### 产品决定

GenUI 提供两种源码表达，共用应用身份、版本、状态、宿主能力、持久化、候选验收和远程归属：

| 路径 | 模型生成的源码 | 适用范围 |
| --- | --- | --- |
| 组件应用 | OpenUI Lang 描述 | 表单、列表、看板、数据应用及可信组件可表达的交互 |
| 自由文档 | HTML、CSS、SVG，可选受控 JavaScript | 特殊排版、可视化、动画和组件库难以表达的交互 |

创建应用时，用户选择组件库及其绑定的 UI 规范配置。规范配置同时适用于两种源码类型，不是只供模型参考的风格 prompt。它定义可用组件库、样式资源、设计规则、支持的源码类型、目标视口、宿主绘制的外壳区域和必需验收项。自由文档必须在该视口中真实渲染、检查并根据可测诊断修正；不能从提示词或静态源码扫描推断其符合规范。

默认 `openui` profile 复现 Open Intelligent UI 的即时回答路径：模型流式输出 OpenUI Lang，Renderer 直接在 FlowChat 内联渲染，本地状态和声明动作立即生效，也不自动打开右侧工作台。只有显式选择 `harmony` profile 时，才进入 profile → design spec → viewport/shell → checker 的交付分层并提供侧栏展开；这套交付分层吸收 `harmony-genui` 的做法，把组件库选择绑定到可持久化、可执行验收的生成目标。OpenBitFun 将 Harmony 交付模式收敛到自己的应用 owner、权限和远程执行边界内。

组件路径直接采用 OpenUI `lang-core` 和 `react-lang` 的语言运行时。产品可以注册和扩展可信组件库；模板提供可选的起始结构和生成提示，不能限制模型自由组合现有组件。组件能力不足时，或用户明确要求自由设计时，使用自由文档路径。生成失败本身不是切换路径的理由；描述错误应携带诊断修复，只有组件表达能力不足才改用自由文档。旧的语义消息图已经退役；`source` 缺省的记录不可执行，必须由用户显式重新生成 OpenUI/HTML source。新组件生成只写入 `source.kind = openui-lang`。

模型不得生成 TSX、React 源码或其他需按应用编译的代码。不得恢复 Canvas TSX 编译链。可信组件的实现可以由产品开发者用 React/TSX 编写并随应用构建发布；这不属于模型生成执行路径。

MiniApp 保持自己的源码、打包、安装、权限及运行生命周期。GenUI 使用已有宿主和 Runtime 能力时通过其稳定接口，不把 MiniApp 改造成另一种 GenUI 源码格式。

### 系统边界

```mermaid
flowchart TD
    L[可信产品组件库与可选模板] --> O[OpenUI Lang 源码]
    O --> OR[OpenUI 解析、绑定、状态与组件渲染]
    D[HTML / CSS / SVG / 受控 JS 源码] --> DR[隔离文档渲染器]
    OR --> A[共同 GenUI 应用 owner]
    DR --> A
    A --> H[有权限的宿主能力适配器]
    A --> V[候选检查与证据]
    V --> C[按 owner revision 原子接受]
    A --> S[源码、用户状态和修订持久化]
    H --> R[现有 Agent Runtime / 平台能力]
```

语言解析和渲染留在各自运行时；产品数据与交付生命周期只由一个应用 owner 管理。禁止把 OpenUI 源码翻译到旧节点图或流程解释器后再执行，也禁止把两种源码都转换成任意 HTML/JS 后失去各自的类型和信任边界。

| 所有者 | 职责 | 禁止事项 |
| --- | --- | --- |
| Agent 工具与 Assembly | 选择生成类型、固定组件库与 UI 规范 ID/修订、生成提示和候选身份 | 实现组件、文件 IO、浏览器沙箱或持久化 |
| OpenUI 产品库 | 组件契约、组合、提示、renderer、纯函数和受信任动作声明 | 访问会话 store、平台 API 或直接写用户数据 |
| 自由文档运行时 | 静态文档渲染、隔离脚本执行、桥接消息协议 | 暴露 Tauri、Node、宿主凭据或任意未经授权的接口 |
| GenUI 应用 owner | 源码/状态修订、候选、CAS、保存重开、证据和来源归属 | 解析或重新实现 OpenUI Lang 语义 |
| 平台与 Runtime adapter | 对文件、工具、Agent、网络和其他宿主能力做授权执行 | 使用控制端本地上下文代替目标 owner 的归属 |
| 候选 checker | 在隔离实例中检查源码、实际渲染和声明交互 | 触碰正式用户状态或产生真实外部副作用 |

### OpenUI 组件路径

#### Library Registry 与组件库适配器

OpenUI 提供共同的 Lang/parser/state/Renderer 运行时，同时注册三套可独立选择的 profile：`openui` 使用上游 `openui.v1` native library，`openbitfun` 使用 `openbitfun.composable.v1`，`harmony` 使用 `openbitfun.harmony.v1`。每套 profile 都绑定自己的 adapter、prompt、CSS/style resources、design spec 和 revision；只读契约是同一 adapter 的明确权限变体，不能改变其来源身份。

`openbitfun` adapter 用 `@openbitfun/ui` 承载 Button、IconButton、Input、Textarea、Select、SegmentedControl、Checkbox、Radio 和 Card 等基础控件，再用 `oiComponents` 保留 Chart、Map、Svg、HtmlView、Table 和媒体等 GenUI 专用 renderer；所有实现都先绑定 OpenBitFun 的 contract 和 positional signature，再经过 adapter 自己的 DOM inspector、action/query bridge、CSS/token scope 和 revision 校验。`openui` profile 则直接使用 vendored `open-intelligent-ui/src/lib/library.ts`、其 `components/*` 和 CSS；它不经过 `oiComponents`。任何 profile 都不会携带第二套 parser、state 或旧 graph runtime。

应用保存 `libraryId` 与 `libraryRevision`，并在 owner readback、candidate evidence、远程请求和重开时逐字段校验。设置页只改变下一次生成使用的 registry entry；已接受应用由保存的 identity 解析 schema、prompt、designSpec、renderer 和 bridge，不能通过 template 或全局配置重新推断组件库。未知或缺少 identity 的记录保留原始内容并显示不可运行状态，禁止换成 OpenUI、OpenBitFun 或 graph fallback。

HOS7 暂不属于受支持的 GenUI 目标，不进入当前 library registry、生成 schema 或交付路径。后续如重新支持，必须以独立 adapter、明确许可、目标端能力协商和单独验收契约重新接入。Harmony-genui 只提取 design-system、token 和 Plot 能力，不嵌入旧 graph/schema/action runtime。

#### 组件库与模板

以 OpenUI 的 `defineComponent`、`createLibrary` 和 `library.extend` 作为组件描述、schema、说明、renderer、函数、动作与组合规则的定义机制。产品注册可信实现；模型只能引用当前构建和产品配置实际提供的组件。添加、替换和移除组件必须同步影响生成提示及运行时校验，不能另外手写一份模型专用组件目录。

模型上下文必须同时包含 OpenUI Lang 的最小语法和当前 profile 的可执行提示。`openui` 使用上游生成的 system prompt 和上游 library spec；`openbitfun`、`harmony` 则从各自 catalog library 派生位置参数签名和 worked examples。Rust 工具 schema 只暴露当前 profile 的 template、library、revision 和 design spec，系统提示也只注入当前 profile 的 library。组件路径中的 `createRecord`、`patchRecord` 等旧兼容图动作不应被提示为 OpenUI `@` 动作。

同一产品可以提供多个有明确版本的组件库或扩展。组件库 ID 和修订在候选创建时固定，设置变化只作用于新候选。已有应用按它保存的库契约解析；未知库、运行时或组件版本应保留原始数据并显示不可用状态，不静默换库。

模板是可选的初始示例和任务约束。没有适合模板时仍可从所选库的合法根组件开始自由组合。组件库、模板、生成提示和检查器共享一份构建期产品定义；Rust 边界只验证通用 envelope、源码格式标识和 owner 约束，不复制 OpenUI parser 或运行语义。

组件作者提供实际 renderer、限于组件拥有 DOM 的 `inspect`，以及声明事件的隔离 `exercise`。探针只生成隔离状态，不得调用正式保存、权限接口或外部工具。任何外部副作用均通过 OpenBitFun 注册的宿主能力，遵守现有权限、取消、deadline、重试及远程 mailbox 语义。需要原子性的多步操作由一个 owner mutation 完成；OpenUI 顺序动作不自动等于事务。

#### UI 规范配置与目标身份

产品配置以同一个版本化清单声明组件库 profile 与 `designSpec` 的绑定。规范至少包含 `componentLibraries`、`styleResources`、`rules`、`sourceKinds`、`viewport`、`shell` 和 `acceptance.checks`；构建校验确保 profile 的每个模板只使用规范允许的组件库。模型上下文收到选中规范的完整约束和资源 ID，模型不能自行选择或覆盖该身份。Rust owner 从受信任 profile/既有 owner 解析它，并在候选 app 中写入 `{ id, revision }`。

`designSpec` 是应用目标身份的一部分，与源码修订和状态分开持久化，但在候选 CAS、保存、重开和远程执行期间固定。修改既有 app（相同 app ID）继承 owner 已接受的规范，即使当前全局设置已改变；设置只决定新 app。显式更换规范必须是可检查的新 app 修订，检查组件库兼容性与用户数据迁移，不能在打开应用时跟随设置漂移。旧记录缺少该字段时显示不可运行，不再按模板推断或改写身份；未知/已移除规范保留原值并显示不可运行。

Owner 的读取和状态保存请求必须回显 `libraryId`、`libraryRevision`、`designSpec` 与 `sourceKind`；目标 owner 会把它们与已接受修订逐字段比较，缺失或不一致都返回 unsupported/error，不允许另一套 adapter 或源码类型的响应冒充当前应用。

规范的 `shell` 区分宿主绘制与生成内容。Harmony 手机规范固定 360 x 764 CSS px 视口，36 px 状态栏和设备外壳由宿主绘制，内容左右 inset 为 16 px，目标内容宽度 328 px。模型只能生成屏幕内容。OpenUI 组件路径使用规范绑定的 Harmony OpenUI library；HTML/CSS/SVG 路径收到同一身份、资源与规则，在相同宿主 shell 和固定视口验收。实际 DOM/几何检查至少验证视口尺寸、宿主 shell 部件、内容边界和横向溢出，并将精确诊断返回候选修正。若自由文档仍违规，修正后必须重跑同一规范检查；提示词本身不是通过证据。

#### 流式和交互

从 Agent 工具参数事件中增量提取 OpenUI Lang 文本，使用 OpenUI 流式 parser 投影逐步完成的语句。传输 adapter 只负责解包、解转义、识别重置和追加，不解析语言、不重新实现语句缓存。组件预览使用固定的库修订；首屏允许本地状态交互，但会产生外部副作用的 action 仍须经过 owner、权限和交付层。候选结束后，完整原文必须经同一 OpenUI library 终态解析，且不得有未完成语法、未解析引用或阻断性 schema 错误。

React 组件身份和列表 key 必须经过真实插入、删除、重排测试。OpenUI statement ID 不等于所有数组渲染都具有稳定项身份；不能仅凭 parser 缓存断言焦点、输入状态或局部组件状态不会错位。确有上游缺口时优先以可追踪补丁修复或向上游提交，不复制 parser。

持久化的 OpenUI 用户状态使用版本化 JSON 数据，恢复后交给 `Renderer.initialState`，更新交给 `onStateUpdate` 与应用 owner。前端编辑态可以立即更新，只有 owner 确认写入后才能报告保存成功。外部查询和 mutation 必须进入宿主能力；状态更新不能绕过 owner CAS。

### HTML / SVG 自由生成路径

自由文档将 HTML、CSS 和 SVG 作为文档源码保存；交互脚本是独立、可选的源码字段。页面源码可以组织自己的 DOM、图形和动画，不能内嵌 TSX 构建器、远程脚本包或隐式模块加载器。模型不能通过脚本直接调用文件系统、Shell、内部 API、用户凭据或正式持久化。

隔离文档使用独立的 sandboxed iframe 和不透明 origin。允许执行脚本时使用 `sandbox="allow-scripts"`，不授予 `allow-same-origin`、表单提交、弹窗或顶层导航权限。宿主不通过 `contentDocument.write` 执行候选；以受控 `srcdoc`/文档更新通道交付源码，并在目标平台确认嵌入 API 不会把 Tauri 能力注入子文档。

内容策略默认拒绝网络、子框架、对象、表单目标、外部字体和外部脚本。候选检查和流式预览阶段不执行脚本；只在源码封存后的隔离检查实例启动脚本。HTML 预处理必须使用支持 SVG 的结构化 parser/sanitizer，删除脚本元素、内联事件属性、危险 URL 和不支持的嵌入资源；最终受控脚本从独立字段装载。拒绝 `eval`/`new Function`、动态 import 和远程模块。确有资源需要时，通过目标 owner 上明确定义并经授权的资源能力提供，不直接放开通用网络访问。

当前实现已经接通 `source.kind = openui-lang` 和静态自由文档 `source.kind = html-document`：前者交给 `@openuidev/react-lang` 的 OpenUI parser/renderer，并由产品 catalog 适配可信组件；后者把 HTML/CSS/SVG 以源码字段持久化，经过当前 HTML sanitizer 后放入不透明 origin 的全限制 sandbox iframe。脚本策略由宿主显式控制；检查模式使用一次性 nonce CSP，并在检查时禁用候选脚本。两者共用 designSpec、宿主外壳、布局检查、候选 CAS 和保存重开流程。自由文档 iframe 接收 designSpec/style-resource 元数据，并在宿主可提供 token 时复制受控的 OpenBitFun CSS token 基线，使 Harmony 的实际屏幕背景、文字和 SVG 默认使用同一套宿主资源；生成文档仍可显式覆盖自己的内容样式，规范检查继续以实际几何和宿主边界为准。OpenUI 的表单状态回调已经接入 owner 保存，组件声明的 action 通过 `Renderer.onAction` 传给 owner，`Query`/`Mutation` 通过 `GenUIAsyncRuntimeController` 适配成 OpenUI 的 `toolProvider`；它保留 OpenUI 的 cache/loading/error/retry 语义，并额外携带 AbortSignal、request identity、permission、target 和 targetId。已授权的 `ChatMcpCatalog` 通过 `createGenUIMcpProvider` 映射为同一 provider：只允许 catalog 中的 server/tool，JSON-RPC `result`/`error`、structured content 和 text content 在边界层解包，Mutation 必须由宿主显式列入声明。`Image`/`SearchImage` 的图片搜索、显式 URL 失败后的候选回退、`Map` 的异步 marker 查询和可选路线查询也使用同一 capability registry；宿主内置 provider 通过 `gen_ui_provider_call` 统一承接 360 图搜、百度图搜、Wikipedia/Commons、Nominatim、OSRM 和 Valhalla，组件不直接访问外部 `/api`。已授权的 MCP 同名 capability 优先，内置 provider 填充缺口；当宿主命令或目标端确实不可用时才保持显式 unsupported。source 替换、组件查询变化和卸载都会取消请求，迟到结果不能回写旧文档。自由文档的 `script` 默认仍不执行；只有宿主显式传入命名 `htmlBridge` 时才使用 `sandbox="allow-scripts"`，脚本通过 `window.openbitfunWidget.request` 发消息，父层校验 frame 来源、capability 名称并带 app/source/designSpec 身份调用 handler，再把结果返回。脚本入口会阻断 `eval`、`new Function` 和动态 `import`，CSP、opaque origin、无 same-origin/网络/表单/导航权限继续有效。产品仍需为每个宿主能力注册参数 schema、权限、取消和远程归属；iframe 不能被当作 CPU/内存级沙箱。生成脚本可以随自由文档源码保存，但在尚未协商出受控桥接能力的 host 上保持禁用。

自由文档的实际交付检查还会由宿主向 opaque iframe 注入一次性的只读 inspection probe。probe 不执行候选脚本，也不读取宿主凭据；它只报告可验证的视口、可见元素数量、内容边界和滚动尺寸，父层据此检查空白文档、固定屏幕宽度、横向溢出和目标内容边界。报告缺失、几何为零或内容越界都使候选失败，不能把 iframe `load` 或模型自报成功当作渲染通过。这个 probe 是 checker 的实现细节，产品宿主仍需在无法证明消息来源和 iframe 隔离时禁用自由文档脚本。

由于自由文档 iframe 使用不透明 origin，父页面的通用 DOM 截图工具可能只捕获宿主外壳而遗漏 iframe 像素。当前交付证据因此只把自由文档的真实加载、固定视口和宿主布局作为确定性检查，并将视觉截图标为 `unverified`；只有目标 host 提供可信的 iframe 截图适配器后，才可把图像交给视觉复核。

隔离页面仅通过按应用和实例绑定的宿主桥接请求允许的能力。宿主依据调用来源、应用 ID、源码修订和当前 owner 校验请求，消息按大小、频率、类型和参数 schema 限制；页面提供的 session、workspace、路径或设备标识一律不能决定执行目标。读文件、Agent 消息、外部工具和状态保存分别使用既有 owner 与权限流程。用户操作需要远程回答时必须走现有权限 mailbox。

iframe 和 CSP 是纵深防护，不是通用恶意代码 VM。浏览器可能无法在同一 WebView 内强制终止同步死循环或限定内存；不能宣称已获得进程级 CPU/内存隔离。启用模型生成 JavaScript 前，必须在 Desktop 的 WebView2、WKWebView、Linux WebKitGTK 及实际受支持 host 上验证 host API 不可见、网络/导航受限、消息可取消且 renderer 可恢复。某个 host 无法证明这些约束时，必须明确禁用该 host 的脚本执行并仍允许静态 HTML/CSS/SVG，不得静默用宿主权限执行。

### 共同应用与持久化契约

应用身份绑定目标设备/runtime、workspace、session 和应用 ID。每个接受版本保存源码及状态的独立修订；解析树、DOM 和截图是可丢弃的派生数据，不是权威存储。逻辑记录至少包含：

| 字段 | 语义 |
| --- | --- |
| `appId` | 跨修订稳定的应用身份 |
| `source.kind` | `openui-lang` 或 `html-document` |
| `source.formatVersion` | 源码语法或文档策略版本 |
| `libraryId` / `libraryRevision` | 两种源码路径都保存创建时绑定的 library contract；HTML 路径的样式和脚本能力仍由 designSpec 与 host runtime 共同约束 |
| `designSpec.id` / `designSpec.revision` | 两种源码类型共用、由 owner 固定的设计目标配置 |
| `htmlRuntime` | HTML 应用由 owner 写入的 runtime、sanitizer、inspector 和 bridge revision；组件路径不需要该字段 |
| `source.revision` / `source.content` | 源码修订与原始内容 |
| `state.revision` / `state.value` | 独立的用户数据修订 |
| `ownerRevision` | owner 并发控制版本 |
| `verification` | 精确绑定源码、状态、运行时、checker 和能力版本的证据 |

实际 wire/存储命名可以遵循现有领域契约，但须保留这些语义。Rust `Value` envelope 不解释源码；owner 不需要在 `app` 和 `widget_code` 间维护两份权威源码。每次编辑从已接受版本创建候选，源码和状态分别记修订，候选按 `baseOwnerRevision` 原子接受。过期、丢失确认的幂等重试、并发修改和未知字段由 owner 处理。

候选检查使用已接受状态的隔离副本，绝不覆写正式用户数据。检查可测试候选如何处理用户操作，但只有接受后用户界面才切换到它。保存失败时保留本地输入并显示失败状态；关闭重开从目标 owner 读取已接受源码和状态。格式或库切换是新修订；状态转换必须显式迁移并检查，失败时保留此前应用与数据。

### 统一实现约束与完成门槛

按可验证的纵向能力迁移，避免两条新路径各自建立一套应用 owner：

1. **固定源码边界并退役 TSX 执行链。** 新生成请求只接受 `openui-lang` 或 `html-document`。删除旧 Canvas 的模型 TSX 输入、逐应用编译和执行入口；旧记录保留为不可执行数据，可由用户显式导出或导入为待检查候选。
2. **建立共同 owner 与规范身份契约。** 引入版本化组件库/profile 和 `designSpec` 清单，将 `{id, revision}` 写入 app；引入带 `source.kind` 的源码修订、独立状态修订、owner revision 和候选接受语义。覆盖并发冲突、同 app ID 在设置改变后的规范继承和 source payload 往返，再让新路径以此作为唯一权威存储；旧 graph payload 不进入新 owner。
3. **完成 OpenUI 组件纵向切片。** 现在已用绑定规范的产品组件库打通 `source.kind = openui-lang` 的解析、渲染、流式输入、状态回调、action/query owner bridge 和 owner 保存/重开；async capability 层已补齐 Query/Mutation、图片、地图、取消、权限、远程 target 与 target event。宿主仍需为实际外部能力注册参数 schema、deadline、重试和远程 mailbox。没有合适模板时验证自由组合；库或语法诊断必须留在 OpenUI 语言语义内修复，不能转译到旧 JSON 图。
4. **完成自由文档静态纵向切片并收敛脚本门槛。** 已完成不执行脚本的 HTML/CSS/SVG 渲染、当前 sanitizer、style-resource token 基线和共同 owner 保存重开；每个规范在实际目标视口运行 DOM/几何验收，违规诊断交回修正并重验。当前证据带有 HTML runtime 的 revision；白名单式 sanitizer、参数化 bridge registry 以及各原生 WebView 的隔离证明仍是后续交付门槛。受控 JavaScript 仍按 host 单独开放；每个 host 先证明桥接权限、导航/网络限制、取消和恢复，再启用生成脚本。
5. **迁移候选验收与远程执行。** 组件和自由文档都由 owner 所在 runtime 按持久化的组件库及规范版本检查和接受。逐一验证 Remote Workspace、Remote Control、Peer Device 和 Detached Dispatch；能力缺失时明确 unsupported，不用本地渲染或 checker 代替目标端证据。

完成以行为证据为准，不以模块已创建或代码已编译为准。旧 graph 存储不进入新 owner，只有带 source 的候选才可接受；未验证的 host 或远程场景必须保持显式禁用或 unsupported。

### 候选验收与证据

组件和自由文档共用一条 owner 级交付门：

1. 固定 owner、应用 ID、源码类型和源版本；创建不覆盖已接受数据的候选。
2. 对原始完整源码做格式、语言/文档策略、组件库与 UI 规范版本校验，记录内容 hash。
3. 在目标执行端按规范的 viewport 和 host shell 启动隔离实例，检查实际挂载、运行异常、关键可见内容、布局、规范验收项和候选声明的交互。失败诊断绑定到该规范修订并用于修正；提示文本、schema 通过或截图单独均不构成规范通过。
4. 通过同一 owner 保存隔离检查状态，重读精确修订，再启动并断言恢复结果。
5. 将用户原始需求与实际 DOM/交互/保存证据一起做独立需求复核；有视觉模型时检查实际宿主截图。截图是临时检查输入，不保留为应用源码。
6. 只有全部必需阶段通过，且候选仍匹配基础 owner revision，才原子接受；否则保留旧版本并把具体诊断交还生成模型修复。

接受证据本身也必须带回候选的 `designSpec {id, revision}`；自由文档和
OpenUI 文档还必须带回相同的 `sourceKind`。owner 会逐字段比较这些身份，
所以远程 checker、过期的前端或另一套规范产生的证据不能被写入当前应用。

页面代码自报成功、Rust 结构校验通过或 React 已挂载都不能单独构成交付成功。模型审查不能代替运行器证据；无图像能力的检查器应把视觉项记录为 `unverified`，不伪称通过。检查设施不可用、超时或 owner 冲突与源码缺陷分开报告；可重试的检查阶段应重试同一候选，不要求模型无端改写源码。

组件作者提供的检查探针覆盖组件事件和 mounted inspect；应用级检查场景验证用户需求。自由文档检查器观察真实隔离实例并驱动受控测试事件，不能只采信页面向父级发送的“测试通过”消息。两种路径都保存精确源版本、状态版本、renderer/checker 版本和结果引用；HTML 路径还要记录 runtime、sanitizer、inspector 和 bridge revision。

### 远程与多入口

保存、检查、脚本宿主桥接和候选接受始终属于应用 owner 所在 runtime。控制端只呈现状态和发送命令，不代理文件系统、渲染权限或用户状态。运行和检查依赖的能力必须在目标端通告并协商；缺失时在准入或交付阶段明确返回 unsupported，不能静默在控制端本地执行。

| 场景 | 必须成立的行为 |
| --- | --- |
| Remote Workspace | workspace 路径与文件访问由远程 runtime 解释；不能把控制端路径转给目标端 |
| Remote Control | 断开后 owner 保留候选和可恢复阶段；远程权限请求可经现有 mailbox 回答 |
| Peer Device | 目标 peer 提供对应语言库、renderer、隔离脚本与 checker 能力；按 peer owner 修订 CAS |
| Detached Dispatch | 目标端可在无人值守条件下完成验证；缺 renderer/checker/脚本隔离能力时明确不接受候选 |
| CLI / Headless | 无交互 renderer 时允许明确报告 unsupported，不能伪造渲染/视觉证据 |

组件检查和自由文档检查使用同一远程生命周期，不要求每个客户端都安装或运行 renderer。Desktop 当前事件驱动的前端 checker 是一种 adapter，不是架构 owner；目标执行端需要能力，而不是持续连接的 controller window。

### 升级、历史数据与退役边界

存储新增字段必须可选并容忍旧记录。未知字段、未知 source format、损坏源码和未知组件库都原样保留；旧 graph 记录直接显示为不可运行，不进入 renderer、checker 或 acceptance，也不自动迁移。旧 HTML Widget 可以作为显式导入的 HTML 文档候选，导入后先应用新隔离策略和检查；TSX/Canvas 编译产物不得被自动执行或冒充 OpenUI。

当前实现中，OpenUI Lang 是组件路径唯一的生成语言和 parser；OpenBitFun 私有 graph 消息、表达式解释器、兼容 renderer 和组件专用 workflow 已从生成与交付链删除。自由文档是明确的 HTML/CSS/SVG 加可选受控 JS 类型，不是组件运行时的 fallback。旧 Canvas TSX compiler 与模型生成 TSX 执行链退役。产品边界不应保留 widget 和组件应用各自独立的身份、状态、验收或远程归属。

架构验证须覆盖两种表达不同的组件应用、无模板自由组合、真实工具参数流的渐进渲染、规范随 owner 保存重开与设置切换后的身份继承、Harmony 固定手机视口和 host shell、违反规则时实际诊断/修正/复验、自由文档 JS 隔离、状态修订、候选失败时旧版本保留、版本冲突，以及上述四类远程场景。Mock/DOM 测试不能证明原生 WebView 沙箱、远程执行或 Detached Dispatch；对应报告必须明确实际覆盖的 host 和场景。

GenUI 当前作为 FlowChat 中的 transient 结果呈现，不提供 owner/CAS 保存、
重开或交付验收。该范围内的测试应覆盖 OpenUI action、状态回传、受限渲染、
设置切换与原生/deferred 流式 DOM 增长；远程与 Detached Dispatch 场景不应
宣称支持持久化 GenUI 状态。
