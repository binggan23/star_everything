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

describe('nested collections', () => {
  it('creates a collection under Home and browses it', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });

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
    await screen.findByRole('heading', { name: '全部条目' });

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
    await screen.findByRole('heading', { name: '全部条目' });
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
    await screen.findByRole('heading', { name: '全部条目' });
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
    await screen.findByRole('heading', { name: '全部条目' });
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
    await screen.findByRole('heading', { name: '全部条目' });
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
    await screen.findByRole('heading', { name: '全部条目' });
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
    await screen.findByRole('heading', { name: '全部条目' });
    await user.click(await screen.findByRole('button', { name: '生活' }));
    expect(await screen.findByText('老番茄')).toBeInTheDocument();
  });

  it('filters a collection including its descendants', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });
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
    expect(await screen.findByText('没有匹配的条目。')).toBeInTheDocument();
  });

  it('searches collection paths and other text fields', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });
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
    expect(await screen.findByText('没有匹配的条目。')).toBeInTheDocument();
  });

  it('combines search with a collection filter using AND', async () => {
    const user = userEvent.setup();
    openApp();
    await screen.findByRole('heading', { name: '全部条目' });
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
    await screen.findByRole('heading', { name: '全部条目' });
    await createCollection(user, 'Home', '科技');
    await createCollection(user, 'Home', '生活');

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await addEntryTo(user, '影视飓风', 'Home / 科技');

    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('没有匹配的条目。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部条目' }));
    await user.click(await screen.findByRole('button', { name: '编辑' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / 科技' }));
    await user.click(screen.getByRole('checkbox', { name: 'Home / 生活' }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await screen.findByText('影视飓风');

    await user.click(screen.getByRole('button', { name: '生活' }));
    expect(await screen.findByText('影视飓风')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '科技' }));
    expect(await screen.findByText('没有匹配的条目。')).toBeInTheDocument();
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
