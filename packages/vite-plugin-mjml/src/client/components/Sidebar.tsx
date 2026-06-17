import { useState } from 'preact/hooks'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

interface FileLeaf {
  name: string
  path: string
}

interface TreeNodeData {
  name: string
  children: TreeNodeData[]
  files: FileLeaf[]
}

type SelectFile = (path: string) => void

function buildTree(files: string[]): TreeNodeData {
  const root: TreeNodeData = { name: '', children: [], files: [] }

  for (const file of files) {
    const parts = file.split('/')
    let current = root

    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        current.files.push({ name: part, path: file })
      } else {
        let child = current.children.find((c) => c.name === part)
        if (!child) {
          child = { name: part, children: [], files: [] }
          current.children.push(child)
        }
        current = child
      }
    })
  }

  return root
}

function FileIcon() {
  return (
    <svg
      class="w-5 h-5 shrink-0 text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    >
      <path
        d="M7.75 19.25H16.25C17.3546 19.25 18.25 18.3546 18.25 17.25V9L14 4.75H7.75C6.64543 4.75 5.75 5.64543 5.75 6.75V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25Z"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M18 9.25H13.75V5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        class="w-4 h-4 shrink-0 text-accent"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M19.5 21a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.379a.75.75 0 0 1-.53-.22L11.47 3.66A2.25 2.25 0 0 0 9.879 3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15ZM9 12.75a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5H9Z"
          clip-rule="evenodd"
        />
      </svg>
    )
  }
  return (
    <svg
      class="w-4 h-4 shrink-0 text-accent"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M19.5 21a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.379a.75.75 0 0 1-.53-.22L11.47 3.66A2.25 2.25 0 0 0 9.879 3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15Zm-6.75-10.5a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V10.5Z"
        clip-rule="evenodd"
      />
    </svg>
  )
}

function TreeNode({
  node,
  currentFile,
  onSelectFile,
  depth = 0,
}: {
  node: TreeNodeData
  currentFile: string | null
  onSelectFile: SelectFile
  depth?: number
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0 || node.files.length > 0

  return (
    <div class={depth > 0 ? 'relative' : ''}>
      {node.name && (
        <button
          type="button"
          class="flex items-center gap-2 py-1.5 px-2 w-full text-left text-sm hover:text-fg-strong transition-colors duration-150"
          onClick={() => setOpen(!open)}
        >
          <FolderIcon open={open} />
          <span class="truncate font-medium">{node.name}</span>
        </button>
      )}

      {(open || !node.name) && hasChildren && (
        <div class={node.name ? 'ml-2 pl-3 border-l border-line' : ''}>
          {node.children.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              currentFile={currentFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
          {node.files.map((file) => {
            const isActive = currentFile === file.path
            return (
              <button
                type="button"
                key={file.path}
                class={`group flex items-center gap-2 py-1.5 px-2 w-full text-left text-sm rounded-md transition-all duration-150 relative ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'hover:bg-subtle hover:text-fg-strong'
                }`}
                onClick={() => onSelectFile(file.path)}
              >
                {isActive && (
                  <span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
                )}
                <FileIcon />
                <span class="truncate">{file.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  files,
  currentFile,
  onSelectFile,
}: {
  files: string[]
  currentFile: string | null
  onSelectFile: SelectFile
}) {
  const tree = buildTree(files)

  return (
    <aside class="w-72 shrink-0 border-r border-line flex flex-col bg-panel">
      <div class="p-5 border-b border-line flex items-center justify-between gap-3">
        <div class="flex items-baseline gap-2 min-w-0">
          <Logo class="text-2xl" />
          <span class="text-sm font-medium text-muted">Preview</span>
        </div>
        <ThemeToggle />
      </div>
      <nav class="flex-1 overflow-auto p-3">
        <TreeNode
          node={tree}
          currentFile={currentFile}
          onSelectFile={onSelectFile}
        />
      </nav>
    </aside>
  )
}
