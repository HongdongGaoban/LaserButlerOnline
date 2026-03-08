/**
 * スマホブラウザ特有の問題に対処するユーティリティ
 */

/** スクロール・戻るジェスチャー・Pull-to-Refreshを無効化 */
export function disableMobileGestures(): void {
  // touchmoveのデフォルト動作を無効化（スクロール防止）
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // contextmenu（長押しメニュー）を無効化
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // スワイプで戻るを防ぐ
  window.addEventListener('popstate', (e) => {
    e.preventDefault();
    history.pushState(null, '', window.location.href);
  });

  // 初期履歴を積んでおく（戻るボタン対策）
  history.pushState(null, '', window.location.href);
}

/** フルスクリーンをリクエスト */
export function requestFullscreen(): void {
  const elem = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
  };

  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {/* 失敗時は無視 */});
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen().catch(() => {});
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen().catch(() => {});
  }
}

/**
 * AudioContextを初回タップで初期化
 * ブラウザの自動再生ブロックを回避する
 */
export function initAudioOnFirstTouch(callback?: () => void): void {
  const handler = () => {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        callback?.();
      });
    } else {
      callback?.();
    }
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('click', handler);
  };

  document.addEventListener('touchstart', handler, { once: true });
  document.addEventListener('click', handler, { once: true });
}

/** 横画面かどうかを確認 */
export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

/** 横画面強制を促すオーバーレイを表示/非表示 */
export function handleOrientationChange(onLandscape: () => void, onPortrait: () => void): () => void {
  const check = () => {
    if (isLandscape()) {
      onLandscape();
    } else {
      onPortrait();
    }
  };

  window.addEventListener('orientationchange', check);
  window.addEventListener('resize', check);
  check();

  // クリーンアップ関数を返す
  return () => {
    window.removeEventListener('orientationchange', check);
    window.removeEventListener('resize', check);
  };
}

/** デバイスのピクセル比を考慮したスケール係数を取得 */
export function getDevicePixelRatio(): number {
  // パフォーマンスのため最大2倍に制限
  return Math.min(window.devicePixelRatio || 1, 2);
}

/** ローディング画面を非表示にする */
export function hideLoadingScreen(): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    // transitionが終わったら要素を削除
    setTimeout(() => loading.remove(), 600);
  }
}
