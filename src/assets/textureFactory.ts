import * as THREE from 'three';
import { PrizeCatalogItem } from '../types/machine';

const textureCache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTex(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  return tex;
}

/**
 * 台灣街邊夾娃娃店常見白灰拋光磁磚地
 */
export function createTileFloorTexture(repeatX = 9, repeatY = 12): THREE.CanvasTexture {
  const key = `floor_tile_${repeatX}_${repeatY}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#e7eaee';
  ctx.fillRect(0, 0, 512, 512);

  // 細微大理石拋光紋理
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(200,206,214,0.18)' : 'rgba(255,255,255,0.22)';
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillRect(x, y, 20 + Math.random() * 60, 4 + Math.random() * 14);
  }

  // 2x2 磁磚接縫
  ctx.strokeStyle = '#c5cbd3';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  const tex = finalizeTex(canvas, repeatX, repeatY);
  textureCache.set(key, tex);
  return tex;
}

/**
 * 機台上方發光燈箱貼圖（台灣常見明亮招牌風格）
 */
export function createMarqueeTexture(
  title: string,
  subtitle: string,
  accentColor: string,
  machineNumber: number
): THREE.CanvasTexture {
  const key = `marquee_${title}_${accentColor}_${machineNumber}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512, 160);
  const grad = ctx.createLinearGradient(0, 0, 512, 160);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.65, '#f8fafc');
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 160);

  // 左側色條與機台編號
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 108, 160);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`0${machineNumber}`, 54, 72);
  ctx.font = 'bold 20px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.fillText('號機', 54, 122);

  // 頂底裝飾線
  ctx.fillStyle = accentColor;
  ctx.fillRect(108, 0, 404, 12);
  ctx.fillRect(108, 148, 404, 12);

  // 主副標題
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 42px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 126, 68);

  ctx.fillStyle = '#475569';
  ctx.font = '600 22px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.fillText(subtitle, 126, 118);

  const tex = finalizeTex(canvas);
  textureCache.set(key, tex);
  return tex;
}

/**
 * 機台下方前門貼紙（台灣常見「選物販賣機・免費暢玩練習台」視覺）
 */
export function createLowerDoorDecalTexture(accentColor: string, manufacturer: string): THREE.CanvasTexture {
  const key = `lower_door_${accentColor}_${manufacturer}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  // 幾何斜紋（台灣鼎莉／飛絡力常見機台腰帶）
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(0, 340);
  ctx.lineTo(512, 270);
  ctx.lineTo(512, 430);
  ctx.lineTo(0, 470);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 34px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('台灣選物販賣機', 256, 95);

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 26px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.fillText('FREE PLAY・無限練習台', 256, 148);

  ctx.fillStyle = '#64748b';
  ctx.font = '20px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.fillText(manufacturer, 256, 200);

  // 底部提醒貼紙框
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(48, 355, 416, 64);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.fillText('真實物理模擬・無保夾限制', 256, 396);

  const tex = finalizeTex(canvas);
  textureCache.set(key, tex);
  return tex;
}

/**
 * 台灣夾娃娃機獎品彩盒包裝貼圖（具台灣賣場 3C 彩盒／公仔盒排版語言、規格徽章與商品剪影）
 */
export function createPrizeBoxTexture(item: PrizeCatalogItem, face: 'front' | 'side' | 'top'): THREE.CanvasTexture {
  const key = `prize_${item.archetype}_${face}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512, 512);

  // 背景底色
  ctx.fillStyle = item.primaryColor;
  ctx.fillRect(0, 0, 512, 512);

  // 上方品牌主色帶
  ctx.fillStyle = item.secondaryColor;
  ctx.fillRect(0, 0, 512, face === 'top' ? 140 : 120);

  // 斜向賣點色塊
  ctx.fillStyle = item.accentColor;
  ctx.beginPath();
  ctx.moveTo(0, 440);
  ctx.lineTo(512, 395);
  ctx.lineTo(512, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // 標題文字
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(item.labelTitle, 28, 62);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '22px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.fillText(item.labelSub, 28, 100);

  // 右上圓角徽章
  ctx.fillStyle = item.accentColor;
  ctx.beginPath();
  ctx.roundRect(356, 134, 136, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(item.badgeText, 424, 166);

  if (face === 'front') {
    // 繪製對應台灣商品的精細插畫/視窗邊框
    ctx.strokeStyle = item.secondaryColor;
    ctx.lineWidth = 6;
    ctx.fillStyle = item.hasWindow ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.roundRect(42, 198, 428, 196, 18);
    ctx.fill();
    ctx.stroke();

    // 商品視覺圖示
    drawProductGraphic(ctx, item);
  } else if (face === 'side') {
    // 側邊規格表（台灣 3C 彩盒經典風格）
    ctx.fillStyle = item.primaryColor === '#1e2433' || item.primaryColor === '#252932' ? '#e2e8f0' : '#334155';
    ctx.font = 'bold 24px "PingFang TC", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'left';
    const specs = [
      `品名：${item.displayName}`,
      `規格：台灣精選禮品版`,
      `檢驗：BSMI 認證模擬`,
      `淨重：約 ${Math.round(item.massKg * 1000)}g`,
    ];
    specs.forEach((line, idx) => {
      ctx.fillText(line, 36, 210 + idx * 46);
    });
  } else {
    // 頂面：品名＋條碼貼紙感
    ctx.fillStyle = item.primaryColor === '#1e2433' || item.primaryColor === '#252932' ? '#f1f5f9' : '#1e293b';
    ctx.font = 'bold 34px "PingFang TC", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.displayName, 256, 260);

    // 條碼區塊
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(156, 300, 200, 74);
    ctx.fillStyle = '#111827';
    for (let b = 0; b < 32; b++) {
      const bw = b % 3 === 0 ? 4 : 2;
      ctx.fillRect(168 + b * 5.6, 308, bw, 54);
    }
  }

  // 底部標語
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('精選夾物專供・質感首選', 28, 480);

  // 盒緣細邊線（讓白盒在亮光下也有清楚稜線）
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 506, 506);

  const tex = finalizeTex(canvas);
  textureCache.set(key, tex);
  return tex;
}

function drawProductGraphic(ctx: CanvasRenderingContext2D, item: PrizeCatalogItem): void {
  ctx.save();
  ctx.translate(256, 296);

  if (item.archetype === 'box_3c_earbuds') {
    // 藍牙耳機充電艙與雙耳
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1f4e99';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-84, -56, 94, 112, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-62, -16, 50, 24);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('100%', -37, 2);
    // 右側耳機柄
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(54, -22, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(46, -12, 16, 62);
  } else if (item.archetype === 'box_3c_fan') {
    // 手持渦輪風扇
    ctx.fillStyle = '#0d7c66';
    ctx.beginPath();
    ctx.arc(0, -18, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.arc(0, -18, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    for (let k = 0; k < 5; k++) {
      ctx.save();
      ctx.translate(0, -18);
      ctx.rotate((k * Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(18, 0, 18, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#0d7c66';
    ctx.fillRect(-16, 34, 32, 50);
  } else if (item.archetype === 'box_3c_speaker') {
    // 迷你重低音音箱
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-72, -62, 144, 124, 20);
    ctx.fill();
    ctx.strokeStyle = '#36d1dc';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d9385a';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.archetype === 'box_3c_shaver') {
    // 隨身電動刮鬍刀
    ctx.fillStyle = '#c59b43';
    ctx.beginPath();
    ctx.roundRect(-42, -64, 84, 128, 30);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(-34, -54, 68, 34, 12);
    ctx.fill();
    ctx.strokeStyle = '#f0c75e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 18, 16, 0, Math.PI * 2);
    ctx.stroke();
  } else if (item.archetype === 'box_long_gadget') {
    // 無線打氣機
    ctx.fillStyle = '#0f4c81';
    ctx.beginPath();
    ctx.roundRect(-125, -48, 170, 96, 16);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-102, -26, 76, 44);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('36 PSI', -64, 4);
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(45, 0);
    ctx.bezierCurveTo(95, -45, 115, 45, 138, 10);
    ctx.stroke();
  } else {
    // 盲盒／薄盒收藏徽章
    ctx.fillStyle = item.secondaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "PingFang TC", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 4);
  }

  ctx.restore();
}

/**
 * 台灣夾娃娃店牆面公告／價目海報貼圖（營造道地街邊小店氛圍）
 */
export function createShopPosterTexture(
  title: string,
  lines: string[],
  headerBg: string
): THREE.CanvasTexture {
  const key = `poster_${title}_${headerBg}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const [canvas, ctx] = makeCanvas(512, 680);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 680);

  ctx.fillStyle = headerBg;
  ctx.fillRect(0, 0, 512, 135);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 84);

  ctx.fillStyle = '#1e293b';
  ctx.font = '600 30px "PingFang TC", "Noto Sans TC", sans-serif';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line, 44, 215 + i * 72);
  });

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 670);

  const tex = finalizeTex(canvas);
  textureCache.set(key, tex);
  return tex;
}
