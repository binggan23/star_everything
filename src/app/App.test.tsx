import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestRecognizer } from '../test/support/publicPageFetcher';
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
  const { recognizer } = createTestRecognizer();
  const view = render(<App repository={opened.repository} recognizer={recognizer} />);
  return { ...opened, ...view };
}

async function createCollection(
  user: ReturnType<typeof userEvent.setup>,
  parentName: string,
  name: string,
) {
  await user.click(await screen.findByRole('button', { name: parentName }));
  await user.click(await screen.findByRole('button', { name: '新建子收藏夹' }));
  await user.type(screen.getByLabelText('名称'), name);
  await user.click(screen.getByRole('button', { name: '创建' }));
  await screen.findByRole('button', { name });
}

async function addEntryTo(
  user: ReturnType<typeof userEvent.setup>,
  author: string,
  ...collectionPaths: string[]
) {
  for (const path of collectionPaths) {
    await user.click(screen.getByRole('checkbox', { name: path }));
  }
  await user.type(screen.getByLabelText('作者'), author);
  await user.click(screen.getByRole('button', { name: '保存条目' }));
  await screen.findByText(author);
}

describe('collection', () => {
  it('starts in Home and keeps a separate all-entries entry point', async () => {
    const user = userEvent.setup();
    openApp();

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '全部条目' })).toBeInTheDocument();
    expect(screen.getByText('没有符合条件的条目。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));

    expect(await screen.findByRole('heading', { name: '全部条目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部条目' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('saves an entry that has only a URL', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

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
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('老番茄')).toBeInTheDocument();
    expect(screen.queryByText('还没有收藏条目。')).not.toBeInTheDocument();
  });

  it('saves an entry that has both a URL and an author', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('网址'), 'https://space.bilibili.com/546195');
    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('https://space.bilibili.com/546195')).toBeInTheDocument();
    expect(screen.getByText('老番茄')).toBeInTheDocument();
  });

  it('rejects an entry with neither a URL nor an author and explains how to fix it', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '   ');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    expect(await screen.findByText('请填写网址或作者。')).toBeInTheDocument();
    expect(screen.getByLabelText('网址')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('作者')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('网址')).toHaveFocus();
    expect(screen.getByLabelText('作者')).toHaveValue('   ');
    expect(screen.queryByRole('list', { name: '收藏条目' })).not.toBeInTheDocument();
    expect(screen.getByText('没有符合条件的条目。')).toBeInTheDocument();
  });

  it('allows several entries with the same URL', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
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
    await screen.findByRole('heading', { name: 'Home' });

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
    await screen.findByRole('heading', { name: 'Home' });

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
    await screen.findByRole('heading', { name: 'Home' });

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
    await screen.findByRole('heading', { name: 'Home' });

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
describe('nested collections', () => {
  it('creates a collection under Home and browses it', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: '新建子收藏夹' }));
    await user.type(screen.getByLabelText('名称'), '科技');
    await user.click(screen.getByRole('button', { name: '创建' }));

    const tech = await screen.findByRole('button', { name: '科技' });
    await user.click(tech);

    expect(await screen.findByRole('heading', { name: 'Home / 科技' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '科技' })).toHaveAttribute('aria-current', 'page');
  });

  it('nests a collection under the selected collection', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(await screen.findByRole('button', { name: '新建子收藏夹' }));
    await user.type(screen.getByLabelText('名称'), '科技');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '科技' }));

    await user.click(await screen.findByRole('button', { name: '新建子收藏夹' }));
    await user.type(screen.getByLabelText('名称'), '前端');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await user.click(await screen.findByRole('button', { name: '前端' }));

    expect(await screen.findByRole('heading', { name: 'Home / 科技 / 前端' })).toBeInTheDocument();
  });

  it('renames a collection and updates its path', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await user.click(await screen.findByRole('button', { name: '科技' }));

    await user.click(screen.getByRole('button', { name: '重命名' }));
    const nameField = screen.getByLabelText('名称');
    expect(nameField).toHaveValue('科技');
    await user.clear(nameField);
    await user.type(nameField, '科技前沿');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('heading', { name: 'Home / 科技前沿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '科技前沿' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('button', { name: '科技' })).not.toBeInTheDocument();
  });

  it('moves a collection under another collection and updates its path', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, 'Home', '生活');
    await user.click(await screen.findByRole('button', { name: '生活' }));

    await user.click(screen.getByRole('button', { name: '移动收藏夹' }));
    await user.selectOptions(
      screen.getByLabelText('移动到'),
      screen.getByRole('option', { name: 'Home / 科技' }),
    );
    await user.click(screen.getByRole('button', { name: '移动' }));

    expect(await screen.findByRole('heading', { name: 'Home / 科技 / 生活' })).toBeInTheDocument();
  });

  it('refuses to move a collection into its own descendant', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await user.click(await screen.findByRole('button', { name: '科技' }));
    await createCollection(user, '科技', '前端');
    await user.click(await screen.findByRole('button', { name: '科技' }));

    await user.click(screen.getByRole('button', { name: '移动收藏夹' }));
    await user.selectOptions(
      screen.getByLabelText('移动到'),
      screen.getByRole('option', { name: 'Home / 科技 / 前端' }),
    );
    await user.click(screen.getByRole('button', { name: '移动' }));

    expect(await screen.findByText('不能移动到该收藏夹。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '前端' }));
    expect(await screen.findByRole('heading', { name: 'Home / 科技 / 前端' })).toBeInTheDocument();
  });

  it('refuses to move a collection into itself', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await user.click(await screen.findByRole('button', { name: '科技' }));

    await user.click(screen.getByRole('button', { name: '移动收藏夹' }));
    await user.selectOptions(
      screen.getByLabelText('移动到'),
      screen.getByRole('option', { name: 'Home / 科技' }),
    );
    await user.click(screen.getByRole('button', { name: '移动' }));

    expect(await screen.findByText('不能移动到该收藏夹。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home / 科技' })).toBeInTheDocument();
  });

  it('keeps an entry in multiple collections across restarts', async () => {
    const user = userEvent.setup();
    const first = openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, 'Home', '生活');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('checkbox', { name: 'Home / 科技' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / 生活' }));
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('老番茄');

    await user.click(await screen.findByRole('button', { name: '科技' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();

    first.unmount();
    first.close();
    opened = undefined;

    openApp({ databasePath: first.databasePath, directory: first.directory });
    await screen.findByRole('heading', { name: 'Home' });
    await user.click(await screen.findByRole('button', { name: '生活' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
  });

  it('filters a collection including its descendants', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await user.click(await screen.findByRole('button', { name: '科技' }));
    await createCollection(user, '科技', '前端');
    await createCollection(user, 'Home', '生活');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await user.type(screen.getByLabelText('作者'), '组件库');
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / 科技 / 前端' }));
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByRole('button', { name: '科技' });

    await user.click(screen.getByRole('button', { name: '科技' }));
    expect(await screen.findByText('组件库')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '前端' }));
    expect(await screen.findByText('组件库')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('没有符合条件的条目。')).toBeInTheDocument();
  });

  it('searches collection paths and other text fields', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', 'Rust 笔记');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await user.type(screen.getByLabelText('作者'), '影视飓风');
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / Rust 笔记' }));
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('影视飓风');

    const search = screen.getByRole('searchbox', { name: '搜索' });
    await user.type(search, 'rust');
    expect(await screen.findByText('影视飓风')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '影视');
    expect(await screen.findByText('影视飓风')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '不存在');
    expect(await screen.findByText('没有符合条件的条目。')).toBeInTheDocument();
  });

  it('combines search with a collection filter using AND', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, 'Home', '生活');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await addEntryTo(user, '番茄工作法', 'Home / 科技');
    await addEntryTo(user, '其他条目', 'Home / 科技');
    await addEntryTo(user, '番茄日记', 'Home / 生活');

    const search = screen.getByRole('searchbox', { name: '搜索' });
    await user.type(search, '番茄');
    expect(await screen.findByText('番茄工作法')).toBeInTheDocument();
    expect(screen.getByText('番茄日记')).toBeInTheDocument();
    expect(screen.queryByText('其他条目')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '科技' }));
    expect(await screen.findByText('番茄工作法')).toBeInTheDocument();
    expect(screen.queryByText('番茄日记')).not.toBeInTheDocument();
    expect(screen.queryByText('其他条目')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: '搜索' }));
    expect(await screen.findByText('其他条目')).toBeInTheDocument();
    expect(screen.getByText('番茄工作法')).toBeInTheDocument();
    expect(screen.queryByText('番茄日记')).not.toBeInTheDocument();
  });

  it("changes an entry's collections by editing its memberships", async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, 'Home', '生活');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await addEntryTo(user, '影视飓风', 'Home / 科技');

    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('没有符合条件的条目。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await user.click(await screen.findByRole('button', { name: '编辑' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / 科技' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / 生活' }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await screen.findByText('影视飓风');

    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('影视飓风')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '科技' }));
    expect(await screen.findByText('没有符合条件的条目。')).toBeInTheDocument();
  });

  async function addEntryTo(
    user: ReturnType<typeof userEvent.setup>,
    author: string,
    collectionPath: string,
  ) {
    await user.type(screen.getByLabelText('作者'), author);
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await user.click(screen.getByRole('checkbox', { name: collectionPath }));
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText(author);
  }

  async function createCollection(
    user: ReturnType<typeof userEvent.setup>,
    parentName: string,
    name: string,
  ) {
    await user.click(await screen.findByRole('button', { name: parentName }));
    await user.click(await screen.findByRole('button', { name: '新建子收藏夹' }));
    await user.type(screen.getByLabelText('名称'), name);
    await user.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('button', { name });
  }
});
describe('labels and discovery', () => {
  it('offers the seeded platform labels as filters', async () => {
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    expect(await screen.findByRole('checkbox', { name: 'Bilibili' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '抖音' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '小红书' })).toBeInTheDocument();
  });

  it('adds, renames, and removes platform labels', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: '管理平台标签' }));
    await user.type(screen.getByLabelText('新平台标签'), 'YouTube');
    await user.click(screen.getByRole('button', { name: '添加平台标签' }));
    expect(await screen.findByRole('checkbox', { name: 'YouTube' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重命名 抖音' }));
    const nameField = screen.getByLabelText('平台标签名称');
    await user.clear(nameField);
    await user.type(nameField, 'Douyin');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('checkbox', { name: 'Douyin' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '抖音' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '删除 Bilibili' }));

    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'Bilibili' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: 'Douyin' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '小红书' })).toBeInTheDocument();
  });

  it('saves a titled entry with a platform label and content labels', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('标题'), 'React 教程');
    await user.type(screen.getByLabelText('网址'), 'https://www.bilibili.com/video/BV1react');
    await user.type(screen.getByLabelText('作者'), 'Alice');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'Bilibili' }),
    );
    await user.type(screen.getByLabelText('内容标签'), '#前端 #React');
    await user.click(screen.getByRole('button', { name: '保存条目' }));

    const list = await screen.findByRole('list', { name: '收藏条目' });
    expect(within(list).getByText('React 教程')).toBeInTheDocument();
    expect(within(list).getByText('https://www.bilibili.com/video/BV1react')).toBeInTheDocument();
    expect(within(list).getByText('Alice')).toBeInTheDocument();
    expect(within(list).getByText('Bilibili')).toBeInTheDocument();
    expect(within(list).getByText('#前端')).toBeInTheDocument();
    expect(within(list).getByText('#React')).toBeInTheDocument();
  });

  it('offers content labels used by saved entries as reusable filters', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    for (const [title, author, labels] of [
      ['第一篇', '作者一', '#音乐 #生活'],
      ['第二篇', '作者二', '#音乐'],
    ] as const) {
      await user.type(screen.getByLabelText('标题'), title);
      await user.type(screen.getByLabelText('作者'), author);
      await user.type(screen.getByLabelText('内容标签'), labels);
      await user.click(screen.getByRole('button', { name: '保存条目' }));
      await screen.findByText(title);
    }

    expect(await screen.findByRole('checkbox', { name: '#音乐' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: '#音乐' })).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: '#生活' })).toBeInTheDocument();
  });

  it('keeps content labels available until the last use is removed', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    for (const [title, author, labels] of [
      ['第一篇', '作者一', '#音乐 #生活'],
      ['第二篇', '作者二', '#音乐'],
    ] as const) {
      await user.type(screen.getByLabelText('标题'), title);
      await user.type(screen.getByLabelText('作者'), author);
      await user.type(screen.getByLabelText('内容标签'), labels);
      await user.click(screen.getByRole('button', { name: '保存条目' }));
      await screen.findByText(title);
    }

    const first = screen.getByText('第一篇').closest('li');
    if (!first) throw new Error('missing first entry');
    await user.click(within(first).getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('内容标签'));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: '#生活' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('checkbox', { name: '#音乐' })).toBeInTheDocument();

    const second = screen.getByText('第二篇').closest('li');
    if (!second) throw new Error('missing second entry');
    await user.click(within(second).getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('内容标签'));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: '#音乐' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('第一篇')).toBeInTheDocument();
    expect(screen.getByText('第二篇')).toBeInTheDocument();
  });

  it('searches titles, URLs, authors, platforms, and content labels case-insensitively', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('标题'), 'React 深入');
    await user.type(screen.getByLabelText('网址'), 'https://Example.com/Course');
    await user.type(screen.getByLabelText('作者'), 'Alice');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'Bilibili' }),
    );
    await user.type(screen.getByLabelText('内容标签'), '#Frontend');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('React 深入');

    await user.type(screen.getByLabelText('标题'), '剪辑技巧');
    await user.type(screen.getByLabelText('作者'), '阿星');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: '抖音' }),
    );
    await user.type(screen.getByLabelText('内容标签'), '#视频');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('剪辑技巧');

    const search = screen.getByLabelText('搜索');
    for (const query of ['react', 'example.COM', 'alice', 'bilibili', 'frontend']) {
      await user.clear(search);
      await user.type(search, query);
      expect(screen.getByText('React 深入')).toBeInTheDocument();
      expect(screen.queryByText('剪辑技巧')).not.toBeInTheDocument();
    }
  });

  it('shows an empty-result state and clears search and filters without changing entries', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('标题'), 'React 入门');
    await user.type(screen.getByLabelText('作者'), 'Alice');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'Bilibili' }),
    );
    await user.type(screen.getByLabelText('内容标签'), '#前端');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('React 入门');

    await user.type(screen.getByLabelText('标题'), '剪辑技巧');
    await user.type(screen.getByLabelText('作者'), '阿星');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: '抖音' }),
    );
    await user.type(screen.getByLabelText('内容标签'), '#视频');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('剪辑技巧');

    await user.click(screen.getByRole('checkbox', { name: 'Bilibili' }));
    expect(screen.getByText('React 入门')).toBeInTheDocument();
    expect(screen.queryByText('剪辑技巧')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '#视频' }));
    expect(await screen.findByText('没有符合条件的条目。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(await screen.findByText('React 入门')).toBeInTheDocument();
    expect(screen.getByText('剪辑技巧')).toBeInTheDocument();
    expect(screen.queryByText('没有符合条件的条目。')).not.toBeInTheDocument();

    const search = screen.getByLabelText('搜索');
    await user.type(search, '不存在的关键词');
    expect(await screen.findByText('没有符合条件的条目。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(await screen.findByText('React 入门')).toBeInTheDocument();
    expect(screen.getByText('剪辑技巧')).toBeInTheDocument();
    expect(search).toHaveValue('');
  });

  it('combines selected values with OR inside a dimension and AND across dimensions', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    const entries = [
      { title: 'React 前端', author: 'Alice', platform: 'Bilibili', labels: '#前端' },
      { title: '剪辑视频', author: '阿星', platform: '抖音', labels: '#视频' },
      { title: '今日穿搭', author: '小美', platform: '小红书', labels: '#时尚' },
      { title: 'React 进阶', author: 'Bob', platform: '抖音', labels: '#前端' },
    ] as const;

    for (const entry of entries) {
      await user.type(screen.getByLabelText('标题'), entry.title);
      await user.type(screen.getByLabelText('作者'), entry.author);
      await user.selectOptions(
        screen.getByLabelText('平台标签'),
        screen.getByRole('option', { name: entry.platform }),
      );
      await user.type(screen.getByLabelText('内容标签'), entry.labels);
      await user.click(screen.getByRole('button', { name: '保存条目' }));
      await screen.findByText(entry.title);
    }

    await user.click(screen.getByRole('checkbox', { name: 'Bilibili' }));
    await user.click(screen.getByRole('checkbox', { name: '抖音' }));

    expect(screen.getByText('React 前端')).toBeInTheDocument();
    expect(screen.getByText('剪辑视频')).toBeInTheDocument();
    expect(screen.getByText('React 进阶')).toBeInTheDocument();
    expect(screen.queryByText('今日穿搭')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '#前端' }));
    expect(screen.getByText('React 前端')).toBeInTheDocument();
    expect(screen.getByText('React 进阶')).toBeInTheDocument();
    expect(screen.queryByText('剪辑视频')).not.toBeInTheDocument();
    expect(screen.queryByText('今日穿搭')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '#视频' }));
    expect(screen.getByText('React 前端')).toBeInTheDocument();
    expect(screen.getByText('剪辑视频')).toBeInTheDocument();
    expect(screen.getByText('React 进阶')).toBeInTheDocument();
    expect(screen.queryByText('今日穿搭')).not.toBeInTheDocument();
  });

  it('updates entries when a platform label is renamed and keeps them when it is removed', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('标题'), '一期作品');
    await user.type(screen.getByLabelText('作者'), 'Alice');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'Bilibili' }),
    );
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('一期作品');

    await user.click(screen.getByRole('button', { name: '管理平台标签' }));
    await user.click(screen.getByRole('button', { name: '重命名 Bilibili' }));
    const nameField = screen.getByLabelText('平台标签名称');
    await user.clear(nameField);
    await user.type(nameField, 'B站');
    await user.click(screen.getByRole('button', { name: '保存' }));

    const list = await screen.findByRole('list', { name: '收藏条目' });
    expect(within(list).getByText('B站')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '删除 B站' }));

    await waitFor(() => expect(within(list).queryByText('B站')).not.toBeInTheDocument());
    expect(screen.getByText('一期作品')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'B站' })).not.toBeInTheDocument();
  });

  it('keeps custom platform labels and content labels after a restart', async () => {
    const user = userEvent.setup();
    const first = openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: '管理平台标签' }));
    await user.type(screen.getByLabelText('新平台标签'), 'YouTube');
    await user.click(screen.getByRole('button', { name: '添加平台标签' }));
    await screen.findByRole('checkbox', { name: 'YouTube' });

    await user.type(screen.getByLabelText('标题'), '旅行 Vlog');
    await user.type(screen.getByLabelText('作者'), '小林');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'YouTube' }),
    );
    await user.type(screen.getByLabelText('内容标签'), '#旅行');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('旅行 Vlog');

    first.unmount();
    first.close();
    opened = undefined;

    openApp({ databasePath: first.databasePath, directory: first.directory });

    const list = await screen.findByRole('list', { name: '收藏条目' });
    expect(within(list).getByText('YouTube')).toBeInTheDocument();
    expect(within(list).getByText('#旅行')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'YouTube' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '#旅行' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Bilibili' })).toBeInTheDocument();
  });

  it('drops an active filter when its platform label is removed', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('标题'), '留在这里');
    await user.type(screen.getByLabelText('作者'), 'Alice');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'Bilibili' }),
    );
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('留在这里');

    await user.click(screen.getByRole('checkbox', { name: 'Bilibili' }));
    await user.click(screen.getByRole('button', { name: '管理平台标签' }));
    await user.click(screen.getByRole('button', { name: '删除 Bilibili' }));

    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'Bilibili' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('留在这里')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清除筛选' })).not.toBeInTheDocument();
  });

  it('rejects empty and duplicate platform label names', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: '管理平台标签' }));
    await user.click(screen.getByRole('button', { name: '添加平台标签' }));
    expect(await screen.findByText('请输入平台标签名称。')).toBeInTheDocument();

    await user.type(screen.getByLabelText('新平台标签'), 'bilibili');
    await user.click(screen.getByRole('button', { name: '添加平台标签' }));
    expect(await screen.findByText('平台标签已存在。')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'Bilibili' })).toHaveLength(1);
  });

  it('keeps editing an entry after its platform label is removed', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('标题'), '保留作品');
    await user.type(screen.getByLabelText('作者'), 'Alice');
    await user.selectOptions(
      screen.getByLabelText('平台标签'),
      screen.getByRole('option', { name: 'Bilibili' }),
    );
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('保留作品');

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.click(screen.getByRole('button', { name: '管理平台标签' }));
    await user.click(screen.getByRole('button', { name: '删除 Bilibili' }));
    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'Bilibili' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '保存修改' })).not.toBeInTheDocument(),
    );

    const list = screen.getByRole('list', { name: '收藏条目' });
    expect(within(list).getByText('保留作品')).toBeInTheDocument();
    expect(within(list).queryByText('Bilibili')).not.toBeInTheDocument();
  });
});

describe('content label management', () => {
  it('renames a content label everywhere it is used', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await user.type(screen.getByLabelText('作者'), '标签作者');
    await user.type(screen.getByLabelText('内容标签'), '#前端');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('标签作者');

    await user.click(screen.getByRole('button', { name: '管理内容标签' }));
    await user.click(screen.getByRole('button', { name: '重命名 #前端' }));
    const name = screen.getByLabelText('内容标签名称');
    await user.clear(name);
    await user.type(name, 'Web');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('checkbox', { name: '#Web' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '#前端' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: '收藏条目' })).toHaveTextContent('#Web');
    expect(screen.getByRole('list', { name: '收藏条目' })).not.toHaveTextContent('#前端');
  });

  it('deletes an unused content label but protects one still attached to an entry', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await user.type(screen.getByLabelText('作者'), '标签作者');
    await user.type(screen.getByLabelText('内容标签'), '#保留');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await screen.findByText('标签作者');
    await user.click(screen.getByRole('button', { name: '管理内容标签' }));
    await screen.findByRole('button', { name: '删除 #保留' });
    await user.click(screen.getByRole('button', { name: '删除 #保留' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '内容标签正在使用，请先从条目中移除。',
    );
    expect(screen.getByRole('checkbox', { name: '#保留' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('内容标签'));
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '删除 #保留' })).not.toBeInTheDocument(),
    );

    await user.clear(screen.getByLabelText('作者'));
    await user.type(screen.getByLabelText('作者'), '临时标签作者');
    await user.clear(screen.getByLabelText('内容标签'));
    await user.type(screen.getByLabelText('内容标签'), '#临时');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('临时标签作者')).closest('li');
    if (!row) throw new Error('missing second entry');
    await user.click(within(row).getByRole('button', { name: '删除 临时标签作者' }));
    await user.click(screen.getByRole('button', { name: '回收站' }));
    await user.click(screen.getByRole('button', { name: '立即清除 临时标签作者' }));
    await user.click(screen.getByRole('button', { name: '永久清除' }));
    await screen.findByText('回收站是空的。');
    await user.click(screen.getByRole('button', { name: 'Home' }));
    const managerToggle = await screen.findByRole('button', { name: '管理内容标签' });
    if (managerToggle.getAttribute('aria-expanded') !== 'true') await user.click(managerToggle);

    const manager = await screen.findByRole('region', { name: '内容标签管理' });
    await waitFor(() => expect(within(manager).queryByText('#临时')).not.toBeInTheDocument());
    expect(within(manager).getByText('还没有内容标签。')).toBeInTheDocument();
  });
});

describe('trash and recovery', () => {
  it('moves a deleted entry to the trash and restores it', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('老番茄')).closest('li');
    if (!row) throw new Error('missing entry row');
    await user.click(within(row).getByRole('button', { name: '删除 老番茄' }));

    await waitFor(() => expect(screen.queryByText('老番茄')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '回收站' }));
    expect(await screen.findByRole('heading', { name: '回收站' })).toBeInTheDocument();
    const trash = screen.getByRole('list', { name: '回收站项目' });
    expect(within(trash).getByText('老番茄')).toBeInTheDocument();
    expect(within(trash).getByText('剩余 30 天')).toBeInTheDocument();

    await user.click(within(trash).getByRole('button', { name: '恢复 老番茄' }));
    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
  });

  it('shows remaining retention and clears a trashed entry immediately', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '影视飓风');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('影视飓风')).closest('li');
    if (!row) throw new Error('missing entry row');
    await user.click(within(row).getByRole('button', { name: '删除 影视飓风' }));

    await user.click(screen.getByRole('button', { name: '回收站' }));
    const trash = await screen.findByRole('list', { name: '回收站项目' });
    expect(within(trash).getByText('剩余 30 天')).toBeInTheDocument();

    await user.click(within(trash).getByRole('button', { name: '立即清除 影视飓风' }));
    const confirm = await screen.findByRole('dialog', { name: '永久清除？' });
    await user.click(within(confirm).getByRole('button', { name: '永久清除' }));
    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('还没有收藏条目。')).toBeInTheDocument();
  });
});

describe('collection deletion', () => {
  it('explains the impact, offers both choices, and can be cancelled', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, '科技', '前端');
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await addEntryTo(user, '组件库', 'Home / 科技 / 前端');
    await user.click(screen.getByRole('button', { name: '科技' }));

    await user.click(screen.getByRole('button', { name: '删除收藏夹' }));
    const dialog = await screen.findByRole('dialog', { name: '删除收藏夹？' });
    expect(within(dialog).getByText(/1 个子收藏夹/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 个条目/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('radio', { name: '条目移到 Home，删除收藏夹' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('radio', { name: '收藏夹和条目移到回收站' }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home / 科技' })).toBeInTheDocument();
    expect(await screen.findByText('组件库')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '前端' }));
    expect(await screen.findByRole('heading', { name: 'Home / 科技 / 前端' })).toBeInTheDocument();
  });

  it('moves entries to Home and preserves memberships outside the deleted tree', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, 'Home', '生活');
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home' }));
    await addEntryTo(user, '老番茄', 'Home / 生活', 'Home / 科技');
    const entryList = screen.getByRole('list', { name: '收藏条目' });
    expect(within(entryList).getByText(/Home \/ 生活/)).toBeInTheDocument();
    expect(within(entryList).getByText(/Home \/ 科技/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '科技' }));

    await user.click(screen.getByRole('button', { name: '删除收藏夹' }));
    const dialog = await screen.findByRole('dialog', { name: '删除收藏夹？' });
    await user.click(within(dialog).getByRole('radio', { name: '条目移到 Home，删除收藏夹' }));
    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '科技' })).not.toBeInTheDocument();
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
    const restoredRow = screen.getByText('老番茄').closest('li');
    if (!restoredRow) throw new Error('missing entry row');
    expect(restoredRow).toHaveTextContent('Home');
    expect(restoredRow).toHaveTextContent('Home / 生活');
    expect(restoredRow).not.toHaveTextContent('Home / 科技');

    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
  });

  it('deletes an empty collection after confirmation', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '临时');
    await user.click(screen.getByRole('button', { name: '临时' }));

    await user.click(screen.getByRole('button', { name: '删除收藏夹' }));
    const dialog = await screen.findByRole('dialog', { name: '删除收藏夹？' });
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '临时' })).not.toBeInTheDocument();
  });
});

describe('collection trash group', () => {
  it('moves a collection tree and its entries to the trash and restores both', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, '科技', '前端');
    await createCollection(user, 'Home', '生活');
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await addEntryTo(user, '组件库', 'Home / 科技 / 前端', 'Home / 生活');
    await user.click(screen.getByRole('button', { name: '科技' }));

    await user.click(screen.getByRole('button', { name: '删除收藏夹' }));
    const dialog = await screen.findByRole('dialog', { name: '删除收藏夹？' });
    await user.click(within(dialog).getByRole('radio', { name: '收藏夹和条目移到回收站' }));
    await user.click(within(dialog).getByRole('button', { name: '删除' }));

    await screen.findByRole('heading', { name: 'Home' });
    expect(screen.queryByRole('button', { name: '科技' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '前端' })).not.toBeInTheDocument();
    expect(screen.queryByText('组件库')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '回收站' }));
    const trash = await screen.findByRole('list', { name: '回收站项目' });
    expect(within(trash).getByText('科技')).toBeInTheDocument();
    expect(within(trash).getByText('收藏夹 · 2 个收藏夹 · 1 个条目')).toBeInTheDocument();

    await user.click(within(trash).getByRole('button', { name: '恢复 科技' }));

    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '科技' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('组件库')).toBeInTheDocument();
    const restoredRow = screen.getByText('组件库').closest('li');
    if (!restoredRow) throw new Error('missing entry row');
    expect(restoredRow).toHaveTextContent('Home / 科技 / 前端');
    expect(restoredRow).toHaveTextContent('Home / 生活');

    await user.click(screen.getByRole('button', { name: '科技' }));
    await user.click(await screen.findByRole('button', { name: '前端' }));
    expect(await screen.findByRole('heading', { name: 'Home / 科技 / 前端' })).toBeInTheDocument();
    expect(await screen.findByText('组件库')).toBeInTheDocument();
  });
});

describe('trash retention', () => {
  it('purges expired trash while the app remains open and cleans up its timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let today = new Date('2025-01-01T00:00:00.000Z');
    const app = openApp({ now: () => today });
    await screen.findByRole('heading', { name: 'Home' });
    await user.type(screen.getByLabelText('作者'), '按时清理');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    await user.click(await screen.findByRole('button', { name: '删除 按时清理' }));
    await user.click(screen.getByRole('button', { name: '回收站' }));
    await screen.findByText('按时清理');
    expect(vi.getTimerCount()).toBe(2); // lifecycle refresh and download-link revocation

    today = new Date('2025-02-01T00:00:00.000Z');
    await act(() => vi.advanceTimersByTimeAsync(60 * 60 * 1000));

    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();
    app.unmount();
    expect(vi.getTimerCount()).toBe(1); // the unrelated URL revocation timer may remain
    vi.useRealTimers();
  });

  it('counts down the remaining retention across restarts', async () => {
    const user = userEvent.setup();
    let today = new Date('2025-01-01T00:00:00.000Z');
    const first = openApp({ now: () => today });
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('老番茄')).closest('li');
    if (!row) throw new Error('missing entry row');
    await user.click(within(row).getByRole('button', { name: '删除 老番茄' }));

    await user.click(screen.getByRole('button', { name: '回收站' }));
    let trash = await screen.findByRole('list', { name: '回收站项目' });
    expect(within(trash).getByText('剩余 30 天')).toBeInTheDocument();

    first.unmount();
    first.close();
    opened = undefined;

    today = new Date('2025-01-11T00:00:00.000Z');
    openApp({ databasePath: first.databasePath, directory: first.directory, now: () => today });
    await screen.findByRole('heading', { name: 'Home' });
    await user.click(screen.getByRole('button', { name: '回收站' }));
    trash = await screen.findByRole('list', { name: '回收站项目' });
    expect(within(trash).getByText('剩余 20 天')).toBeInTheDocument();
  });

  it('purges trashed items once the retention window has elapsed', async () => {
    const user = userEvent.setup();
    let today = new Date('2025-01-01T00:00:00.000Z');
    const first = openApp({ now: () => today });
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('老番茄')).closest('li');
    if (!row) throw new Error('missing entry row');
    await user.click(within(row).getByRole('button', { name: '删除 老番茄' }));

    first.unmount();
    first.close();
    opened = undefined;

    today = new Date('2025-02-01T00:00:00.000Z');
    openApp({ databasePath: first.databasePath, directory: first.directory, now: () => today });
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: '回收站' }));
    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('还没有收藏条目。')).toBeInTheDocument();
  });
});

describe('permanent cleanup', () => {
  it('asks for confirmation before permanently clearing a trashed item', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '影视飓风');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('影视飓风')).closest('li');
    if (!row) throw new Error('missing entry row');
    await user.click(within(row).getByRole('button', { name: '删除 影视飓风' }));

    await user.click(screen.getByRole('button', { name: '回收站' }));
    const trash = await screen.findByRole('list', { name: '回收站项目' });
    await user.click(within(trash).getByRole('button', { name: '立即清除 影视飓风' }));

    const dialog = await screen.findByRole('dialog', { name: '永久清除？' });
    expect(within(dialog).getByText(/无法恢复/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '取消' }));

    expect(screen.getByRole('list', { name: '回收站项目' })).toBeInTheDocument();
    expect(within(trash).getByText('影视飓风')).toBeInTheDocument();

    await user.click(within(trash).getByRole('button', { name: '立即清除 影视飓风' }));
    const again = await screen.findByRole('dialog', { name: '永久清除？' });
    await user.click(within(again).getByRole('button', { name: '永久清除' }));

    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();
  });
});

describe('clearing the trash', () => {
  it('permanently empties the trash after confirmation', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    for (const author of ['老番茄', '影视飓风']) {
      await user.type(screen.getByLabelText('作者'), author);
      await user.click(screen.getByRole('button', { name: '保存条目' }));
      const row = (await screen.findByText(author)).closest('li');
      if (!row) throw new Error('missing entry row');
      await user.click(within(row).getByRole('button', { name: `删除 ${author}` }));
    }

    await user.click(screen.getByRole('button', { name: '回收站' }));
    await screen.findByRole('list', { name: '回收站项目' });
    await user.click(screen.getByRole('button', { name: '立即清空回收站' }));

    const dialog = await screen.findByRole('dialog', { name: '永久清除？' });
    expect(within(dialog).getByText(/2 个项目/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '清空回收站' }));

    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('还没有收藏条目。')).toBeInTheDocument();
  });
});

describe('trash and content labels', () => {
  it('drops a content label filter while its only entry is in the trash and restores it', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });

    await user.type(screen.getByLabelText('作者'), '老番茄');
    await user.type(screen.getByLabelText('内容标签'), '#美食');
    await user.click(screen.getByRole('button', { name: '保存条目' }));
    const row = (await screen.findByText('老番茄')).closest('li');
    if (!row) throw new Error('missing entry row');
    expect(await screen.findByRole('checkbox', { name: '#美食' })).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: '删除 老番茄' }));
    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: '#美食' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: '回收站' }));
    const trash = await screen.findByRole('list', { name: '回收站项目' });
    await user.click(within(trash).getByRole('button', { name: '恢复 老番茄' }));
    await screen.findByText('回收站是空的。');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: '#美食' })).toBeInTheDocument();
  });
});

describe('trash group under a deleted collection', () => {
  it('keeps a trashed collection recoverable when its parent collection is deleted', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: 'Home' });
    await createCollection(user, 'Home', '生活');
    await createCollection(user, '生活', '科技');
    await createCollection(user, '科技', '前端');
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await addEntryTo(user, '组件库', 'Home / 生活 / 科技 / 前端');

    await user.click(screen.getByRole('button', { name: '科技' }));
    await user.click(screen.getByRole('button', { name: '删除收藏夹' }));
    let dialog = await screen.findByRole('dialog', { name: '删除收藏夹？' });
    await user.click(within(dialog).getByRole('radio', { name: '收藏夹和条目移到回收站' }));
    await user.click(within(dialog).getByRole('button', { name: '删除' }));
    await screen.findByRole('heading', { name: 'Home' });

    await user.click(screen.getByRole('button', { name: '生活' }));
    await user.click(screen.getByRole('button', { name: '删除收藏夹' }));
    dialog = await screen.findByRole('dialog', { name: '删除收藏夹？' });
    await user.click(within(dialog).getByRole('button', { name: '删除' }));
    await screen.findByRole('heading', { name: 'Home' });
    expect(screen.queryByRole('button', { name: '生活' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '回收站' }));
    const trash = await screen.findByRole('list', { name: '回收站项目' });
    expect(within(trash).getByText('科技')).toBeInTheDocument();
    await user.click(within(trash).getByRole('button', { name: '恢复 科技' }));

    expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '科技' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    expect(await screen.findByText('组件库')).toBeInTheDocument();
    expect(screen.getByText('Home / 科技 / 前端')).toBeInTheDocument();
  });
});
