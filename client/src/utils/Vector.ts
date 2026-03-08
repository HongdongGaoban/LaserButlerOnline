/**
 * 2Dベクトル演算ユーティリティ
 * レーザーの反射計算などに使用
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** ベクトルの長さを返す */
export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** ベクトルを正規化（長さ1）して返す */
export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** 内積を返す */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** スカラー倍 */
export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/** ベクトルの加算 */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** ベクトルの減算 */
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * 入射ベクトルIを法線ベクトルNで反射した反射ベクトルRを返す
 * 公式: R = I - 2(I・N)N
 *
 * @param incident  入射ベクトル（正規化済みを推奨）
 * @param normal    壁の法線ベクトル（正規化済みであること）
 * @returns 反射ベクトル
 */
export function reflect(incident: Vec2, normal: Vec2): Vec2 {
  const d = dot(incident, normal);
  return {
    x: incident.x - 2 * d * normal.x,
    y: incident.y - 2 * d * normal.y,
  };
}

/**
 * 角度（ラジアン）からベクトルに変換
 */
export function fromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * ベクトルから角度（ラジアン）に変換
 */
export function toAngle(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

/**
 * 2点間の距離を返す
 */
export function distance(a: Vec2, b: Vec2): number {
  return length(sub(b, a));
}

/**
 * 2点間の距離の二乗を返す（比較用・sqrtを省略）
 */
export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * 線分 (p1 -> p2) と円 (center, radius) の交差判定
 * レーザーとプレイヤーの当たり判定に使用
 */
export function lineCircleIntersects(
  p1: Vec2,
  p2: Vec2,
  center: Vec2,
  radius: number,
): boolean {
  const d = sub(p2, p1);
  const f = sub(p1, center);

  const a = dot(d, d);
  const b = 2 * dot(f, d);
  const c = dot(f, f) - radius * radius;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;

  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  // 線分上（0〜1の範囲）に交点があるかチェック
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/**
 * 線分 (p1 -> p2) と 軸平行矩形 (AABB) の交差判定
 * レーザーと壁の当たり判定に使用
 */
export function lineAABBIntersects(
  p1: Vec2,
  p2: Vec2,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
): boolean {
  // Cohen-Sutherland アルゴリズムで判定
  const LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

  const outcode = (x: number, y: number): number => {
    let code = 0;
    if (x < rectX) code |= LEFT;
    else if (x > rectX + rectW) code |= RIGHT;
    if (y < rectY) code |= TOP;
    else if (y > rectY + rectH) code |= BOTTOM;
    return code;
  };

  let x0 = p1.x, y0 = p1.y, x1 = p2.x, y1 = p2.y;
  let code0 = outcode(x0, y0);
  let code1 = outcode(x1, y1);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!(code0 | code1)) return true;  // 完全に内側
    if (code0 & code1) return false;    // 完全に外側

    const codeOut = code0 || code1;
    let x = 0, y = 0;

    if (codeOut & BOTTOM) {
      x = x0 + (x1 - x0) * (rectY + rectH - y0) / (y1 - y0);
      y = rectY + rectH;
    } else if (codeOut & TOP) {
      x = x0 + (x1 - x0) * (rectY - y0) / (y1 - y0);
      y = rectY;
    } else if (codeOut & RIGHT) {
      y = y0 + (y1 - y0) * (rectX + rectW - x0) / (x1 - x0);
      x = rectX + rectW;
    } else {
      y = y0 + (y1 - y0) * (rectX - x0) / (x1 - x0);
      x = rectX;
    }

    if (codeOut === code0) {
      x0 = x; y0 = y;
      code0 = outcode(x0, y0);
    } else {
      x1 = x; y1 = y;
      code1 = outcode(x1, y1);
    }
  }
}
