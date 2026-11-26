/* 毕方 BitFun · 多状态形象生成器 v1.0
 * 形象来源：等距视角的圆角方块 + 顶面中心白色短天线 + 球；右侧面两只白色竖椭圆小眼（参考 飞书20261116 视频）。
 * 语义：天线球 = 状态灯（颜色区分大类），眼睛 = 注意力/情绪，道具 = 具体任务（仅大尺寸），胶囊 = 精确进度。
 * 选项：finish = smooth（光滑，视频原版）| metal（金属）| plush（毛绒：长绒玩具质感）；palette = PALETTES 中的配色。
 */
(function (root) {
  const C = { line: '#E3E5EA', sub: '#C9CED6', ink: '#2A2D35' };
  // 道具里的内容线条用当前状态色的浅调，随配色和状态变化
  const tint = (h, k = .62) => /^#[0-9a-f]{6}$/i.test(h) ? '#' + [1, 3, 5].map(i => Math.round(parseInt(h.substr(i, 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('') : h;

  const BASE = {
    ink: { hex: '#171717', name: '墨 · 正文' }, muted: { hex: '#706F6A', name: '暖灰 · 次要文字' }, subtle: { hex: '#A5A39B', name: '浅暖灰 · 辅助' },
    line: { hex: '#E9E7E2', name: '分隔线' }, soft: { hex: '#F4F3F0', name: '浅底' }, sidebar: { hex: '#F8F8F9', name: '侧栏底' }, page: { hex: '#FFFFFF', name: '页面底' }
  };
  const PALETTES = {
    obsidian: { name: '曜石黑', note: '视频原版', side: '#0B0B0D', sideL: '#08080A', top0: '#111114', top1: '#3E3E45', eye: '#F7F7F5', stem: '#EDEDEA', accent: '#2BBFD8', hand: '#1E1E22', blush: '#FF8FAE', softOp: .7, seam: '#55555E', fur: '#FFFFFF', furOp: .2, rim: .22 },
    cloud:    { name: '云朵白', note: '亮白 + 青', side: '#EDF2FA', sideL: '#DEE7F6', top0: '#F4F7FC', top1: '#FFFFFF', eye: '#1E2633', stem: '#C5CEDD', accent: '#3FD0D8', hand: '#E2E9F5', blush: '#FFB3CB', seam: '#CFD9EA', fur: '#8796B0', furOp: .12, rim: .95, shade: .35 },
    mint:     { name: '开心果', note: '亮绿 + 莓果', side: '#C4F2DA', sideL: '#A9E9C8', top0: '#D6F8E7', top1: '#F6FFFA', eye: '#0F3526', stem: '#93D3B2', accent: '#F27BD3', hand: '#B6EDD1', blush: '#FFA9C6', seam: '#9EDDBC', fur: '#4C9A74', furOp: .12, rim: .95, shade: .3 },
    sky:      { name: '天空蓝', note: '亮蓝 + 青', side: '#C7E3FF', sideL: '#ADD4FF', top0: '#D8ECFF', top1: '#F7FBFF', eye: '#0E2848', stem: '#97C1EE', accent: '#2FCFC4', hand: '#BADCFF', blush: '#FFB0C8', seam: '#A2CBF6', fur: '#4F7FB8', furOp: .12, rim: .95, shade: .3 },
    lavender: { name: '香芋紫', note: '亮紫 + 青柠', side: '#E0D3FF', sideL: '#CCBBFF', top0: '#E9DFFF', top1: '#FBF8FF', eye: '#271B55', stem: '#B6A3EE', accent: '#95D84E', hand: '#D6C8FF', blush: '#FFA8D2', seam: '#C4B1F7', fur: '#7A64C2', furOp: .12, rim: .95, shade: .3 },
    peach:    { name: '蜜桃', note: '亮桃 + 青', side: '#FFDACA', sideL: '#FFC6AE', top0: '#FFE5D9', top1: '#FFF9F5', eye: '#47200F', stem: '#EDB49C', accent: '#2FCFC4', hand: '#FFD0BC', blush: '#FF9283', seam: '#F6BFA8', fur: '#B97A60', furOp: .12, rim: .95, shade: .3 }
  };

  const CAT = {
    idle:  { key: 'idle',  name: '待命',     color: '#2BBFD8', hue: '随配色', mean: '品牌主色，随配色变化，但必须避开下面 5 个状态色相' },
    think: { key: 'think', name: '感知·思考', color: '#9C7CFF', deep: '#6E45F0', hue: '紫 ≈255°', mean: '在听、在想、在规划——还没动手' },
    work:  { key: 'work',  name: '执行',     color: '#5B8CFF', deep: '#2F62E8', hue: '蓝 ≈222°', mean: '正在改文件、跑命令、读资料' },
    ask:   { key: 'ask',   name: '需要你',   color: '#FFB547', deep: '#E08A00', hue: '琥珀 ≈36°', mean: '唯一需要用户行动的颜色' },
    ok:    { key: 'ok',    name: '完成',     color: '#3CCB7F', deep: '#139B55', hue: '绿 ≈148°', mean: '与产品成功色同一色相，略提亮' },
    err:   { key: 'err',   name: '异常',     color: '#FF6B6B', deep: '#E5293F', hue: '红 ≈0°', mean: '失败且需要处理' },
    off:   { key: 'off',   name: '离线',     color: '#B9B7B0', deep: '#8F8D86', hue: '暖灰', mean: '与产品文字暖灰同源，不抢眼' }
  };

  // 等距方块几何（viewBox 0..120）
  const SIL = 'M60 38 L87 53.6 L87 77.6 L60 93.2 L33 77.6 L33 53.6Z';
  const TOP = 'M60 38 L87 53.6 L60 69.2 L33 53.6Z';
  const LEFT = 'M33 53.6 L60 69.2 L60 93.2 L33 77.6Z';
  const FACE = 'matrix(1 -0.577 0 1 60 69.2)'; // 3D：右侧面局部坐标系
  const FLATFACE = 'matrix(1.35 0 0 1.35 37.05 56.8)'; // 平面：正面居中
  const TINYFACE = 'matrix(1.6 0 0 1.6 32.8 51)'; // 图标：眼睛更大
  const face = x => x.tiny ? TINYFACE : x.flat ? FLATFACE : FACE;

  const STYLE = `
.bf [class]{transform-box:fill-box}
.bf .f{animation:bf-f 3.2s ease-in-out infinite}
@keyframes bf-f{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.bf .f-slow{animation:bf-f 4.8s ease-in-out infinite}
.bf .idle{animation:bf-jelly 4.4s ease-in-out infinite;transform-origin:50% 100%}
@keyframes bf-jelly{0%,34%,100%{transform:translateY(0) rotate(0) scale(1,1)}40%{transform:translateY(0) rotate(0) scale(1.035,.955)}49%{transform:translateY(-2px) rotate(-4.5deg) scale(.985,1.02)}59%{transform:translateY(0) rotate(3.5deg) scale(1,1)}68%{transform:rotate(-1.8deg)}77%{transform:rotate(.6deg)}81%{transform:rotate(0)}}
.bf .ant-idle{animation:bf-antj 4.4s ease-in-out infinite;transform-origin:50% 100%}
@keyframes bf-antj{0%,38%,100%{transform:rotate(0)}49%{transform:rotate(-10deg)}59%{transform:rotate(8deg)}68%{transform:rotate(-4deg)}77%{transform:rotate(1.5deg)}84%{transform:rotate(0)}}
.bf .hop{animation:bf-hop 1.2s ease-in-out infinite;transform-origin:50% 100%}
@keyframes bf-hop{0%,100%{transform:translateY(0) scale(1,1)}12%{transform:translateY(0) scale(1.06,.92)}32%{transform:translateY(-9px) scale(.97,1.04)}52%{transform:translateY(0) scale(1.04,.95)}64%{transform:translateY(-2px)}76%{transform:translateY(0)}}
.bf .breathe{animation:bf-br 4.2s ease-in-out infinite;transform-origin:50% 100%}
@keyframes bf-br{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.965)}}
.bf .shake{animation:bf-shake 2.4s ease-in-out infinite;transform-origin:50% 100%}
@keyframes bf-shake{0%,22%,100%{transform:translateX(0)}4%,12%{transform:translateX(-2px) rotate(-3deg)}8%,16%{transform:translateX(2px) rotate(3deg)}}
.bf .ant{animation:bf-bob 3.2s ease-in-out infinite;transform-origin:50% 100%}
@keyframes bf-bob{0%,100%{transform:rotate(0)}50%{transform:rotate(5deg)}}
.bf .droop{transform-origin:50% 100%;transform:rotate(-28deg)}
.bf .blink{animation:bf-blink 4.6s infinite;transform-origin:center}
@keyframes bf-blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
.bf .glow{animation:bf-glow 1.6s ease-out infinite;transform-origin:center}
@keyframes bf-glow{0%{transform:scale(1);opacity:.45}100%{transform:scale(1.7);opacity:0}}
.bf .rip{animation:bf-rip 1.8s ease-out infinite both;transform-origin:center}
.bf .rip2{animation-delay:.9s}
@keyframes bf-rip{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.2);opacity:0}}
.bf .flash{animation:bf-flash 1s ease-in-out infinite}
@keyframes bf-flash{0%,100%{opacity:1}50%{opacity:.35}}
.bf .pulse{animation:bf-pulse 1.4s ease-in-out infinite;transform-origin:center}
@keyframes bf-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.bf .dot{animation:bf-dot 1.2s ease-in-out infinite both;transform-origin:center}
.bf .d2{animation-delay:.16s}.bf .d3{animation-delay:.32s}
@keyframes bf-dot{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-3px);opacity:1}}
.bf .eq{animation:bf-eq .9s ease-in-out infinite both;transform-origin:50% 50%}
.bf .e2{animation-delay:.2s}.bf .e3{animation-delay:.4s}
@keyframes bf-eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
.bf .tapL{animation:bf-tap .3s ease-in-out infinite alternate}
.bf .tapR{animation:bf-tap .3s ease-in-out infinite alternate-reverse}
@keyframes bf-tap{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.bf .code{animation:bf-code 3s ease-out infinite both;transform-origin:0 50%}
.bf .c2{animation-delay:.35s}.bf .c3{animation-delay:.7s}.bf .c4{animation-delay:1.05s}
@keyframes bf-code{0%{transform:scaleX(0)}18%,86%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
.bf .caret{animation:bf-flash .8s steps(1) infinite}
.bf .sweep{animation:bf-sweep 2.8s ease-in-out infinite}
@keyframes bf-sweep{0%,100%{transform:translate(0,0)}25%{transform:translate(14px,0)}50%{transform:translate(14px,14px)}75%{transform:translate(0,14px)}}
.bf .look{animation:bf-look 2.8s ease-in-out infinite}
@keyframes bf-look{0%,100%{transform:translate(0,-.5px)}25%{transform:translate(2.5px,-.5px)}50%{transform:translate(2.5px,1.5px)}75%{transform:translate(0,1.5px)}}
.bf .lookLR{animation:bf-lr 3s ease-in-out infinite}
@keyframes bf-lr{0%,100%{transform:translateX(-2.5px)}45%,55%{transform:translateX(2.5px)}}
.bf .spin{animation:bf-spin .9s linear infinite;transform-origin:center}
@keyframes bf-spin{to{transform:rotate(360deg)}}
.bf .prog{animation:bf-prog 2.6s ease-in-out infinite;transform-origin:0 50%}
@keyframes bf-prog{0%{transform:scaleX(.05)}80%,100%{transform:scaleX(1)}}
.bf .chk{stroke-dasharray:12;animation:bf-chk 3.6s ease-out infinite both}
.bf .k2{animation-delay:.6s}.bf .k3{animation-delay:1.2s}
@keyframes bf-chk{0%,10%{stroke-dashoffset:12}22%,90%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.bf .wave{animation:bf-wave 1.1s ease-in-out infinite;transform-origin:0% 100%}
@keyframes bf-wave{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(14deg)}}
.bf .sweat{animation:bf-sweat 2s ease-in infinite}
@keyframes bf-sweat{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(9px);opacity:0}}
.bf .crawl{animation:bf-crawl 2.4s ease-in-out infinite}
@keyframes bf-crawl{0%,100%{transform:translateX(-3px)}50%{transform:translateX(3px)}}
.bf .spark{animation:bf-spark 1.6s ease-in-out infinite both;transform-origin:center}
.bf .s2{animation-delay:.4s}.bf .s3{animation-delay:.8s}.bf .s4{animation-delay:1.2s}
@keyframes bf-spark{0%,100%{transform:scale(0);opacity:0}40%{transform:scale(1);opacity:1}70%{transform:scale(.6);opacity:.6}}
.bf .puff{animation:bf-puff 2s ease-out infinite both;transform-origin:center}
.bf .p2{animation-delay:.7s}
@keyframes bf-puff{0%{transform:translateY(0) scale(.5);opacity:0}25%{opacity:.8}100%{transform:translateY(-12px) scale(1.4);opacity:0}}
.bf .zz{animation:bf-z 3s ease-out infinite both}
.bf .z2{animation-delay:1s}.bf .z3{animation-delay:2s}
@keyframes bf-z{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(8px,-16px);opacity:0}}
.bf .flow{stroke-dasharray:2 4;animation:bf-flow .8s linear infinite}
@keyframes bf-flow{to{stroke-dashoffset:-12}}
.bf .mini1{animation:bf-f 2.6s ease-in-out infinite}
.bf .mini2{animation:bf-f 2.6s ease-in-out -1.3s infinite}
.bf .ac-breathe{animation:bf-acb 3.2s ease-in-out infinite;transform-origin:center}
@keyframes bf-acb{0%,100%{opacity:.45;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
.bf .ac-ping{animation:bf-acp 1.8s ease-out infinite;transform-origin:center}
@keyframes bf-acp{0%{opacity:.8;transform:scale(.4)}100%{opacity:0;transform:scale(1.25)}}
.bf .ac-draw{stroke-dasharray:30;animation:bf-acd 2.6s ease-in-out infinite both}
@keyframes bf-acd{0%{stroke-dashoffset:30}35%,85%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.bf .ac-travel{animation:bf-act 2s ease-in-out infinite}
@keyframes bf-act{0%,100%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
.bf .ac-spin{animation:bf-spin 3s linear infinite;transform-origin:center}
.bf .ac-spin-r{animation:bf-spin 4.5s linear infinite reverse;transform-origin:center}
@media (prefers-reduced-motion: reduce){.bf *{animation:none!important}}
`;

  let UID = 0;

  /* ---------- 部件（x = {P, u, plush}） ---------- */
  function defs(x) {
    const { P, u } = x;
    const hex = h => [1, 3, 5].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3));
    const furHex = tint(P.side, relLum(P.side) < .05 ? .2 : .32);
    const [fr, fg, fb] = hex(furHex);
    return `<defs>
<filter id="ps${u}" x="-30%" y="-30%" width="160%" height="170%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="1.4" stdDeviation="1.8" flood-color="#0b1220" flood-opacity=".16"/></filter>
<linearGradient id="tg${u}" gradientUnits="userSpaceOnUse" x1="60" y1="40" x2="60" y2="69.2"><stop offset="0" stop-color="${P.top0}"/><stop offset="1" stop-color="${P.top1}"/></linearGradient>
<linearGradient id="ao${u}" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="105"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${.22 * (P.shade ?? 1)}"/></linearGradient>
<linearGradient id="rf${u}" gradientUnits="userSpaceOnUse" x1="0" y1="54" x2="0" y2="100"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="${.06 * (P.shade ?? 1)}"/></linearGradient>
<linearGradient id="lf${u}" gradientUnits="userSpaceOnUse" x1="0" y1="54" x2="0" y2="100"><stop offset="0" stop-color="#000" stop-opacity="${.02 * (P.shade ?? 1)}"/><stop offset="1" stop-color="#000" stop-opacity="${.1 * (P.shade ?? 1)}"/></linearGradient>
<radialGradient id="sh${u}"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<filter color-interpolation-filters="sRGB" id="hb${u}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".7"/></filter>
<linearGradient id="cr${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7C828C"/><stop offset=".28" stop-color="#F4F5F7"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".68" stop-color="#A9AEB7"/><stop offset="1" stop-color="#6A707A"/></linearGradient>
<linearGradient id="cc${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#C9CDD4"/><stop offset=".7" stop-color="#8D939D"/><stop offset="1" stop-color="#D7DAE0"/></linearGradient>
<linearGradient id="mt${u}" gradientUnits="userSpaceOnUse" x1="33" y1="38" x2="87" y2="69"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset=".34" stop-color="#fff" stop-opacity=".75"/><stop offset=".4" stop-color="#fff" stop-opacity=".1"/><stop offset=".7" stop-color="#fff" stop-opacity=".0"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>
<linearGradient id="ms${u}" x1="0" y1="0" x2="0" y2="1"><stop offset=".2" stop-color="#fff" stop-opacity=".45"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>
<filter color-interpolation-filters="sRGB" id="br${u}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9 .03" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.6 -.75" result="a"/><feComposite in="a" in2="SourceAlpha" operator="in"/></filter>
<linearGradient id="mf${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>
<linearGradient id="bs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
<filter color-interpolation-filters="sRGB" id="tb${u}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${x.plush ? 3.6 : 2.6}"/></filter>
<filter color-interpolation-filters="sRGB" id="pf${u}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".35"/></filter>
<filter color-interpolation-filters="sRGB" id="hl${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter color-interpolation-filters="sRGB" id="fz${u}" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".62" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation=".28"/></filter>
<filter color-interpolation-filters="sRGB" id="fur${u}" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="1.5 2.4" numOctaves="3" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 ${fr} 0 0 0 0 ${fg} 0 0 0 0 ${fb} 0 0 0 2.2 -.95" result="a"/><feGaussianBlur in="a" stdDeviation=".55" result="ab"/><feComposite in="ab" in2="SourceAlpha" operator="in"/></filter>
</defs>`;
  }

  const relLum = h => { const c = [1, 3, 5].map(i => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const shadeHex = (h, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.substr(i, 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('');
  // 浅色（接近白）的身体 / 球放在浅底上会消失：自动加一圈同色系的细轮廓
  const edgeOf = h => /^#[0-9a-f]{6}$/i.test(h) && relLum(h) > .72 ? shadeHex(h, .2) : null;

  /* ---------- 毛绒：毕方是《山海经》里的神鸟，毛绒做成羽绒——表面一层顺向的绒羽，边缘一圈蓬松的绒毛 ---------- */
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const f2 = n => n.toFixed(2);
  // 毛绒：长毛绒玩具质感——密而细的长绒顺势倒伏，边缘一圈细长绒毛向外散开
  function down(x) {
    const { P, u } = x, r = rng(7), lum = relLum(P.side);
    const lite = tint(P.side, lum < .05 ? .28 : .55), dark = shadeHex(P.side, lum < .05 ? 0 : .14);
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const at = (q, s, t) => lerp(lerp(q[0], q[1], s), lerp(q[3], q[2], s), t);
    const strand = (x0, y0, ang, len, curl) => {
      const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
      const mx = x0 + Math.cos(ang) * len * .5 - Math.sin(ang) * curl, my = y0 + Math.sin(ang) * len * .5 + Math.cos(ang) * curl;
      return `M${f2(x0)} ${f2(y0)}Q${f2(mx)} ${f2(my)} ${f2(ex)} ${f2(ey)}`;
    };
    // 表面长绒：顶面从中心向外放射，两个侧面向下倒伏
    const faces = [
      { q: [[60, 38], [87, 53.6], [60, 69.2], [33, 53.6]], n: 300, top: true },
      { q: [[33, 53.6], [60, 69.2], [60, 93.2], [33, 77.6]], n: 260, d: 1.35 },
      { q: [[60, 69.2], [87, 53.6], [87, 77.6], [60, 93.2]], n: 260, d: 1.79 }
    ];
    let li = '', dk = '';
    for (const f of faces) for (let i = 0; i < f.n; i++) {
      const p = at(f.q, r(), r());
      const ang = f.top ? Math.atan2(p[1] - 53.6, p[0] - 60) + (r() - .5) * .5 : f.d + (r() - .5) * .45;
      const d = strand(p[0], p[1], ang, 3.6 + r() * 3.4, (r() - .5) * 2.2);
      if (r() < .6) li += d; else dk += d;
    }
    // 边缘长毛：沿外轮廓向外，长短不一
    const poly = [[60, 38], [87, 53.6], [87, 77.6], [60, 93.2], [33, 77.6], [33, 53.6]], cx = 60, cy = 65.6;
    let fr = '', frl = '';
    for (let k = 0; k < 6; k++) {
      const a = poly[k], b = poly[(k + 1) % 6], seg = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / seg, ny = -(b[0] - a[0]) / seg;
      const n = Math.round(seg * 4);
      for (let i = 0; i < n; i++) {
        const p = lerp(a, b, r()), off = 4.5 + r() * 3.5, sx = p[0] + nx * off, sy = p[1] + ny * off;
        const ang = Math.atan2(ny, nx) + (r() - .5) * 1.1;
        const d = strand(sx, sy, ang, 2.6 + r() * 3.6, (r() - .5) * 3);
        if (r() < .85) fr += d; else frl += d;
      }
      const vx = b[0] - cx, vy = b[1] - cy, vl = Math.hypot(vx, vy);
      for (let i = 0; i < 14; i++) {
        const ang = Math.atan2(vy, vx) + (r() - .5) * 1.6, off = 5 + r() * 3;
        fr += strand(b[0] + vx / vl * off, b[1] + vy / vl * off, ang, 3 + r() * 4.5, (r() - .5) * 2.4);
      }
    }
    return `<g fill="none" stroke-linecap="round" filter="url(#pf${u})">
      <path d="${fr}" stroke="${P.side}" stroke-width=".6"/><path d="${frl}" stroke="${lite}" stroke-width=".45" stroke-opacity="${lum < .05 ? .35 : .7}"/>
      <g clip-path="url(#cl${u})"><path d="${dk}" stroke="${dark}" stroke-width=".4" stroke-opacity="${lum < .05 ? .5 : .32}"/><path d="${li}" stroke="${lite}" stroke-width=".4" stroke-opacity="${lum < .05 ? .32 : .55}"/></g></g>`;
  }

  function body(x) {
    const { P, u, plush } = x, sw = plush ? 20 : 18;
    if (x.flat) {
      const e = edgeOf(P.side);
      let f = `<rect x="26" y="46" width="68" height="54" rx="20" fill="${P.side}"${e ? ` stroke="${e}" stroke-width="${x.tiny ? 2.4 : 1.4}"` : ''}/>`;
      if (x.metal) f += `<rect x="26" y="46" width="68" height="54" rx="20" fill="url(#mf${u})"/><rect x="27" y="47" width="66" height="52" rx="19" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>`;
      if (plush) f += `<rect x="26" y="46" width="68" height="54" rx="20" fill="#000" filter="url(#fur${u})" opacity="${P.furOp}"/>`;
      return plush ? `<g filter="url(#fz${u})">${f}</g>` : f;
    }
    const e = edgeOf(P.side);
    let g = `${e ? (plush ? `<path d="${SIL}" transform="translate(0 2.2)" fill="#0b1220" stroke="#0b1220" stroke-width="${sw}" stroke-linejoin="round" opacity=".13" filter="url(#hl${u})"/>` : `<path d="${SIL}" fill="${e}" stroke="${e}" stroke-width="${sw + 2.6}" stroke-linejoin="round"/>`) : ''}<path d="${SIL}" fill="${P.side}" stroke="${P.side}" stroke-width="${sw}" stroke-linejoin="round"/>
<path d="${LEFT}" fill="${P.sideL}" filter="url(#tb${u})"/>
<path d="${TOP}" fill="url(#tg${u})"${P.crisp ? '' : ` filter="url(#tb${u})"`}/>
<path d="M60 69.2 L87 53.6 L87 77.6 L60 93.2Z" fill="url(#rf${u})" filter="url(#tb${u})"/>${e ? `<path d="M60 69.2 L87 53.6 L87 77.6 L60 93.2Z" fill="#000" opacity=".035" filter="url(#tb${u})"/><path d="${LEFT}" fill="#000" opacity=".07" filter="url(#tb${u})"/>` : ''}
<path d="${LEFT}" fill="url(#lf${u})" filter="url(#tb${u})"/>
<path d="M33.5 56 L60 71.4 L86.5 56" fill="none" stroke="#fff" stroke-opacity="${P.rim}" stroke-width="1.1" stroke-linecap="round" filter="url(#hb${u})"/>`;
    if (x.metal) g += `<mask id="mm${u}"><path d="${SIL}" fill="#fff" stroke="#fff" stroke-width="${sw}" stroke-linejoin="round"/></mask>
<g mask="url(#mm${u})"><path d="${TOP}" fill="url(#mt${u})"/>
<rect x="0" y="-12" width="36" height="42" transform="${FACE}" fill="url(#ms${u})"/>
<rect x="-9" y="-12" width="36" height="42" transform="matrix(1 .577 0 1 33 53.6)" fill="url(#ms${u})" opacity=".75"/></g>
<path d="M33.5 56 L60 71.4 L86.5 56" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.4" stroke-linecap="round" filter="url(#hb${u})"/>
<path d="M60 71.4 L60 92" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1" filter="url(#hb${u})"/>`;
    if (plush) g += `<path d="${SIL}" fill="#000" stroke="#000" stroke-width="${sw}" stroke-linejoin="round" filter="url(#fur${u})" opacity="${P.furOp}"/>
<mask id="m${u}"><path d="${SIL}" fill="#fff" stroke="#fff" stroke-width="${sw}" stroke-linejoin="round"/></mask>
<rect x="0" y="20" width="120" height="100" fill="url(#ao${u})" mask="url(#m${u})"/>
<clipPath id="cl${u}"><path d="${SIL}" stroke="#000" stroke-width="${sw - 2}" stroke-linejoin="round"/></clipPath>${down(x)}`;
    return plush ? `<g filter="url(#fz${u})">${g}</g>` : g;
  }

  function eyes(x, type, o = {}) {
    const { P } = x, ec = P.eye;
    const dx = o.dx || 0, dy = o.dy || 0, cls = o.cls ? ` class="${o.cls}"` : '';
    const E = [[9.5, 12], [24.5, 12]];
    const st = w => `fill="none" stroke="${ec}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
    const shine = (ex, ey) => P.shine ? `<circle cx="${ex - .8}" cy="${ey - 2.3}" r=".85" fill="#fff" opacity=".9"/>` : '';
    let s = '';
    switch (type) {
      case 'wide': s = E.map(([a, b]) => `<g class="blink"><ellipse cx="${a}" cy="${b}" rx="3.5" ry="6.2" fill="${ec}"/>${shine(a, b)}</g>`).join(''); break;
      case 'focus': s = E.map(([a, b]) => `<path d="M${a - 3} ${b - 1.6} H${a + 3} A3 5.2 0 0 1 ${a - 3} ${b - 1.6}Z" fill="${ec}"/>`).join(''); break;
      case 'squint': s = E.map(([a, b]) => `<path d="M${a - 3.1} ${b - .4} H${a + 3.1} A3.1 2.9 0 0 1 ${a - 3.1} ${b - .4}Z" fill="${ec}"/>`).join(''); break;
      // 完成：保留竖椭圆眼，加一颗身体色的反光点和小星芒——“眼睛亮了”
      case 'happy': s = E.map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="3.3" ry="5.8" fill="${ec}"/><circle cx="${a - 1}" cy="${b - 2.2}" r="1.15" fill="${P.side}"/><circle cx="${a + .9}" cy="${b + 1.3}" r=".55" fill="${P.side}"/>`).join(''); break;
      // 完成 · 备选：实心弯月笑眼
      case 'happyCrescent': s = E.map(([a, b]) => `<path d="M${a - 3.2} ${b + 1.8} Q${a} ${b - 5.6} ${a + 3.2} ${b + 1.8} Q${a} ${b - 1.4} ${a - 3.2} ${b + 1.8}Z" fill="${ec}" stroke="${ec}" stroke-width=".6" stroke-linejoin="round"/>`).join(''); break;
      // 离线：眼睛收成低处的一条短胶囊，像合上的眼缝
      case 'closed': s = E.map(([a, b]) => `<rect x="${a - 2.8}" y="${b + 1.4}" width="5.6" height="2" rx="1" fill="${ec}"/>`).join(''); break;
      // 离线 · 备选：缩小的点状眼（像熄屏的指示灯）
      case 'closedDot': s = E.map(([a, b]) => `<circle cx="${a}" cy="${b + 1.6}" r="1.5" fill="${ec}" opacity=".7"/>`).join(''); break;
      case 'xx': { const [[a, b], [c, d]] = E; s = `<path d="M${a - 1.8} ${b - 2.6} L${a + 1.8} ${b} L${a - 1.8} ${b + 2.6}" ${st(2.5)}/><path d="M${c + 1.8} ${d - 2.6} L${c - 1.8} ${d} L${c + 1.8} ${d + 2.6}" ${st(2.5)}/>`; break; }
      default: s = E.map(([a, b]) => `<g class="blink"><ellipse cx="${a}" cy="${b}" rx="2.9" ry="5.3" fill="${ec}"/>${shine(a, b)}</g>`).join('');
    }
    return `<g transform="${face(x)}"><g transform="translate(${dx} ${dy})"><g${cls}>${s}</g></g></g>`;
  }

  const blush = (x, op = .75) => !x.cute ? '' : `<g transform="${face(x)}" fill="${x.P.blush}" opacity="${op}"><ellipse cx="4" cy="20.2" rx="3" ry="1.7"/><ellipse cx="30" cy="20.2" rx="3" ry="1.7"/></g>`;
  const soft = x => blush(x, x.P.softOp || .45);
  function mouth(x, type) {
    if (!x.cute) return '';
    const ec = x.P.eye, st = `fill="none" stroke="${ec}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"`;
    const m = {
      smile: `<path d="M15.4 18.6 Q17 20.6 18.6 18.6" ${st}/>`,
      cat: `<path d="M14.6 18.7 Q15.8 20.3 17 18.9 Q18.2 20.3 19.4 18.7" ${st}/>`,
      o: `<ellipse cx="17" cy="19.3" rx="1.15" ry="1.45" fill="${ec}"/>`,
      grin: `<path d="M14.6 18 Q17 23.2 19.4 18 Z" fill="${ec}"/>`,
      wavy: `<path d="M14.6 19.4 q1.2 -1.3 2.4 0 t2.4 0" ${st}/>`,
      flat: `<path d="M15.6 19.2 H18.4" ${st}/>`
    }[type];
    return `<g transform="${face(x)}">${m}</g>`;
  }

  function antenna(x, color, fx = [], cls = 'ant') {
    const { P, u, plush } = x;
    if (x.tiny) fx = [];
    let under = '', over = '', ballCls = '';
    if (P.ring) under += x.tiny ? `<circle cx="60" cy="27" r="14.2" fill="${P.ring}"/>` : x.flat ? `<circle cx="60" cy="28" r="11.2" fill="${P.ring}"/>` : `<circle cx="60" cy="29" r="13" fill="${P.ring}"/>`;
    if (fx.includes('glow')) under += `<circle class="glow" cx="60" cy="29" r="11.5" fill="${color}"/>`;
    if (fx.includes('ripple')) under += `<circle class="rip" cx="60" cy="29" r="11.5" fill="none" stroke="${color}" stroke-width="1.6"/><circle class="rip rip2" cx="60" cy="29" r="11.5" fill="none" stroke="${color}" stroke-width="1.6"/>`;
    if (fx.includes('flash')) ballCls = ' class="flash"';
    if (fx.includes('pulse')) ballCls = ' class="pulse"';
    if (fx.includes('spin')) over += `<g class="spin"><circle cx="60" cy="29" r="15" fill="none"/><path d="M60 14 A15 15 0 0 1 75 29" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/></g>`;
    if (fx.includes('orbit')) over += `<g><circle cx="60" cy="29" r="17" fill="none" stroke="${color}" stroke-opacity=".28" stroke-width="1" stroke-dasharray="1.5 3"/><circle cx="77" cy="29" r="2.6" fill="${color}"><animateTransform attributeName="transform" type="rotate" from="0 60 29" to="360 60 29" dur="1.8s" repeatCount="indefinite"/></circle></g>`;
    if (fx.includes('smoke')) over += `<circle class="puff" cx="67" cy="14" r="3.2" fill="#B9BEC7"/><circle class="puff p2" cx="71" cy="12" r="2.4" fill="#B9BEC7"/>`;
    const be = edgeOf(color), bs = be ? ` stroke="${be}" stroke-width="${x.tiny ? 2 : 1.1}"` : '';
    const ball = x.tiny ? `<circle cx="60" cy="27" r="12.5" fill="${color}"${bs}/>` : x.flat ? `<circle cx="60" cy="28" r="9.6" fill="${color}"${bs}/>` : `<circle cx="60" cy="29" r="11.5" fill="${color}"${bs}/><circle cx="60" cy="29" r="11.5" fill="url(#bs${u})"/>${plush ? '' : `<ellipse cx="55.6" cy="23.8" rx="4" ry="2.6" transform="rotate(-30 55.6 23.8)" fill="#fff" opacity=".6" filter="url(#hb${u})"/><circle cx="60" cy="29" r="11.1" fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".8"/>`}`;
    return `<g class="${cls}">
      ${x.flat ? `<rect x="58.3" y="36" width="3.4" height="10.2" fill="${edgeOf(P.side) || P.side}"/>`
        : `<rect x="57.4" y="30" width="5.2" height="23.5" rx="2.6" fill="url(#cr${u})"/><ellipse cx="60" cy="53.8" rx="7" ry="3.6" fill="url(#cc${u})"/><ellipse cx="60" cy="53.1" rx="4" ry="1.7" fill="#fff" opacity=".55"/>`}
      <g transform="${x.flat ? '' : 'translate(0 -10) translate(60 29) scale(1.14) translate(-60 -29)'}">
      ${under}
      <g${ballCls}>${plush ? `<g filter="url(#fz${u})">${ball}</g>` : ball}</g>
      ${over}
      </g>
    </g>`;
  }

  const hand = (x, hx, hy, cls = '') => `<ellipse${cls ? ` class="${cls}"` : ''} cx="${hx}" cy="${hy}" rx="4.8" ry="3.8" fill="${x.P.hand}"${x.plush ? ` filter="url(#fz${x.u})"` : ''}/>`;
  const sparkle = (sx, sy, r, color, cls) => `<path class="spark ${cls}" d="M${sx} ${sy - r} Q${sx} ${sy} ${sx + r} ${sy} Q${sx} ${sy} ${sx} ${sy + r} Q${sx} ${sy} ${sx - r} ${sy} Q${sx} ${sy} ${sx} ${sy - r}Z" fill="${color}"/>`;

  function mini(x, tx, ty, color, cls) {
    const { P } = x;
    return `<g transform="translate(${tx} ${ty}) scale(.34)"><g class="${cls}"${x.plush ? ` filter="url(#fz${x.u})"` : ''}>
      ${x.flat ? `<rect x="26" y="46" width="68" height="54" rx="20" fill="${P.side}"/><rect x="57.5" y="38" width="5" height="9" fill="${P.side}"/>` : `<path d="${SIL}" fill="${P.side}" stroke="${P.side}" stroke-width="18" stroke-linejoin="round"/>
      <path d="${TOP}" fill="${P.top1}" opacity=".55"/>
      <line x1="60" y1="53" x2="60" y2="41" stroke="${P.stem}" stroke-width="5" stroke-linecap="round"/>`}
      <circle cx="60" cy="29" r="11.5" fill="${color}"/>
      <g transform="${face(x)}" fill="${P.eye}"><ellipse cx="9.5" cy="12" rx="3.4" ry="5.8"/><ellipse cx="24.5" cy="12" rx="3.4" ry="5.8"/></g>
    </g></g>`;
  }

  /* ---------- 状态定义 ---------- */
  const STATES = [
    { id: 'idle', cat: 'idle', name: '待命', en: 'Idle', pill: '在线 · 随时待命',
      when: '已连接设备、没有进行中的任务；首页与会话空闲时。',
      notes: '还原视频里的动作：先压扁蓄力，再左右摇摆几下回正，天线跟着甩；平时眨眼。默认只有眼睛；切到“萌”表情时会加“ω”小嘴和淡腮红。', wrap: 'idle' },
    { id: 'listening', cat: 'think', name: '聆听', en: 'Listening', pill: '正在听你说…',
      when: '语音输入中，或用户正在输入长消息时。',
      notes: '眼睛放大表示“专注于你”；天线发出声波涟漪，侧边频谱条跟随音量。', wrap: 'f' },
    { id: 'thinking', cat: 'think', name: '思考', en: 'Thinking', pill: '思考中…',
      when: '收到请求、模型首个 token 之前的短暂思考。',
      notes: '视线上飘到右上，思考气泡里三点依次跳动；天线紫色呼吸光晕。', wrap: 'f' },
    { id: 'reasoning', cat: 'think', name: '深度推理', en: 'Deep reasoning', pill: '深度推理 · 已思考 18s',
      when: '开启深度思考 / 长链推理，耗时较长时。',
      notes: '眯眼用力想；天线有一颗卫星点绕行。和“思考”的区别只在眼型和天线动效，不加背景装饰。', wrap: 'f-slow' },
    { id: 'planning', cat: 'think', name: '规划', en: 'Planning', pill: '拆解任务 · 3 步',
      when: '生成 Plan / Todo、拆分子任务时。',
      notes: '左手举着清单，勾选逐条出现；视线看向清单。', wrap: 'f' },
    { id: 'coding', cat: 'work', name: '写代码', en: 'Coding', pill: '编辑 src/app.ts',
      when: 'Agent 正在生成 / 修改文件。',
      notes: '借鉴 Muse 的“敲键盘”：双手在身前交替敲击，右侧编辑器逐行长出代码。专注眼（上眼睑压平）。', wrap: '' },
    { id: 'searching', cat: 'work', name: '检索阅读', en: 'Searching', pill: '读取 12 个文件',
      when: '搜索代码库、读文件、联网查资料。',
      notes: '放大镜在文档上扫视，眼睛与放大镜同步移动——视线就是“正在看哪里”。', wrap: 'f' },
    { id: 'running', cat: 'work', name: '运行构建', en: 'Running', pill: '运行测试 · 42/60',
      when: '执行终端命令、构建、跑测试。',
      notes: '天线球外圈变成加载环；右侧终端里进度条推进。等待型任务不加手部动作。', wrap: 'f' },
    { id: 'debugging', cat: 'work', name: '调试排错', en: 'Debugging', pill: '定位问题 · TypeError',
      when: '发现报错后自主排查、修复中。',
      notes: '举放大镜盯着一只小虫，额头冒汗——主动在处理，表情专注而不是沮丧。', wrap: 'f' },
    { id: 'collab', cat: 'work', name: '多 Agent 协作', en: 'Sub-agents', pill: '3 个子任务并行',
      when: '派生子 Agent 并行处理、跨设备协同。',
      notes: '召唤出两只迷你方块分身，天线之间有数据流；本体左右看着分身——“我在统筹”。', wrap: 'f' },
    { id: 'awaiting', cat: 'ask', name: '等你确认', en: 'Needs you', pill: '需要你确认 · 2 处修改',
      when: '需要授权（执行命令、写文件、付费操作）或需要用户补充信息。',
      notes: '唯一会主动吸引注意的状态：举手挥动，天线球琥珀色闪烁；“萌”表情下另加腮红。', wrap: 'f' },
    { id: 'done', cat: 'ok', name: '完成', en: 'Done', pill: '已完成 · 修改 5 个文件',
      when: '任务结束、测试通过、交付结果时。',
      notes: '眼睛亮起（竖眼加两颗反光点），压扁后弹起的小跳，天线球变绿并带柔光，球内不放图标。播放 2–3 个循环后回到待命。', wrap: 'hop' },
    { id: 'error', cat: 'err', name: '出错', en: 'Error', pill: '构建失败 · 查看日志',
      when: '任务失败且无法自动恢复、网络中断。',
      notes: '“> <”挤眼 + 短促果冻摇晃，天线红色闪烁冒烟。胶囊给出明确下一步。', wrap: 'shake' },
    { id: 'sleeping', cat: 'off', name: '休眠 / 离线', en: 'Offline', pill: '离线 · 电脑已休眠',
      when: '设备断开、电脑休眠、长时间无操作。',
      notes: '眼睛收成一条眼缝，天线耷拉并变灰，缓慢呼吸，Zzz 升起。以“睡着”替代生硬的断开图标。', wrap: 'breathe' }
  ];

  function parts(id, x, c, compact) {
    const B = body(x);
    switch (id) {
      case 'idle': return [B, antenna(x, c, [], 'ant-idle'), eyes(x, 'normal'), soft(x), mouth(x, 'cat')];
      case 'listening': return [B, antenna(x, c, ['ripple']), eyes(x, 'wide'), soft(x), mouth(x, 'smile'),
        !compact && `<g fill="${c}"><rect class="eq" x="103" y="58" width="4" height="20" rx="2"/><rect class="eq e2" x="110" y="54" width="4" height="28" rx="2"/><rect class="eq e3" x="117" y="60" width="4" height="16" rx="2"/></g>`];
      case 'thinking': return [B, antenna(x, c, ['glow']), eyes(x, 'normal', { dx: 1.5, dy: -2.5 }), soft(x), mouth(x, 'o'),
        !compact && `<circle cx="97" cy="40" r="2.2" fill="#fff" filter="url(#ps${x.u})"/><circle cx="103" cy="31" r="3.2" fill="#fff" filter="url(#ps${x.u})"/>
         <rect x="102" y="4" width="32" height="18" rx="9" fill="#fff" filter="url(#ps${x.u})"/>
         <g fill="${c}"><circle class="dot" cx="111" cy="13" r="2.1"/><circle class="dot d2" cx="118" cy="13" r="2.1"/><circle class="dot d3" cx="125" cy="13" r="2.1"/></g>`];
      case 'reasoning': return [B, antenna(x, c, ['orbit']), eyes(x, 'squint'), soft(x), mouth(x, 'wavy')];
      case 'planning': return [B, antenna(x, c, ['glow']), eyes(x, 'normal', { dx: -2, dy: 1 }), soft(x), mouth(x, 'smile'),
        !compact && `<g transform="translate(9 0)"><rect x="-17" y="46" width="31" height="44" rx="5" fill="#fff" filter="url(#ps${x.u})"/>
         ${[58, 69, 80].map((y, i) => `<rect x="-12" y="${y - 3.5}" width="7" height="7" rx="2" fill="none" stroke="${tint(c, .45)}" stroke-width="1.3"/>
           <path class="chk ${['', 'k2', 'k3'][i]}" d="M-10.5 ${y} l2 2 l4 -4.5" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
           <rect x="-2" y="${y - 1.4}" width="${[12, 9, 11][i]}" height="2.8" rx="1.4" fill="${tint(c, .7)}"/>`).join('')}</g>`,
        !compact && hand(x, 23, 82)];
      case 'coding': return [B, antenna(x, c, ['pulse']), eyes(x, 'focus', { dx: 1.5, dy: 1 }), soft(x), mouth(x, 'flat'),
        !compact && `<rect x="95" y="22" width="41" height="38" rx="6" fill="#fff" filter="url(#ps${x.u})"/>
         <g fill="${tint(c, .72)}"><circle cx="101" cy="28" r="1.4"/><circle cx="105.5" cy="28" r="1.4"/><circle cx="110" cy="28" r="1.4"/></g>
         <rect class="code" x="101" y="35" width="20" height="3" rx="1.5" fill="${c}"/>
         <rect class="code c2" x="105" y="41.5" width="25" height="3" rx="1.5" fill="${tint(c, .7)}"/>
         <rect class="code c3" x="105" y="48" width="15" height="3" rx="1.5" fill="${tint(c, .4)}"/>
         <rect class="code c4" x="101" y="54.5" width="10" height="3" rx="1.5" fill="${tint(c, .7)}"/>
         <rect class="caret" x="113" y="53.5" width="1.6" height="5" fill="${c}"/>
         <rect x="28" y="104" width="64" height="10" rx="3.5" fill="#F3F4F6" filter="url(#ps${x.u})"/>
         <g fill="#D9DDE3">${[34, 42, 50, 58, 66, 74, 82].map(k => `<rect x="${k}" y="106.5" width="5" height="2" rx="1"/>`).join('')}<rect x="44" y="110" width="32" height="2" rx="1"/></g>`,
        !compact && hand(x, 46, 104, 'tapL'), !compact && hand(x, 74, 104, 'tapR')];
      case 'searching': return [B, antenna(x, c, ['pulse']), eyes(x, 'normal', { cls: 'look' }), soft(x), mouth(x, 'o'),
        !compact && `<rect x="98" y="40" width="38" height="48" rx="5" fill="#fff" filter="url(#ps${x.u})"/>
         <g fill="${tint(c, .7)}">${[49, 55, 61, 67, 73, 79].map((y, i) => `<rect x="103" y="${y}" width="${[26, 20, 28, 14, 24, 18][i]}" height="2.6" rx="1.3"/>`).join('')}</g>
         <g class="sweep"><circle cx="108" cy="56" r="8.5" fill="${c}" fill-opacity=".12" stroke="${C.ink}" stroke-width="2.6"/>
         <line x1="114.2" y1="62.2" x2="121" y2="69" stroke="${C.ink}" stroke-width="3.6" stroke-linecap="round"/></g>`];
      case 'running': return [B, antenna(x, c, ['spin']), eyes(x, 'normal', { dx: 1.5, dy: 1 }), soft(x), mouth(x, 'smile'),
        !compact && `<rect x="95" y="46" width="42" height="34" rx="6" fill="#1F2329" filter="url(#ps${x.u})"/>
         <path d="M101 55 l4 3 l-4 3" fill="none" stroke="${tint(c, .25)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
         <rect class="caret" x="107.5" y="60" width="6" height="1.8" rx=".9" fill="#E8EAEE"/>
         <rect x="101" y="69" width="30" height="4" rx="2" fill="#3A3F4B"/>
         <rect class="prog" x="101" y="69" width="30" height="4" rx="2" fill="${c}"/>`];
      // 调试：右侧代码卡，一行报错（红色波浪线）被替换成修好的一行
      case 'debugging': return [B, antenna(x, c, ['pulse']), eyes(x, 'focus', { dx: 1.5, dy: 1 }), soft(x), mouth(x, 'wavy'),
        !compact && `<rect x="96" y="38" width="40" height="46" rx="6" fill="#fff" filter="url(#ps${x.u})"/>
         <g fill="${tint(c, .72)}">${[47, 53, 71, 77].map((y, i) => `<rect x="101" y="${y}" width="${[24, 18, 26, 14][i]}" height="2.6" rx="1.3"/>`).join('')}</g>
         <rect x="99" y="58" width="34" height="10" rx="3" fill="#EF5A4C" opacity=".1" class="flash"/>
         <rect x="101" y="60" width="22" height="2.6" rx="1.3" fill="#EF5A4C" opacity=".85"/>
         <path d="M101 65.4 q1.4 -1.6 2.8 0 t2.8 0 t2.8 0 t2.8 0 t2.8 0 t2.8 0 t2.8 0" fill="none" stroke="#EF5A4C" stroke-width="1" stroke-linecap="round"/>
         <rect class="code" x="101" y="60" width="22" height="2.6" rx="1.3" fill="${c}"/>`];
      // 协作：两只迷你分身在两侧，细连线 + 流动的数据点
      case 'collab': {
        const L = [-0.8, 66], Rr = [121.2, 66], from = [60, 18];
        const path = ([tx, ty]) => `M${from[0]} ${from[1]} Q${(from[0] + tx) / 2} ${from[1] - 4} ${tx} ${ty}`;
        return [
          !compact && [L, Rr].map((p, k) => `<path d="${path(p)}" fill="none" stroke="${c}" stroke-opacity=".35" stroke-width="1" stroke-dasharray="1.5 3"/>
           <circle r="1.8" fill="${c}"><animateMotion dur="2s" begin="${k}s" repeatCount="indefinite" path="${path(p)}"/></circle>`).join(''),
          B, antenna(x, c, ['pulse']), eyes(x, 'normal', { cls: 'lookLR' }), soft(x), mouth(x, 'smile'),
          !compact && mini(x, -21.2, 58, '#8B7CF6', 'mini1'), !compact && mini(x, 100.8, 58, x.P.accent, 'mini2')];
      }
      case 'awaiting': return [B, antenna(x, c, ['flash']), eyes(x, 'wide'), blush(x), mouth(x, 'o'),
        !compact && `<g class="wave"><path d="M91 68 Q103 62 106 50" fill="none" stroke="${x.P.side}" stroke-width="7" stroke-linecap="round"/><circle cx="106.5" cy="47" r="5.2" fill="${x.P.hand}"/></g>
         <g class="pulse"><circle cx="126" cy="32" r="8.5" fill="${c}"/><rect x="124.6" y="26.5" width="2.8" height="7" rx="1.4" fill="#fff"/><circle cx="126" cy="36.6" r="1.6" fill="#fff"/></g>`];
      case 'done': return [B, antenna(x, c, ['glow']), eyes(x, 'happy'), blush(x, .85), mouth(x, 'grin'),
        !compact && sparkle(14, 40, 6, c, ''), !compact && sparkle(106, 30, 7, '#F5A524', 's2'), !compact && sparkle(112, 80, 5, c, 's3'), !compact && sparkle(6, 78, 4.5, '#F5A524', 's4')];
      case 'error': return [B, antenna(x, c, compact ? ['flash'] : ['flash', 'smoke']), eyes(x, 'xx'), mouth(x, 'wavy')];
      case 'sleeping': return [B, antenna(x, c, [], 'droop'), eyes(x, 'closed'), soft(x), mouth(x, 'o'),
        !compact && `<g fill="none" stroke="${C.sub}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path class="zz" d="M95 36 h5 l-5 6 h5"/><path class="zz z2" d="M95 36 h6.5 l-6.5 7.5 h6.5"/><path class="zz z3" d="M95 36 h8 l-8 9 h8"/></g>`];
    }
  }

  /* ---------- 颜色解析：待命=配色主色；同色系冲突时用加深版 ---------- */
  function hueOf(h) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
    if (d < .06) return null; // 近中性色没有色相
    const x = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (x * 60 + 360) % 360;
  }
  const chroma = h => { const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255); return Math.max(...v) - Math.min(...v); };
  const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d); };
  // 身体与状态色相差 < 30° 时自动换成加深版
  function isDeep(cat, palette) {
    const P = typeof palette === 'object' ? palette : PALETTES[palette || 'obsidian'], hb = hueOf(P.side), hs = hueOf(CAT[cat].color);
    if (P.status) return false;
    return cat !== 'idle' && cat !== 'off' && hb != null && hs != null && chroma(P.side) >= .15 && hueDist(hb, hs) < 30;
  }
  function statusColor(cat, palette) {
    const P = typeof palette === 'object' ? palette : PALETTES[palette || 'obsidian'];
    if (cat === 'idle') return P.accent;
    if (P.status && P.status[cat]) return P.status[cat];
    return isDeep(cat, palette) ? CAT[cat].deep : CAT[cat].color;
  }

  /* ---------- 点缀：替代卡通道具的线框小标记（opt.accent） ---------- */
  // 线框图形本身，坐标范围约 ±10；bg=true 时线宽不随缩放变粗，用于大尺寸背景纹样
  function accentGlyph(id, c, bg = false) {
    const L = `fill="none" stroke="${c}" stroke-width="${bg ? 1.3 : 1.6}"${bg ? ' vector-effect="non-scaling-stroke"' : ''} stroke-linecap="round" stroke-linejoin="round"`;
    const k = bg ? .5 : 1; // 背景版：实心点缩小，保持线稿感
    return {
      idle: `<circle r="7" ${L} opacity=".35"/><circle class="ac-breathe" r="${3 * k}" fill="${c}"/>`,
      listening: [-6, -2, 2, 6].map((x, i) => `<line class="eq ${['', 'e2', 'e3', 'e2'][i]}" x1="${x}" y1="-7" x2="${x}" y2="7" ${L}/>`).join(''),
      thinking: [-6, 0, 6].map((x, i) => `<circle class="dot ${['', 'd2', 'd3'][i]}" cx="${x}" cy="0" r="${1.9 * k}" fill="${c}"/>`).join(''),
      reasoning: `<g class="ac-spin"><path d="M0 -8 A8 8 0 0 1 8 0" ${L}/><path d="M0 8 A8 8 0 0 1 -8 0" ${L}/></g><g class="ac-spin-r"><path d="M4 0 A4 4 0 0 1 0 4" ${L} opacity=".55"/><path d="M-4 0 A4 4 0 0 1 0 -4" ${L} opacity=".55"/></g>`,
      planning: [-6, 0, 6].map((y, i) => `<path class="chk ${['', 'k2', 'k3'][i]}" d="M-8 ${y} l1.6 1.6 l2.8 -3" ${L}/><line x1="-1" y1="${y}" x2="${[8, 5, 7][i]}" y2="${y}" ${L} opacity=".45"/>`).join(''),
      coding: `<path d="M-4 -6 L-9 0 L-4 6 M4 -6 L9 0 L4 6" ${L}/><line class="caret" x1="1.4" y1="-6" x2="-1.4" y2="6" ${L}/>`,
      searching: `<g class="sweep"><circle cx="-2" cy="-2" r="5.2" ${L}/><line x1="1.8" y1="1.8" x2="6" y2="6" ${L}/></g>`,
      running: bg ? `<line x1="-9" y1="0" x2="9" y2="0" ${L} opacity=".3"/><line class="prog" x1="-9" y1="0" x2="9" y2="0" ${L}/>` : `<rect x="-9" y="-1.6" width="18" height="3.2" rx="1.6" fill="${c}" opacity=".2"/><rect class="prog" x="-9" y="-1.6" width="18" height="3.2" rx="1.6" fill="${c}"/>`,
      debugging: `<circle r="6.5" ${L}/><path d="M0 -9.5 V-5 M0 5 V9.5 M-9.5 0 H-5 M5 0 H9.5" ${L}/><circle class="ac-breathe" r="${1.8 * k}" fill="${c}"/>`,
      collab: `<path d="M-7 5 L0 -6 L7 5 Z" ${L} opacity=".4"/>${[[-7, 5], [0, -6], [7, 5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${2.3 * k}" fill="${c}"/>`).join('')}<circle r="${1.4 * k}" fill="${c}"><animateMotion dur="2.4s" repeatCount="indefinite" path="M0 -6 L7 5 L-7 5 Z"/></circle>`,
      awaiting: `<circle class="ac-ping" r="9" ${L}/><circle r="${3.2 * k}" fill="${c}"/>`,
      done: `<path class="ac-draw" d="M-7 0 L-2 5 L8 -6" ${L} stroke-width="2"/>`,
      error: `<path d="M0 -8 L8.5 7 H-8.5 Z" ${L}/><line x1="0" y1="-2" x2="0" y2="2.4" ${L}/><circle cx="0" cy="4.8" r=".9" fill="${c}"/>`,
      sleeping: `<path d="M3 -8 A8 8 0 1 0 8 4 A6 6 0 1 1 3 -8 Z" ${L}/><path class="zz" d="M-9 -9 h3.5 l-3.5 4 h3.5" ${L} stroke-width="1.3"/>`
    }[id];
  }
  function accent(id, c) {
    return `<g transform="translate(118 26)"><circle r="14" fill="${c}" opacity=".08"/>${accentGlyph(id, c)}</g>`;
  }

  /* ---------- 渲染 ---------- */
  function render(id, opt = {}) {
    const st = STATES.find(s => s.id === id);
    const P = typeof opt.palette === 'object' ? opt.palette : PALETTES[opt.palette || 'obsidian'];
    const x = { P, u: 'b' + (++UID), plush: opt.finish === 'plush', metal: opt.finish === 'metal', cute: opt.face === 'cute', flat: opt.view === 'flat' || !!opt.tiny, tiny: !!opt.tiny };
    if (x.flat) { x.plush = false; x.metal = false; } // 平面只有一种：纯平、简化
    const color = statusColor(st.cat, opt.palette);
    const compact = !!opt.compact || !!opt.tiny, ac = !!opt.accent && !x.tiny;
    const list = parts(id, x, color, compact || ac).filter(Boolean).join('');
    const wrap = st.wrap === 'hop' && (compact || ac) ? 'f' : st.wrap;
    const vb = x.tiny ? '20 13 80 90' : ac ? '34 6 122 120' : compact ? '9 1 102 107' : '0 0 160 136';
    const shadow = x.flat ? '' : false ? `<ellipse cx="60" cy="104" rx="27" ry="2.6" fill="#000" opacity=".07"/>` : `<ellipse cx="60" cy="103.5" rx="30" ry="4.2" fill="url(#sh${x.u})"/>`;
    const inner = compact && !ac ? `${shadow}<g class="${wrap}">${list}</g>` : `<g transform="translate(20 12)">${shadow}<g class="${wrap}">${list}</g>${ac ? accent(id, color) : ''}</g>`;
    const style = opt.noStyle ? '' : `<style>${STYLE}</style>`;
    return `<svg class="bf" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="毕方 · ${st.name}">${style}${defs(x)}${inner}</svg>`;
  }

  root.BF = { STATES, CAT, PALETTES, BASE, STYLE, render, accentGlyph, statusColor, isDeep, hueOf, hueDist };
  if (typeof module !== 'undefined') module.exports = root.BF;
})(typeof window !== 'undefined' ? window : globalThis);
