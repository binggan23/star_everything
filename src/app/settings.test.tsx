import { createHash, webcrypto } from 'node:crypto';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { createTestRecognizer } from '../test/support/publicPageFetcher';
import { openTestRepository } from '../test/support/testRepository';
import type { OpenTestRepositoryOptions } from '../test/support/testRepository';
import { App } from './App';

const databases: ReturnType<typeof openTestRepository>[] = [];
const views: ReturnType<typeof render>[] = [];

function openApp(options: OpenTestRepositoryOptions = {}) {
  const database = openTestRepository(options);
  databases.push(database);
  const view = render(
    <App repository={database.repository} recognizer={createTestRecognizer().recognizer} />,
  );
  views.push(view);
  return { ...database, ...view };
}

const userSetup = () => userEvent.setup();
type User = ReturnType<typeof userSetup>;

async function openSettings(user: User) {
  await user.click(await screen.findByRole('button', { name: '设置' }));
  await screen.findByRole('heading', { name: '设置' });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const view of views.splice(0)) view.unmount();
  for (const database of databases.splice(0)) database.dispose();
});

it('keeps theme and manual metadata settings after reopening the app', async () => {
  const user = userSetup();
  const first = openApp();
  await openSettings(user);
  await user.click(screen.getByRole('radio', { name: '深色' }));
  await user.click(screen.getByRole('checkbox', { name: '启用元数据识别' }));
  await user.click(screen.getByRole('button', { name: '保存偏好' }));
  await screen.findByText('偏好已保存。');

  first.unmount();
  first.close();
  openApp({ databasePath: first.databasePath, directory: first.directory });
  await openSettings(user);
  expect(screen.getByRole('radio', { name: '深色' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '启用元数据识别' })).not.toBeChecked();

  await user.click(screen.getByRole('button', { name: '全部条目' }));
  expect(screen.queryByRole('button', { name: '识别' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('作者'), '手动收藏的作者');
  await user.click(screen.getByRole('button', { name: '保存条目' }));
  expect(await screen.findByText('手动收藏的作者')).toBeInTheDocument();
});

function captureDownload() {
  const files: Blob[] = [];
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(file: Blob) {
        files.push(file);
        return 'blob:backup';
      }
      static revokeObjectURL() {}
    },
  );
  const anchors: { filename: string; url: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    anchors.push({ filename: this.download, url: this.href });
  });
  return { files, anchors };
}

async function createFolder(user: User, parent: string, name: string) {
  await user.click(await screen.findByRole('button', { name: parent }));
  await user.click(await screen.findByRole('button', { name: '新建子收藏夹' }));
  await user.type(screen.getByLabelText('名称'), name);
  await user.click(screen.getByRole('button', { name: '创建' }));
  await screen.findByRole('button', { name });
}

it('downloads a versioned backup of settings, labels, collection hierarchy, memberships and trash', async () => {
  const user = userSetup();
  const { files, anchors } = captureDownload();
  openApp();
  await createFolder(user, 'Home', '资料');
  await createFolder(user, '资料', '设计');
  await user.click(screen.getByRole('button', { name: '全部条目' }));
  await user.selectOptions(screen.getByLabelText('平台标签'), 'Bilibili');
  await user.type(screen.getByLabelText('内容标签'), '#笔记');
  await user.click(screen.getByRole('checkbox', { name: 'Home / 资料 / 设计' }));
  await user.type(screen.getByLabelText('作者'), '留存作者');
  await user.click(screen.getByRole('button', { name: '保存条目' }));
  await screen.findByText('留存作者');
  await user.type(screen.getByLabelText('作者'), '已删除作者');
  await user.click(screen.getByRole('button', { name: '保存条目' }));
  await user.click(await screen.findByRole('button', { name: '删除 已删除作者' }));
  await waitFor(() => expect(screen.queryByText('已删除作者')).not.toBeInTheDocument());
  await openSettings(user);
  await user.click(screen.getByRole('radio', { name: '深色' }));
  await user.click(screen.getByRole('button', { name: '保存偏好' }));
  await screen.findByText('偏好已保存。');
  await user.click(screen.getByRole('button', { name: '导出 JSON 备份' }));
  await waitFor(() => expect(anchors[0]?.filename).toMatch(/^star-everything-.*\.json$/));
  const [file] = files;
  if (!file) throw new Error('Missing download');
  expect(file.type).toBe('application/json');
  const backup = JSON.parse(await file.text());
  const {
    entries,
    folders,
    entry_folders,
    platform_labels,
    content_labels,
    entry_content_labels,
    trash_groups,
    settings,
  } = backup.data;
  expect(backup).toMatchObject({ format: 'star-everything-backup', version: 1 });
  expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(settings).toEqual({ theme: 'dark', recognizeMetadata: true });
  const active = entries.find((row: { author: string }) => row.author === '留存作者');
  const deleted = entries.find((row: { author: string }) => row.author === '已删除作者');
  const parent = folders.find((row: { name: string }) => row.name === '资料');
  const child = folders.find((row: { name: string }) => row.name === '设计');
  expect(child.parent_id).toBe(parent.id);
  expect(entry_folders).toEqual(
    expect.arrayContaining([
      { entry_id: active.id, folder_id: 'home' },
      { entry_id: active.id, folder_id: child.id },
    ]),
  );
  expect(platform_labels).toContainEqual(
    expect.objectContaining({ id: active.platform_label_id, name: 'Bilibili' }),
  );
  expect(content_labels).toContainEqual(expect.objectContaining({ name: '笔记' }));
  expect(entry_content_labels).toContainEqual({
    entry_id: active.id,
    label_id: content_labels[0].id,
  });
  expect(trash_groups).toContainEqual(
    expect.objectContaining({ id: deleted.trash_group_id, kind: 'entry', label: '已删除作者' }),
  );
});

async function addAuthor(user: User, author: string, url?: string, label?: string) {
  if (url !== undefined) await user.type(screen.getByLabelText('网址'), url);
  if (label !== undefined) await user.type(screen.getByLabelText('内容标签'), label);
  await user.type(screen.getByLabelText('作者'), author);
  await user.click(screen.getByRole('button', { name: '保存条目' }));
  await screen.findByText(author);
}

async function download(user: User, captured: ReturnType<typeof captureDownload>) {
  await openSettings(user);
  const next = captured.anchors.length;
  await user.click(screen.getByRole('button', { name: '导出 JSON 备份' }));
  await waitFor(() => expect(captured.anchors[next]?.filename).toMatch(/\.json$/));
  const blob = captured.files[next];
  const anchor = captured.anchors[next];
  if (!blob || !anchor) throw new Error('Missing download');
  return new File([blob], anchor.filename, { type: 'application/json' });
}

it('merges a repeated backup by stable ID and keeps independently saved entries with the same URL', async () => {
  const user = userSetup();
  const captured = captureDownload();
  const url = 'https://example.com/video';
  const source = openApp();
  await screen.findByRole('heading', { name: 'Home' });
  await addAuthor(user, '来自备份', url, '#Note');
  const file = await download(user, captured);
  source.unmount();

  openApp();
  await screen.findByRole('heading', { name: 'Home' });
  await addAuthor(user, '本地保存', url, '#note');
  for (const edited of [false, true]) {
    await openSettings(user);
    await user.upload(screen.getByLabelText('备份文件'), file);
    await user.click(screen.getByRole('button', { name: '合并导入' }));
    await screen.findByText('备份已合并。');
    await user.click(screen.getByRole('button', { name: '全部条目' }));
    const author = edited ? '本地修改' : '来自备份';
    expect(await screen.findByText(author)).toBeInTheDocument();
    expect(screen.getAllByText(url)).toHaveLength(2);
    expect(screen.getByText('本地保存')).toBeInTheDocument();
    const entryList = screen.getByRole('list', { name: '收藏条目' });
    expect(within(entryList).getByText('#note')).toBeInTheDocument();
    expect(within(entryList).getByText('#Note')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: '#note' })).toHaveLength(1);
    expect(screen.getAllByRole('checkbox', { name: '#Note' })).toHaveLength(1);
    const contentToggle = screen.getByRole('button', { name: '管理内容标签' });
    if (contentToggle.getAttribute('aria-expanded') !== 'true') await user.click(contentToggle);
    const contentManager = screen.getByRole('region', { name: '内容标签管理' });
    expect(within(contentManager).getAllByText('#Note')).toHaveLength(1);
    expect(within(contentManager).getAllByText('#note')).toHaveLength(1);
    // #Note and #note are separate records, one for each stable ID.
    if (!edited) {
      const imported = screen.getByText('来自备份').closest('li')!;
      await user.click(within(imported).getByRole('button', { name: '编辑' }));
      await user.clear(screen.getByLabelText('作者'));
      await user.type(screen.getByLabelText('作者'), '本地修改');
      await user.click(screen.getByRole('button', { name: '保存修改' }));
      await screen.findByText('本地修改');
    }
  }
});

it('rejects backups with broken references even when their checksum matches', async () => {
  const user = userSetup();
  const captured = captureDownload();
  openApp();
  await screen.findByRole('heading', { name: 'Home' });
  await addAuthor(user, '仍然保留');
  const original = await download(user, captured);
  const backup = JSON.parse(await original.text());
  backup.data.entry_folders[0].folder_id = 'missing-folder';
  backup.sha256 = createHash('sha256').update(JSON.stringify(backup.data)).digest('hex');
  const damaged = new File([JSON.stringify(backup)], 'damaged.json', { type: 'application/json' });

  await user.upload(screen.getByLabelText('备份文件'), damaged);
  await user.click(screen.getByRole('button', { name: '合并导入' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('备份数据不完整或已损坏。');
  const after = await download(user, captured);
  expect(await after.text()).toBe(await original.text());
});

it('replaces the entire local state only after confirmation and restores a deleted collection group', async () => {
  const user = userSetup();
  const captured = captureDownload();
  const clock = () => new Date('2026-07-10T12:00:00Z');
  const source = openApp({ now: clock });
  await createFolder(user, 'Home', '原收藏夹');
  await createFolder(user, '原收藏夹', '原子收藏夹');
  await user.click(screen.getByRole('button', { name: '全部条目' }));
  await user.click(screen.getByRole('checkbox', { name: 'Home / 原收藏夹 / 原子收藏夹' }));
  await user.selectOptions(screen.getByLabelText('平台标签'), '小红书');
  await addAuthor(user, '回收站里的作者', undefined, '#可恢复');
  await user.click(screen.getByRole('button', { name: '原收藏夹' }));
  await user.click(await screen.findByRole('button', { name: '删除收藏夹' }));
  const deletion = screen.getByRole('dialog');
  await user.click(within(deletion).getByRole('radio', { name: /移到回收站/ }));
  await user.click(within(deletion).getByRole('button', { name: '删除' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '原收藏夹' })).not.toBeInTheDocument(),
  );
  await addAuthor(user, '备份中的作者');
  await openSettings(user);
  await user.click(screen.getByRole('radio', { name: '浅色' }));
  await user.click(screen.getByRole('checkbox', { name: '启用元数据识别' }));
  await user.click(screen.getByRole('button', { name: '保存偏好' }));
  await screen.findByText('偏好已保存。');
  const file = await download(user, captured);
  source.unmount();

  const target = openApp({ now: clock });
  await createFolder(user, 'Home', '本地收藏夹');
  await addAuthor(user, '本地作者');
  await addAuthor(user, '本地回收站作者');
  await user.click(screen.getByRole('button', { name: '删除 本地回收站作者' }));
  await waitFor(() => expect(screen.queryByText('本地回收站作者')).not.toBeInTheDocument());
  const before = await download(user, captured);
  await user.upload(screen.getByLabelText('备份文件'), file);
  await user.click(screen.getByRole('button', { name: '替换导入' }));
  const confirm = await screen.findByRole('dialog', { name: '替换本机数据？' });
  expect(within(confirm).getByText(/设置和回收站/)).toBeInTheDocument();
  await user.click(within(confirm).getByRole('button', { name: '取消' }));
  const cancelled = await download(user, captured);
  expect(await cancelled.text()).toBe(await before.text());

  await user.click(screen.getByRole('button', { name: '替换导入' }));
  await user.click(await screen.findByRole('button', { name: '确认替换' }));
  await screen.findByText('本机数据已替换。');
  expect(screen.getByRole('radio', { name: '浅色' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '启用元数据识别' })).not.toBeChecked();
  expect(screen.queryByRole('button', { name: '本地收藏夹' })).not.toBeInTheDocument();
  const restored = await download(user, captured);
  expect(await restored.text()).toBe(await file.text());

  target.unmount();
  target.close();
  openApp({ databasePath: target.databasePath, directory: target.directory, now: clock });
  expect(await screen.findByText('备份中的作者')).toBeInTheDocument();
  expect(screen.queryByText('本地作者')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '回收站' }));
  expect(await screen.findByText('剩余 30 天')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '恢复 原收藏夹' }));
  await user.click(await screen.findByRole('button', { name: '原子收藏夹' }));
  const entry = (await screen.findByText('回收站里的作者')).closest('li')!;
  expect(within(entry).getByText('Home · Home / 原收藏夹 / 原子收藏夹')).toBeInTheDocument();
  expect(within(entry).getByText('#可恢复')).toBeInTheDocument();
  expect(within(entry).getByText('小红书')).toBeInTheDocument();
});

it('opens platform label management and trash cleanup from settings', async () => {
  const user = userSetup();
  openApp();
  await screen.findByRole('heading', { name: 'Home' });
  await addAuthor(user, '待清理的作者');
  await user.click(screen.getByRole('button', { name: '删除 待清理的作者' }));
  await waitFor(() => expect(screen.queryByText('待清理的作者')).not.toBeInTheDocument());
  await openSettings(user);
  await user.click(screen.getByRole('button', { name: '管理平台标签' }));
  await user.type(screen.getByLabelText('新平台标签'), '新平台');
  await user.click(screen.getByRole('button', { name: '添加平台标签' }));
  expect(await screen.findByRole('button', { name: '重命名 新平台' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '管理回收站' }));
  await screen.findByRole('heading', { name: '回收站' });
  expect(await screen.findByText('剩余 30 天')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '立即清空回收站' }));
  const confirm = screen.getByRole('dialog');
  await user.click(within(confirm).getByRole('button', { name: '清空回收站' }));
  expect(await screen.findByText('回收站是空的。')).toBeInTheDocument();
});

it('rejects malformed JSON, future versions, and checksum failures without offering to replace', async () => {
  const user = userSetup();
  const captured = captureDownload();
  openApp();
  await screen.findByRole('heading', { name: 'Home' });
  await addAuthor(user, '当前作者');
  const original = await download(user, captured);
  const backup = JSON.parse(await original.text());
  const invalidFiles = [
    ['{ "format":', '文件格式无效'],
    [JSON.stringify({ ...backup, version: 999 }), '此备份版本不受支持。'],
    [
      JSON.stringify({ ...backup, data: { ...backup.data, entries: [] } }),
      '备份数据不完整或已损坏。',
    ],
    [JSON.stringify({ ...backup, data: { ...backup.data, trash_groups: null } }), '文件格式无效'],
  ] as const;
  for (const [contents, message] of invalidFiles) {
    await user.upload(
      screen.getByLabelText('备份文件'),
      new File([contents], 'invalid.json', { type: 'application/json' }),
    );
    await user.click(screen.getByRole('button', { name: '替换导入' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
  expect(await (await download(user, captured)).text()).toBe(await original.text());
});
