import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { openTestRepository } from '../test/support/testRepository';
import type { OpenTestRepositoryOptions, TestRepository } from '../test/support/testRepository';
import { App } from './App';

let opened: TestRepository | undefined;

afterEach(() => {
  opened?.dispose();
  opened = undefined;
});

function openApp(options: OpenTestRepositoryOptions = {}) {
  opened = openTestRepository(options);
  const view = render(<App repository={opened.repository} />);
  return { ...opened, ...view };
}

describe('collection', () => {
  it('starts with the Home root and an empty all-entries view', async () => {
    openApp();

    expect(await screen.findByRole('heading', { name: '全部条目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('还没有收藏条目。')).toBeInTheDocument();
  });

  it('saves an entry that has only a URL', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), 'https://www.bilibili.com/video/BV1xx411c7mD');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(
      await screen.findByText('https://www.bilibili.com/video/BV1xx411c7mD'),
    ).toBeInTheDocument();
    expect(screen.queryByText('还没有收藏条目。')).not.toBeInTheDocument();
  });

  it('saves an entry that has only an author', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('老番茄')).toBeInTheDocument();
    expect(screen.queryByText('还没有收藏条目。')).not.toBeInTheDocument();
  });

  it('saves an entry that has both a URL and an author', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), 'https://space.bilibili.com/546195');
    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('https://space.bilibili.com/546195')).toBeInTheDocument();
    expect(screen.getByText('老番茄')).toBeInTheDocument();
  });

  it('rejects an entry with neither a URL nor an author and explains how to fix it', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('作者'), '   ');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('请填写网址或作者。')).toBeInTheDocument();
    expect(screen.getByLabelText('网址')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('作者')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('网址')).toHaveFocus();
    expect(screen.getByLabelText('作者')).toHaveValue('   ');
    expect(screen.queryByRole('list', { name: '收藏条目' })).not.toBeInTheDocument();
    expect(screen.getByText('还没有收藏条目。')).toBeInTheDocument();
  });

  it('allows several entries with the same URL', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });
    const url = 'https://www.douyin.com/video/7300000000000000000';

    for (const expectedCount of [1, 2]) {
      await user.type(screen.getByLabelText('网址'), url);
      await user.click(screen.getByRole('button', { name: '保存条目' }));
      await waitFor(() => expect(screen.getAllByText(url)).toHaveLength(expectedCount));
    }
  });

  it('files new entries under the Home root', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('作者'), '影视飓风');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('影视飓风');

    await user.click(screen.getByRole('button', { name: 'Home' }));

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('影视飓风')).toBeInTheDocument();
  });

  it('keeps entries after the application restarts', async () => {
    const user = userEvent.setup();
    const first = openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('网址'), 'https://www.xiaohongshu.com/explore/123');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('https://www.xiaohongshu.com/explore/123');

    first.unmount();
    first.close();
    opened = undefined;

    openApp({ databasePath: first.databasePath, directory: first.directory });

    expect(await screen.findByText('https://www.xiaohongshu.com/explore/123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });

  it('edits an existing entry', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('作者'), '老师好我叫何同学');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('老师好我叫何同学');

    await user.click(screen.getByRole('button', { name: '编辑' }));
    const authorField = screen.getByLabelText('作者');
    await user.clear(authorField);
    await user.type(authorField, '何同学');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('何同学')).toBeInTheDocument();
    expect(screen.queryByText('老师好我叫何同学')).not.toBeInTheDocument();
  });

  it('rejects an edit that removes both the URL and the author and keeps the saved entry', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('老番茄');

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('作者'));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('请填写网址或作者。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(await screen.findByText('老番茄')).toBeInTheDocument();
  });
});
