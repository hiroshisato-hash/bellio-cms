'use client'

import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Handle,
  Position,
  MarkerType,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

type Category = { id: string; name: string }
type FAQ = { id: string; question: string; answer: string; category_id: string | null }

// ---- カスタムノード ----

function StartNode() {
  return (
    <div className="bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-lg text-center min-w-[140px]">
      <div className="text-lg mb-0.5">📞</div>
      <div className="font-bold text-sm">電話着信</div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400 !w-3 !h-3" />
    </div>
  )
}

function CategoryNode({ data }: { data: { label: string } }) {
  return (
    <div className="bg-white border-2 border-yellow-400 rounded-2xl shadow-md px-4 py-3 min-w-[160px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-yellow-400 !w-3 !h-3" />
      <div className="text-xs text-slate-400 mb-0.5">大カテゴリ</div>
      <div className="font-bold text-slate-800 text-sm">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400 !w-3 !h-3" />
    </div>
  )
}

function FaqNode({ data }: { data: { question: string; answer: string } }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3" />
      <div className="text-xs text-blue-500 font-medium mb-0.5">FAQ回答</div>
      <div className="text-xs font-semibold text-slate-700 mb-1 line-clamp-2">Q: {data.question}</div>
      <div className="text-xs text-slate-500 line-clamp-2">A: {data.answer}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3" />
    </div>
  )
}

function CallbackNode() {
  return (
    <div className="bg-green-50 border border-green-300 rounded-2xl shadow-sm px-5 py-3 min-w-[140px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-green-400 !w-3 !h-3" />
      <div className="text-lg mb-0.5">🔔</div>
      <div className="font-bold text-slate-700 text-sm">折り返し受付</div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3" />
    </div>
  )
}

function EndNode() {
  return (
    <div className="bg-slate-100 border border-slate-300 rounded-2xl shadow-sm px-5 py-3 min-w-[140px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />
      <div className="text-lg mb-0.5">👋</div>
      <div className="font-bold text-slate-500 text-sm">通話終了</div>
    </div>
  )
}

const nodeTypes = {
  start: StartNode,
  category: CategoryNode,
  faq: FaqNode,
  callback: CallbackNode,
  end: EndNode,
}

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  style: { stroke: '#94a3b8', strokeWidth: 2 },
}

// ---- メインコンポーネント ----

function buildInitialNodes(categories: Category[], faqs: FAQ[]): Node[] {
  const nodes: Node[] = [
    { id: 'start', type: 'start', position: { x: 300, y: 20 }, data: {} },
  ]

  const catSpacing = 220
  const catStartX = 300 - ((categories.length - 1) * catSpacing) / 2

  categories.forEach((cat, i) => {
    nodes.push({
      id: `cat-${cat.id}`,
      type: 'category',
      position: { x: catStartX + i * catSpacing, y: 160 },
      data: { label: cat.name },
    })

    const catFaqs = faqs.filter(f => f.category_id === cat.id)
    catFaqs.forEach((faq, j) => {
      nodes.push({
        id: `faq-${faq.id}`,
        type: 'faq',
        position: { x: catStartX + i * catSpacing - 20, y: 320 + j * 160 },
        data: { question: faq.question, answer: faq.answer },
      })
    })
  })

  nodes.push({ id: 'callback', type: 'callback', position: { x: catStartX + categories.length * catSpacing, y: 160 }, data: {} })
  nodes.push({ id: 'end', type: 'end', position: { x: 300, y: 500 }, data: {} })

  return nodes
}

function buildInitialEdges(categories: Category[], faqs: FAQ[]): Edge[] {
  const edges: Edge[] = []
  categories.forEach(cat => {
    edges.push({
      id: `start-cat-${cat.id}`,
      source: 'start',
      target: `cat-${cat.id}`,
      label: cat.name,
      labelStyle: { fontSize: 11, fill: '#64748b' },
      ...defaultEdgeOptions,
    })
    const catFaqs = faqs.filter(f => f.category_id === cat.id)
    catFaqs.forEach(faq => {
      edges.push({
        id: `cat-faq-${cat.id}-${faq.id}`,
        source: `cat-${cat.id}`,
        target: `faq-${faq.id}`,
        ...defaultEdgeOptions,
      })
      edges.push({
        id: `faq-end-${faq.id}`,
        source: `faq-${faq.id}`,
        target: 'end',
        style: { stroke: '#cbd5e1', strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
      })
    })
  })
  edges.push({
    id: 'start-callback',
    source: 'start',
    target: 'callback',
    label: 'その他',
    labelStyle: { fontSize: 11, fill: '#64748b' },
    ...defaultEdgeOptions,
  })
  edges.push({
    id: 'callback-end',
    source: 'callback',
    target: 'end',
    style: { stroke: '#cbd5e1', strokeDasharray: '4 3' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
  })
  return edges
}

export default function FlowBuilder({
  tenantId,
  categories,
  faqs,
  savedFlow,
}: {
  tenantId: string
  categories: Category[]
  faqs: FAQ[]
  savedFlow: { nodes: Node[]; edges: Edge[] } | null
}) {
  const initNodes = savedFlow?.nodes?.length
    ? savedFlow.nodes
    : buildInitialNodes(categories, faqs)
  const initEdges = savedFlow?.edges?.length
    ? savedFlow.edges
    : buildInitialEdges(categories, faqs)

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges],
  )

  async function handleSave() {
    setSaving(true)
    await fetch('/api/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, flowJson: { nodes, edges } }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    if (!confirm('フローをFAQ/カテゴリ構成から再生成しますか？現在の配置は失われます。')) return
    setNodes(buildInitialNodes(categories, faqs))
    setEdges(buildInitialEdges(categories, faqs))
  }

  return (
    <div className="h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={n => {
            if (n.type === 'start') return '#1e293b'
            if (n.type === 'category') return '#facc15'
            if (n.type === 'faq') return '#93c5fd'
            if (n.type === 'callback') return '#86efac'
            return '#e2e8f0'
          }}
          className="rounded-lg"
        />

        <Panel position="top-right" className="flex gap-2">
          <button
            onClick={handleReset}
            className="bg-white border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition"
          >
            再生成
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存'}
          </button>
        </Panel>

        <Panel position="top-left">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 text-xs text-slate-500 flex flex-col gap-1.5">
            <p className="font-semibold text-slate-700 mb-0.5">凡例</p>
            <LegendItem color="bg-slate-800" label="電話着信（スタート）" />
            <LegendItem color="bg-yellow-400" label="大カテゴリ選択" />
            <LegendItem color="bg-blue-200" label="FAQ回答" />
            <LegendItem color="bg-green-200" label="折り返し受付" />
            <LegendItem color="bg-slate-200" label="通話終了" />
            <p className="text-slate-400 mt-1">ノードをドラッグして配置変更<br/>接続点をドラッグして分岐追加<br/>Deleteキーで削除</p>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color} shrink-0`} />
      <span>{label}</span>
    </div>
  )
}
