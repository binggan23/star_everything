import type { PublicPage } from '../../domain/metadata';

/** A deterministic snapshot of a public Bilibili video page with open metadata. */
export const BILIBILI_VIDEO_PAGE: PublicPage = {
  finalUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
  status: 200,
  body: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>【4K】三分钟学会红烧肉_哔哩哔哩_bilibili</title>
    <meta property="og:title" content="【4K】三分钟学会红烧肉">
    <meta name="author" content="老番茄">
    <meta property="og:description" content="家常菜教程">
  </head>
  <body><div id="app"></div></body>
</html>`,
};

/** A Bilibili verification page; its title must never be accepted as video metadata. */
export const BILIBILI_VERIFICATION_PAGE: PublicPage = {
  finalUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
  status: 412,
  body: `<!doctype html>
<html lang="zh-CN">
  <head>
    <title>验证码_哔哩哔哩</title>
  </head>
  <body>
    <div class="bili-mini-captcha">安全验证</div>
  </body>
</html>`,
};

/** A Bilibili generic error page served with a 404 status. */
export const BILIBILI_ERROR_PAGE: PublicPage = {
  finalUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
  status: 404,
  body: `<!doctype html>
<html lang="zh-CN">
  <head>
    <title>出错啦! - bilibili.com</title>
  </head>
  <body>
    <div class="error-page">404 页面不存在</div>
  </body>
</html>`,
};

/** A Douyin short link that redirects to a public video page with no embedded metadata. */
export const DOUYIN_SHORT_LINK_PAGE: PublicPage = {
  finalUrl: 'https://www.douyin.com/video/7300000000000000000',
  status: 200,
  body: `<!doctype html>
<html lang="zh-CN">
  <head><title>抖音</title></head>
  <body><div id="root"></div></body>
</html>`,
};

/** A Douyin page that exposes open metadata through meta tags. */
export const DOUYIN_VIDEO_PAGE: PublicPage = {
  finalUrl: 'https://www.douyin.com/video/7300000000000000001',
  status: 200,
  body: `<!doctype html>
<html lang="zh-CN">
  <head>
    <title>三分钟红烧肉教程</title>
    <meta property="og:title" content="三分钟红烧肉教程">
    <meta name="author" content="老王">
  </head>
  <body><div id="root"></div></body>
</html>`,
};

/** A Douyin verification page; its title must never be accepted as video metadata. */
export const DOUYIN_VERIFICATION_PAGE: PublicPage = {
  finalUrl: 'https://www.douyin.com/video/7300000000000000002',
  status: 200,
  body: `<!doctype html>
<html lang="zh-CN">
  <head><title>安全验证</title></head>
  <body><div class="captcha-container">请完成安全验证</div></body>
</html>`,
};
