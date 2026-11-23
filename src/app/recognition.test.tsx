import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMetadataRecognizer } from '../domain/metadata';
import type { PublicPage } from '../domain/metadata';
import {
  BILIBILI_ERROR_PAGE,
  BILIBILI_VERIFICATION_PAGE,
  BILIBILI_VIDEO_PAGE,
  DOUYIN_SHORT_LINK_PAGE,
} from '../test/fixtures/publicPages';
import { createTestRecognizer } from '../test/support/publicPageFetcher';
import { openTestRepository } from '../test/support/testRepository';
import type { TestRepository } from '../test/support/testRepository';
import { App } from './App';

let opened: TestRepository | undefined;

afterEach(() => {
  opened?.dispose();
  opened = undefined;
});

function openApp(pages: Readonly<Record<string, PublicPage | null>> = {}) {
  opened = openTestRepository();
  const { recognizer, requests } = createTestRecognizer(pages);
  const view = render(<App repository={opened.repository} recognizer={recognizer} />);
  return { ...opened, ...view, requests };
}

const BILIBILI_URL = 'https://www.bilibili.com/video/BV1xx411c7mD';

describe('metadata recognition', () => {
  it('fills the title, author, platform, and URL from a Bilibili video page', async () => {
    const user = userEvent.setup();
    const { requests } = openApp({ [BILIBILI_URL]: BILIBILI_VIDEO_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), BILIBILI_URL);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(await screen.findByLabelText('标题')).toHaveValue('【4K】三分钟学会红烧肉');
    expect(screen.getByLabelText('作者')).toHaveValue('老番茄');
    expect(screen.getByLabelText('平台标签')).toHaveDisplayValue('Bilibili');
    expect(screen.getByLabelText('网址')).toHaveValue(BILIBILI_URL);
    expect(requests).toEqual([BILIBILI_URL]);
  });

  it('treats a Bilibili verification page as a failed extraction', async () => {
    const user = userEvent.setup();
    openApp({ [BILIBILI_URL]: BILIBILI_VERIFICATION_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), BILIBILI_URL);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(await screen.findByText('平台要求验证，请手动填写标题和作者。')).toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toHaveValue('');
    expect(screen.getByLabelText('作者')).toHaveValue('');
    expect(screen.queryByDisplayValue('验证码_哔哩哔哩')).not.toBeInTheDocument();
  });

  it('treats a Bilibili error page as a failed extraction', async () => {
    const user = userEvent.setup();
    openApp({ [BILIBILI_URL]: BILIBILI_ERROR_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), BILIBILI_URL);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(await screen.findByText('平台页面不可用，请手动填写。')).toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toHaveValue('');
    expect(screen.queryByDisplayValue('出错啦! - bilibili.com')).not.toBeInTheDocument();
  });

  it('resolves a Douyin short link and reads title and author from the share text', async () => {
    const user = userEvent.setup();
    const shareText =
      '7.43 复制打开抖音，看看【老王的作品】三分钟红烧肉教程 https://v.douyin.com/iRNBho6u/ 复制此链接，打开Dou音搜索，直接观看视频！';
    const { requests } = openApp({
      'https://v.douyin.com/iRNBho6u/': DOUYIN_SHORT_LINK_PAGE,
    });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('分享链接或文案'), shareText);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(await screen.findByDisplayValue('三分钟红烧肉教程')).toBeInTheDocument();
    expect(screen.getByLabelText('作者')).toHaveValue('老王');
    expect(screen.getByLabelText('网址')).toHaveValue(
      'https://www.douyin.com/video/7300000000000000000',
    );
    expect(screen.getByLabelText('平台标签')).toHaveDisplayValue('抖音');
    expect(requests).toEqual(['https://v.douyin.com/iRNBho6u/']);
  });

  it('parses a Xiaohongshu share text and preserves the original query string', async () => {
    const user = userEvent.setup();
    const shareUrl =
      'https://www.xiaohongshu.com/discovery/item/66abc123?xsec_token=AB3xY-token&xsec_source=pc_share';
    const shareText = `42 【超好吃的减脂餐 - 小美 | 小红书】 😆 好吃到哭 😆 ${shareUrl} 复制本条信息，打开【小红书】App查看精彩内容！`;
    const { requests } = openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('分享链接或文案'), shareText);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(await screen.findByDisplayValue('超好吃的减脂餐')).toBeInTheDocument();
    expect(screen.getByLabelText('作者')).toHaveValue('小美');
    expect(screen.getByLabelText('网址')).toHaveValue(shareUrl);
    expect(screen.getByLabelText('平台标签')).toHaveDisplayValue('小红书');
    expect(requests).toEqual([]);
  });

  it('leaves manual entry available after a failed extraction and still saves', async () => {
    const user = userEvent.setup();
    openApp({ [BILIBILI_URL]: BILIBILI_VERIFICATION_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), BILIBILI_URL);
    await user.click(screen.getByRole('button', { name: '识别' }));
    await screen.findByText('平台要求验证，请手动填写标题和作者。');

    await user.type(screen.getByLabelText('标题'), '手动填写的标题');
    await user.type(screen.getByLabelText('作者'), '手动填写的作者');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('手动填写的标题')).toBeInTheDocument();
    expect(screen.getByText('手动填写的作者')).toBeInTheDocument();
  });

  it('lets the user edit recognized values before saving', async () => {
    const user = userEvent.setup();
    openApp({ [BILIBILI_URL]: BILIBILI_VIDEO_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), BILIBILI_URL);
    await user.click(screen.getByRole('button', { name: '识别' }));
    await screen.findByDisplayValue('【4K】三分钟学会红烧肉');

    const titleField = screen.getByLabelText('标题');
    await user.clear(titleField);
    await user.type(titleField, '我改过的标题');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('我改过的标题')).toBeInTheDocument();
    expect(screen.getByText('老番茄')).toBeInTheDocument();
    expect(screen.queryByText('【4K】三分钟学会红烧肉')).not.toBeInTheDocument();
  });

  it('keeps manual values when recognition finds different metadata', async () => {
    const user = userEvent.setup();
    openApp({ [BILIBILI_URL]: BILIBILI_VIDEO_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('标题'), '我先写的标题');
    await user.type(screen.getByLabelText('作者'), '我先写的作者');
    await user.type(screen.getByLabelText('网址'), BILIBILI_URL);
    await user.click(screen.getByRole('button', { name: '识别' }));
    await screen.findByText('已识别');

    expect(screen.getByLabelText('标题')).toHaveValue('我先写的标题');
    expect(screen.getByLabelText('作者')).toHaveValue('我先写的作者');
  });

  it('asks for share text when a Douyin page has no metadata and still saves manually', async () => {
    const user = userEvent.setup();
    const url = 'https://www.douyin.com/video/7300000000000000000';
    openApp({ [url]: DOUYIN_SHORT_LINK_PAGE });
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), url);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(
      await screen.findByText('未能识别标题和作者，请补充分享文案或手动填写。'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toHaveValue('');

    await user.type(screen.getByLabelText('作者'), '手动补充');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText(url)).toBeInTheDocument();
    expect(screen.getByText('手动补充')).toBeInTheDocument();
  });

  it('does not write token-bearing URLs to logs or failure messages', async () => {
    const tokenUrl = 'https://www.bilibili.com/video/BV1?xsec_token=secret-token';
    opened = openTestRepository();
    const recognizer = createMetadataRecognizer({
      fetchPage: async () => {
        throw new Error(`request failed for ${tokenUrl}`);
      },
    });
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');
    const logSpy = vi.spyOn(console, 'log');
    render(<App repository={opened.repository} recognizer={recognizer} />);
    await screen.findByRole('heading', { name: '全部条目' });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('网址'), tokenUrl);
    await user.click(screen.getByRole('button', { name: '识别' }));

    expect(await screen.findByText('无法读取平台页面，请手动填写。')).not.toHaveTextContent(
      'secret-token',
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
