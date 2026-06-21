'use client'

import { useCallback, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
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

// voice 側の CallState と一致させる（紐付け可能なステート）
// FAQ_ANSWERING は DB回答を使うため除外
const STATE_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'GREETING',                 label: '最初の挨拶',          hint: '着信して最初に話す内容' },
  { key: 'INTENT_HEARING',           label: '用件の聞き直し',      hint: '用件がうまく取れなかった時' },
  { key: 'SATISFACTION_CHECK',       label: '解決確認',            hint: 'FAQ回答後「他にありますか？」' },
  { key: 'CALLBACK_INTAKE_NAME',     label: 'お名前を尋ねる',      hint: '折り返しの名前ヒアリング' },
  { key: 'CALLBACK_INTAKE_EMPLOYEE', label: '担当者を尋ねる',      hint: '指名担当者のヒアリング' },
  { key: 'CALLBACK_INTAKE_TIME',     label: '希望時間を尋ねる',    hint: '折り返し希望時間のヒアリング' },
  { key: 'CALLBACK_CONFIRM',         label: '折り返し内容の復唱',  hint: '{{name}}様、{{employee}}より{{time}}に…' },
  { key: 'URGENT_ALERT',             label: '緊急対応',            hint: '緊急キーワード検知時' },
  { key: 'END',                      label: '終話',                hint: '通話を終える時の挨拶' },
  { key: 'FALLBACK',                 label: '聞き取れない時',      hint: '「もう一度お願いします」' },
]

const STATE_LABEL: Record<string, string> = Object.fromEntries(
  STATE_OPTIONS.map(o => [o.key, o.label]),
)

// パレット（ドラッグして追加できるノード種別）
const PALETTE: { kind: string; label: string; icon: string; desc: string; group: string }[] = [
  { kind: 'message',   label: 'メッセージ',  icon: '💬', desc: 'AIが話す内容',       group: '発話' },
  { kind: 'branch',    label: '条件分岐',    icon: '🔀', desc: '発言で枝分かれ',     group: '分岐' },
  { kind: 'faqLookup', label: 'FAQ検索',     icon: '🔎', desc: 'ヒット/ミスで分岐',  group: '分岐' },
  { kind: 'callback',  label: '折り返し受付', icon: '🔔', desc: '項目を聞いて登録',   group: 'アクション' },
  { kind: 'notify',    label: '通知',        icon: '📢', desc: '担当者へSlack通知',  group: 'アクション' },
  { kind: 'sms',       label: 'SMS送信',     icon: '📨', desc: '発信者へSMS',        group: 'アクション' },
  { kind: 'end',       label: '通話終了',    icon: '👋', desc: '通話を終える',       group: '終了' },
]

// アクションノード（通知/SMS）
const ACTION_KINDS = new Set(['notify', 'sms'])
// グラフ駆動ノード（分岐系）
const GRAPH_KINDS = new Set(['branch', 'faqLookup', 'collect'])

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

// 汎用「メッセージ」ノード（発話文＋ステート紐付け表示）
function MessageNode({ data }: { data: { label?: string; message?: string; stateKey?: string } }) {
  return (
    <div className="bg-white border border-slate-300 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">💬</span>
        <span className="text-xs font-semibold text-slate-700">{data.label || 'メッセージ'}</span>
      </div>
      {data.stateKey && (
        <div className="inline-block text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded mb-1">
          {STATE_LABEL[data.stateKey] ?? data.stateKey}
        </div>
      )}
      <div className="text-xs text-slate-500 line-clamp-3">
        {data.message ? `「${data.message}」` : <span className="text-slate-300">（発話文 未設定）</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3" />
    </div>
  )
}

function CallbackNode({ data }: { data: { message?: string; askCompany?: boolean; askName?: boolean; askRecipient?: boolean } }) {
  const items = [
    data.askCompany && '会社名',
    data.askName && 'お名前',
    data.askRecipient && '宛先',
    '電話番号',
  ].filter(Boolean) as string[]
  return (
    <div className="bg-green-50 border border-green-300 rounded-2xl shadow-sm px-5 py-3 min-w-[140px] max-w-[240px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-green-400 !w-3 !h-3" />
      <div className="text-lg mb-0.5">🔔</div>
      <div className="font-bold text-slate-700 text-sm">折り返し受付</div>
      <div className="text-[10px] text-green-700 mt-1">聞く: {items.join('・')}</div>
      {data.message && <div className="text-xs text-slate-500 line-clamp-2 mt-1">「{data.message}」</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3" />
    </div>
  )
}

function EndNode({ data }: { data: { message?: string } }) {
  return (
    <div className="bg-slate-100 border border-slate-300 rounded-2xl shadow-sm px-5 py-3 min-w-[140px] max-w-[240px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3" />
      <div className="text-lg mb-0.5">👋</div>
      <div className="font-bold text-slate-500 text-sm">通話終了</div>
      {data.message && <div className="text-xs text-slate-500 line-clamp-2 mt-1">「{data.message}」</div>}
    </div>
  )
}

// 通知ノード（担当者へSlack通知）
function NotifyNode({ data }: { data: { message?: string; stateKey?: string } }) {
  return (
    <div className="bg-orange-50 border border-orange-300 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-orange-400 !w-3 !h-3" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">📢</span>
        <span className="text-xs font-semibold text-orange-700">通知（Slack）</span>
      </div>
      {data.stateKey && (
        <div className="inline-block text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded mb-1">
          {STATE_LABEL[data.stateKey] ?? data.stateKey} で発火
        </div>
      )}
      <div className="text-xs text-slate-500 line-clamp-2">
        {data.message ? data.message : <span className="text-slate-300">（通知文 未設定）</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400 !w-3 !h-3" />
    </div>
  )
}

// SMS送信ノード（発信者へSMS）
function SmsNode({ data }: { data: { message?: string; stateKey?: string } }) {
  return (
    <div className="bg-sky-50 border border-sky-300 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-sky-400 !w-3 !h-3" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">📨</span>
        <span className="text-xs font-semibold text-sky-700">SMS送信</span>
      </div>
      {data.stateKey && (
        <div className="inline-block text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded mb-1">
          {STATE_LABEL[data.stateKey] ?? data.stateKey} で送信
        </div>
      )}
      <div className="text-xs text-slate-500 line-clamp-2">
        {data.message ? data.message : <span className="text-slate-300">（本文 未設定）</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-400 !w-3 !h-3" />
    </div>
  )
}

// 条件分岐ノード
function BranchNode({ data }: { data: { message?: string } }) {
  return (
    <div className="bg-violet-50 border-2 border-violet-400 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !w-3 !h-3" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">🔀</span>
        <span className="text-xs font-semibold text-violet-700">条件分岐</span>
      </div>
      <div className="text-xs text-slate-600 line-clamp-2">
        {data.message ? `「${data.message}」` : <span className="text-slate-300">（質問文 未設定）</span>}
      </div>
      <p className="text-[10px] text-violet-400 mt-1">出口の線にキーワードを設定</p>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !w-3 !h-3" />
    </div>
  )
}

// FAQ検索ノード
function FaqLookupNode({ data }: { data: { message?: string } }) {
  return (
    <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">🔎</span>
        <span className="text-xs font-semibold text-blue-700">FAQ検索</span>
      </div>
      <div className="text-xs text-slate-600 line-clamp-2">
        {data.message ? `「${data.message}」` : <span className="text-slate-300">（聞き出し文 未設定）</span>}
      </div>
      <p className="text-[10px] text-blue-400 mt-1">出口の線をヒット/ミスに設定</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3" />
    </div>
  )
}

// スロット収集ノード
function CollectNode({ data }: { data: { message?: string; variable?: string } }) {
  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm px-4 py-3 max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-3 !h-3" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">🎙️</span>
        <span className="text-xs font-semibold text-amber-700">スロット収集</span>
      </div>
      <div className="text-xs text-slate-600 line-clamp-2">
        {data.message ? `「${data.message}」` : <span className="text-slate-300">（質問文 未設定）</span>}
      </div>
      {data.variable && (
        <div className="inline-block text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded mt-1">
          → {`{{${data.variable}}}`}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-3 !h-3" />
    </div>
  )
}

const nodeTypes = {
  start: StartNode,
  category: CategoryNode,
  faq: FaqNode,
  message: MessageNode,
  branch: BranchNode,
  faqLookup: FaqLookupNode,
  collect: CollectNode,
  callback: CallbackNode,
  notify: NotifyNode,
  sms: SmsNode,
  end: EndNode,
}

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  style: { stroke: '#94a3b8', strokeWidth: 2 },
}

// ---- 自動生成（カテゴリ/FAQから初期フロー） ----

function buildInitialNodes(categories: Category[], faqs: FAQ[]): Node[] {
  const nodes: Node[] = [
    { id: 'start', type: 'start', position: { x: 300, y: 20 }, data: { stateKey: 'GREETING', message: '' } },
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

  nodes.push({
    id: 'callback',
    type: 'callback',
    position: { x: catStartX + categories.length * catSpacing, y: 160 },
    data: { stateKey: 'CALLBACK_INTAKE_NAME', message: '' },
  })
  nodes.push({
    id: 'end',
    type: 'end',
    position: { x: 300, y: 500 },
    data: { stateKey: 'END', message: '' },
  })

  return nodes
}

function buildInitialEdges(categories: Category[], faqs: FAQ[]): Edge[] {
  const edges: Edge[] = []
  categories.forEach(cat => {
    edges.push({
      id: `start-cat-${cat.id}`, source: 'start', target: `cat-${cat.id}`,
      label: cat.name, labelStyle: { fontSize: 11, fill: '#64748b' }, ...defaultEdgeOptions,
    })
    faqs.filter(f => f.category_id === cat.id).forEach(faq => {
      edges.push({ id: `cat-faq-${cat.id}-${faq.id}`, source: `cat-${cat.id}`, target: `faq-${faq.id}`, ...defaultEdgeOptions })
      edges.push({
        id: `faq-end-${faq.id}`, source: `faq-${faq.id}`, target: 'end',
        style: { stroke: '#cbd5e1', strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
      })
    })
  })
  edges.push({
    id: 'start-callback', source: 'start', target: 'callback',
    label: 'その他', labelStyle: { fontSize: 11, fill: '#64748b' }, ...defaultEdgeOptions,
  })
  edges.push({
    id: 'callback-end', source: 'callback', target: 'end',
    style: { stroke: '#cbd5e1', strokeDasharray: '4 3' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
  })
  return edges
}

// ============================================================
// 内部コンポーネント（ReactFlowProvider 配下）
// ============================================================

function FlowCanvas({
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
  const initNodes = savedFlow?.nodes?.length ? savedFlow.nodes : buildInitialNodes(categories, faqs)
  const initEdges = savedFlow?.edges?.length ? savedFlow.edges : buildInitialEdges(categories, faqs)

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const idCounter = useRef(0)

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  const selectedEdge = useMemo(
    () => edges.find(e => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  )

  // 選択エッジの起点ノード種別（分岐/FAQで条件UIを出し分け）
  const selectedEdgeSourceType = useMemo(() => {
    if (!selectedEdge) return null
    return nodes.find(n => n.id === selectedEdge.source)?.type ?? null
  }, [selectedEdge, nodes])

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges],
  )

  // パレットからドラッグ開始
  function onPaletteDragStart(e: React.DragEvent, kind: string) {
    e.dataTransfer.setData('application/bellio-node', kind)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const kind = e.dataTransfer.getData('application/bellio-node')
      if (!kind) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      idCounter.current += 1
      const id = `n-${Date.now()}-${idCounter.current}`
      const defaults: Record<string, Record<string, unknown>> = {
        message:   { label: 'メッセージ', message: '', stateKey: '' },
        branch:    { message: '' },
        faqLookup: { message: 'ご用件をお聞かせください。' },
        callback:  { message: '', askName: true, askCompany: false, askRecipient: false },
        notify:    { message: '', stateKey: 'CALLBACK_CONFIRM' },
        sms:       { message: '', stateKey: 'CALLBACK_CONFIRM' },
        end:       { stateKey: 'END', message: '' },
      }
      const newNode: Node = {
        id, type: kind, position,
        data: defaults[kind] ?? {},
      }
      setNodes(nds => nds.concat(newNode))
      setSelectedId(id)
    },
    [screenToFlowPosition, setNodes],
  )

  // 選択ノードの data を更新
  function updateSelected(patch: Record<string, unknown>) {
    if (!selectedId) return
    setNodes(nds =>
      nds.map(n => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)),
    )
  }

  // 選択エッジの data を更新（条件・ラベル）
  function updateSelectedEdge(patch: Record<string, unknown>, label?: string) {
    if (!selectedEdgeId) return
    setEdges(eds =>
      eds.map(e =>
        e.id === selectedEdgeId
          ? {
              ...e,
              data: { ...e.data, ...patch },
              ...(label !== undefined ? { label } : {}),
              labelStyle: { fontSize: 11, fill: '#7c3aed', fontWeight: 600 },
            }
          : e,
      ),
    )
  }

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
    if (!confirm('フローをFAQ/カテゴリ構成から再生成しますか？現在の配置・発話文は失われます。')) return
    setNodes(buildInitialNodes(categories, faqs))
    setEdges(buildInitialEdges(categories, faqs))
    setSelectedId(null)
  }

  // 発話文を編集できるノード種別か
  const editable = selectedNode && ['message', 'callback', 'end', 'start'].includes(selectedNode.type ?? '')

  return (
    <div className="flex gap-3 h-[calc(100vh-9rem)]">
      {/* パレット */}
      <div className="w-44 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-700 mb-1">ノードを追加</p>
        <p className="text-[10px] text-slate-400 mb-2">下のブロックをキャンバスにドラッグ＆ドロップ</p>
        {['発話', '分岐', 'アクション', '終了'].map(group => (
          <div key={group} className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-slate-400 mt-1">{group}</p>
            {PALETTE.filter(p => p.group === group).map(p => (
              <div
                key={p.kind}
                draggable
                onDragStart={e => onPaletteDragStart(e, p.kind)}
                className="cursor-grab active:cursor-grabbing border border-slate-200 rounded-xl px-3 py-2 hover:border-yellow-400 hover:bg-yellow-50 transition select-none"
              >
                <div className="flex items-center gap-2">
                  <span>{p.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{p.label}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
              </div>
            ))}
          </div>
        ))}

        <div className="mt-auto pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
          ・ノードをドラッグで移動<br />
          ・接続点を引っ張って分岐<br />
          ・選択して <kbd className="bg-slate-100 px-1 rounded">Delete</kbd> で削除
        </div>
      </div>

      {/* キャンバス */}
      <div ref={wrapperRef} className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={({ nodes: sel, edges: selE }) => {
            setSelectedId(sel[0]?.id ?? null)
            setSelectedEdgeId(selE[0]?.id ?? null)
          }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={n => {
              if (n.type === 'start') return '#1e293b'
              if (n.type === 'category') return '#facc15'
              if (n.type === 'faq') return '#93c5fd'
              if (n.type === 'callback') return '#86efac'
              if (n.type === 'notify') return '#fdba74'
              if (n.type === 'sms') return '#7dd3fc'
              if (n.type === 'branch') return '#a78bfa'
              if (n.type === 'faqLookup') return '#60a5fa'
              if (n.type === 'collect') return '#fbbf24'
              if (n.type === 'message') return '#cbd5e1'
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
        </ReactFlow>
      </div>

      {/* ノード/エッジ編集パネル */}
      <div className="w-72 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-auto">
        {selectedEdge ? (
          <EdgeEditor
            sourceType={selectedEdgeSourceType}
            edge={selectedEdge}
            onUpdate={updateSelectedEdge}
          />
        ) : !selectedNode ? (
          <p className="text-slate-400 text-sm text-center py-12">
            ノードや線（エッジ）を選択すると<br />ここで内容を編集できます
          </p>
        ) : GRAPH_KINDS.has(selectedNode.type ?? '') ? (
          <GraphNodeEditor node={selectedNode} onUpdate={updateSelected} />
        ) : selectedNode.type === 'callback' ? (
          <CallbackNodeEditor node={selectedNode} onUpdate={updateSelected} />
        ) : selectedNode.type === 'faq' ? (
          <div>
            <h3 className="font-semibold text-slate-700 mb-2 text-sm">FAQ回答ノード</h3>
            <p className="text-xs text-slate-500 mb-1">Q: {(selectedNode.data as { question?: string }).question}</p>
            <p className="text-xs text-slate-500">A: {(selectedNode.data as { answer?: string }).answer}</p>
            <p className="text-[11px] text-slate-400 mt-3">
              FAQの回答文は「FAQ管理」画面で編集してください。通話では意味検索で該当FAQが自動選択されます。
            </p>
          </div>
        ) : selectedNode.type === 'category' ? (
          <div>
            <h3 className="font-semibold text-slate-700 mb-2 text-sm">大カテゴリノード</h3>
            <p className="text-xs text-slate-500">{(selectedNode.data as { label?: string }).label}</p>
            <p className="text-[11px] text-slate-400 mt-3">
              カテゴリ名は「FAQ管理」画面で編集してください。
            </p>
          </div>
        ) : ACTION_KINDS.has(selectedNode.type ?? '') ? (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-slate-700 text-sm">
              {selectedNode.type === 'notify' ? '📢 通知ノード' : '📨 SMS送信ノード'}
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {selectedNode.type === 'notify'
                ? '指定した場面に到達した時、担当者のSlackへ通知します。'
                : '指定した場面に到達した時、発信者の電話番号へSMSを送ります。'}
            </p>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                {selectedNode.type === 'notify' ? '通知する場面（ステート）' : '送信する場面（ステート）'}
              </label>
              <select
                value={(selectedNode.data as { stateKey?: string }).stateKey ?? ''}
                onChange={e => updateSelected({ stateKey: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">（紐付けなし＝発火しない）</option>
                {STATE_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                例：「折り返し内容の復唱」に紐付けると、折り返し受付が完了した瞬間に発火します。
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                {selectedNode.type === 'notify' ? '通知の本文' : 'SMSの本文'}
              </label>
              <textarea
                value={(selectedNode.data as { message?: string }).message ?? ''}
                onChange={e => updateSelected({ message: e.target.value })}
                rows={5}
                placeholder={selectedNode.type === 'notify'
                  ? '例：📞 {{name}}様より折り返し依頼が入りました。'
                  : '例：{{company}}です。ご予約はこちら→ https://...'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                使える差し込み: <code className="bg-slate-100 px-1 rounded">{'{{company}}'}</code> 会社名 /{' '}
                <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code> お客様名 /{' '}
                <code className="bg-slate-100 px-1 rounded">{'{{employee}}'}</code> 担当者 /{' '}
                <code className="bg-slate-100 px-1 rounded">{'{{time}}'}</code> 折返し時間
              </p>
            </div>

            {selectedNode.type === 'notify' && (
              <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                通知先のSlack Webhookは「設定」画面の通知チャネルで設定してください。未設定の場合は送信されません。
              </p>
            )}
            {selectedNode.type === 'sms' && (
              <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                発信者の番号（携帯）宛にテナントの電話番号から送信します。固定電話発信にはSMSは届きません。
              </p>
            )}
          </div>
        ) : editable ? (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-slate-700 text-sm">
              {selectedNode.type === 'start' ? '電話着信ノード'
                : selectedNode.type === 'callback' ? '折り返し受付ノード'
                : selectedNode.type === 'end' ? '通話終了ノード'
                : 'メッセージノード'}
            </h3>

            {selectedNode.type === 'message' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">ラベル（管理用・通話では使われません）</label>
                <input
                  value={(selectedNode.data as { label?: string }).label ?? ''}
                  onChange={e => updateSelected({ label: e.target.value })}
                  placeholder="例：受付メッセージ"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">紐付ける場面（ステート）</label>
              <select
                value={(selectedNode.data as { stateKey?: string }).stateKey ?? ''}
                onChange={e => updateSelected({ stateKey: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">（紐付けなし）</option>
                {STATE_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {STATE_OPTIONS.find(o => o.key === (selectedNode.data as { stateKey?: string }).stateKey)?.hint
                  ?? 'この発話文をどの場面で使うか選びます'}
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">AIが話す内容</label>
              <textarea
                value={(selectedNode.data as { message?: string }).message ?? ''}
                onChange={e => updateSelected({ message: e.target.value })}
                rows={5}
                placeholder="例：お電話ありがとうございます。{{company}}でございます。ご用件をお伺いします。"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                使える差し込み: <code className="bg-slate-100 px-1 rounded">{'{{company}}'}</code> 会社名 /{' '}
                <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code> お客様名 /{' '}
                <code className="bg-slate-100 px-1 rounded">{'{{employee}}'}</code> 担当者 /{' '}
                <code className="bg-slate-100 px-1 rounded">{'{{time}}'}</code> 折返し時間
              </p>
            </div>

            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
              空欄の場合は既定の文言が使われます。「紐付ける場面」を選んで発話文を入れると、その場面でこの内容が読み上げられます。
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ============================================================
// 折り返し受付ノードの編集パネル（聞き取り項目のチェックボックス）
// ============================================================
function CallbackNodeEditor({
  node,
  onUpdate,
}: {
  node: Node
  onUpdate: (patch: Record<string, unknown>) => void
}) {
  const d = node.data as { message?: string; askCompany?: boolean; askName?: boolean; askRecipient?: boolean }
  const checks: { key: 'askCompany' | 'askName' | 'askRecipient'; label: string }[] = [
    { key: 'askCompany',   label: '会社名を聞く' },
    { key: 'askName',      label: 'お客様のお名前を聞く' },
    { key: 'askRecipient', label: '誰宛の連絡かを聞く' },
  ]
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold text-slate-700 text-sm">🔔 折り返し受付ノード</h3>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        折り返しの受付で、何をヒアリングするか選びます。チェックした項目を順番に聞き取ります。
      </p>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">導入のひとこと（任意）</label>
        <input
          value={d.message ?? ''}
          onChange={e => onUpdate({ message: e.target.value })}
          placeholder="例：折り返しのご連絡を承ります。"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-500">聞き取る項目</label>
        {checks.map(c => (
          <label key={c.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={d[c.key] ?? false}
              onChange={e => onUpdate({ [c.key]: e.target.checked })}
              className="accent-green-500"
            />
            {c.label}
          </label>
        ))}
        <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
          <input type="checkbox" checked disabled className="accent-slate-300" />
          お電話番号の確認（必須・常に確認）
        </div>
      </div>

      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">
        電話番号は「お電話番号は、ただいまお掛けのお電話番号でよろしいでしょうか。」と必ず確認します。聞き取った内容は折り返しキューに登録されます。
      </p>
    </div>
  )
}

// ============================================================
// グラフノード（分岐/FAQ検索/スロット収集）の編集パネル
// ============================================================
function GraphNodeEditor({
  node,
  onUpdate,
}: {
  node: Node
  onUpdate: (patch: Record<string, unknown>) => void
}) {
  const d = node.data as { message?: string; variable?: string; searchingMessage?: string }
  const kind = node.type

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold text-slate-700 text-sm">
        {kind === 'branch' ? '🔀 条件分岐ノード'
          : kind === 'faqLookup' ? '🔎 FAQ検索ノード'
          : '🎙️ スロット収集ノード'}
      </h3>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        {kind === 'branch'
          ? '質問を投げ、相手の発言で枝分かれします。各出口の線（エッジ）を選んでキーワードを設定してください。'
          : kind === 'faqLookup'
          ? '相手の発言でFAQを意味検索します。出口の線を「ヒット時」「ミス時」に設定してください。'
          : '相手の発言を聞き取り、変数に保存します。後のノードで {{変数名}} として差し込めます。'}
      </p>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">
          {kind === 'collect' ? '質問文（何を聞くか）' : kind === 'faqLookup' ? '聞き出し文' : '質問文'}
        </label>
        <textarea
          value={d.message ?? ''}
          onChange={e => onUpdate({ message: e.target.value })}
          rows={3}
          placeholder={kind === 'branch'
            ? '例：ご予約ですか、その他のお問い合わせですか？'
            : kind === 'faqLookup'
            ? '例：ご用件をお聞かせください。'
            : '例：お名前をお聞かせいただけますか？'}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
      </div>

      {kind === 'faqLookup' && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">検索中のひとこと（任意）</label>
          <input
            value={d.searchingMessage ?? ''}
            onChange={e => onUpdate({ searchingMessage: e.target.value })}
            placeholder="お調べしますので少々お待ちください。"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            FAQ検索には数秒かかります。検索中にこの一言を読み上げて間を埋めます。空欄なら「お調べしますので少々お待ちください。」
          </p>
        </div>
      )}

      {kind === 'collect' && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">保存先の変数名（英数字）</label>
          <input
            value={d.variable ?? ''}
            onChange={e => onUpdate({ variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
            placeholder="例：name / company / order_no"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            後のノードで <code className="bg-slate-100 px-1 rounded">{d.variable ? `{{${d.variable}}}` : '{{変数名}}'}</code> として使えます。
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        出口の線（エッジ）をクリックすると、条件を設定できます。
      </p>
    </div>
  )
}

// ============================================================
// エッジ（線）の条件編集パネル
// ============================================================
function EdgeEditor({
  sourceType,
  edge,
  onUpdate,
}: {
  sourceType: string | null
  edge: Edge
  onUpdate: (patch: Record<string, unknown>, label?: string) => void
}) {
  const data = (edge.data ?? {}) as { keywords?: string[]; keywordsText?: string; when?: string; isDefault?: boolean }

  // FAQ検索の出口: ヒット/ミス
  if (sourceType === 'faqLookup') {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-slate-700 text-sm">🔎 FAQ検索の出口</h3>
        <p className="text-[11px] text-slate-500">この線をどちらの結果に使うか選びます。</p>
        <div className="flex flex-col gap-2">
          {[
            { v: 'hit', label: '✅ ヒット時（FAQが見つかった）' },
            { v: 'miss', label: '❌ ミス時（見つからなかった）' },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => onUpdate({ when: o.v }, o.v === 'hit' ? 'ヒット' : 'ミス')}
              className={`text-left text-sm px-3 py-2 rounded-lg border transition ${
                data.when === o.v
                  ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 条件分岐の出口: キーワード or デフォルト
  if (sourceType === 'branch') {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-slate-700 text-sm">🔀 分岐の出口</h3>
        <p className="text-[11px] text-slate-500">
          相手の発言にこのキーワードが含まれていたら、この線へ進みます。
        </p>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">キーワード（カンマ「,」または「、」区切り・いずれか一致）</label>
          <input
            value={data.keywordsText ?? (data.keywords ?? []).join('、')}
            onChange={e => {
              const raw = e.target.value
              const kws = raw.split(/[,、]/).map(s => s.trim()).filter(Boolean)
              // 生テキスト(keywordsText)を保持して表示し、配列(keywords)はエンジン用に保存
              onUpdate({ keywordsText: raw, keywords: kws, isDefault: false }, kws.join(' / '))
            }}
            disabled={data.isDefault}
            placeholder="例：予約、よやく、取りたい"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:bg-slate-50 disabled:text-slate-300"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={data.isDefault ?? false}
            onChange={e => onUpdate(
              e.target.checked
                ? { isDefault: true, keywords: [] }
                : { isDefault: false, keywords: data.keywords ?? [] },
              e.target.checked ? 'その他' : (data.keywords ?? []).join(' / '),
            )}
            className="accent-violet-500"
          />
          その他（どれにも一致しない時）
        </label>
        <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
          複数の出口にキーワードを設定し、1つを「その他」にしておくと取りこぼしません。
        </p>
      </div>
    )
  }

  // 通常のエッジ
  return (
    <div>
      <h3 className="font-semibold text-slate-700 text-sm mb-2">線（エッジ）</h3>
      <p className="text-[11px] text-slate-400">
        この線の起点は分岐ノードではないため、条件はありません。ノードからノードへ順番に進みます。
      </p>
    </div>
  )
}

// ============================================================
// エクスポート（Provider でラップ）
// ============================================================
export default function FlowBuilder(props: {
  tenantId: string
  categories: Category[]
  faqs: FAQ[]
  savedFlow: { nodes: Node[]; edges: Edge[] } | null
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  )
}
