import type { FolderNode } from '../domain/collection';

export type FolderTreeProps = {
  nodes: readonly FolderNode[];
  selectedId: string | null;
  onSelect: (folderId: string) => void;
};

/** The sidebar's nested collection links, one nested `<ul>` per level. */
export function FolderTree({ nodes, selectedId, onSelect }: FolderTreeProps) {
  return (
    <ul className="folder-list">
      {nodes.map((node) => (
        <FolderTreeItem
          key={node.folder.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

type FolderTreeItemProps = Omit<FolderTreeProps, 'nodes'> & { node: FolderNode };

function FolderTreeItem({ node, selectedId, onSelect }: FolderTreeItemProps) {
  return (
    <li>
      <button
        type="button"
        className="nav-item"
        aria-current={selectedId === node.folder.id ? 'page' : undefined}
        onClick={() => onSelect(node.folder.id)}
      >
        {node.folder.name}
      </button>
      {node.children.length > 0 && (
        <FolderTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} />
      )}
    </li>
  );
}
