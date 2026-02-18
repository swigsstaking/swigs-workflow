import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft, Save, Play, Plus, Zap, Mail, Clock,
  GitBranch, MoreVertical, Trash2, Settings, History
} from 'lucide-react';
import Button from '../ui/Button';
import { useAutomationStore } from '../../stores/automationStore';

// Custom Node Components
import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import WaitNode from './nodes/WaitNode';

// Node configuration panel
import NodeConfigPanel from './NodeConfigPanel';

// Runs history panel
import AutomationRunsPanel from './AutomationRunsPanel';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode
};

// Snap position to 15px grid
const snapToGrid = (position) => ({
  x: Math.round(position.x / 15) * 15,
  y: Math.round(position.y / 15) * 15
});

const NODE_TEMPLATES = [
  {
    category: 'Actions',
    items: [
      { type: 'action', subType: 'send_email', label: 'Envoyer un email', icon: Mail },
    ]
  },
  {
    category: 'Logique',
    items: [
      { type: 'condition', label: 'Condition', icon: GitBranch },
      { type: 'wait', label: 'Attendre', icon: Clock },
    ]
  }
];

export default function AutomationBuilder({ automation, onClose }) {
  const { updateAutomation, runAutomation } = useAutomationStore();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [activeTab, setActiveTab] = useState('canvas');

  // Convert automation nodes to React Flow format
  // Align to 15px grid
  const initialNodes = (automation.nodes || []).map((node, index) => ({
    id: node.id || `node-${index}`,
    type: node.type,
    position: snapToGrid(node.position || { x: 300, y: 90 + index * 150 }),
    data: {
      label: node.label,
      config: node.config || {},
      subType: node.subType
    }
  }));

  // Convert connections to React Flow edges
  // Handle both old format (array of strings) and new format (array of objects with targetId)
  const initialEdges = [];
  (automation.nodes || []).forEach(node => {
    if (node.connections && Array.isArray(node.connections)) {
      node.connections.forEach(conn => {
        // Support both formats: string (old) or object with targetId (new)
        const targetId = typeof conn === 'string' ? conn : conn.targetId;
        if (targetId) {
          initialEdges.push({
            id: `e-${node.id}-${targetId}`,
            source: node.id,
            target: targetId,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 }
          });
        }
      });
    }
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 }
    }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddNode = (template) => {
    // Calculate position: same X as trigger (for vertical alignment), below lowest node
    const triggerNode = nodes.find(n => n.type === 'trigger');
    const baseX = triggerNode?.position?.x || 450;

    // Find the lowest Y position among existing nodes
    const lowestY = nodes.reduce((maxY, node) => {
      return Math.max(maxY, node.position.y);
    }, 0);

    // Place new node 120px below the lowest node (snapped to 15px grid)
    const newY = snapToGrid({ x: 0, y: lowestY + 120 }).y;

    const newNode = {
      id: `node-${Date.now()}`,
      type: template.type,
      position: snapToGrid({ x: baseX, y: newY }),
      data: {
        label: template.label,
        subType: template.subType,
        config: {}
      }
    };

    setNodes((nds) => [...nds, newNode]);
    setShowNodePalette(false);
  };

  const handleDeleteNode = (nodeId) => {
    // Don't allow deleting trigger node
    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === 'trigger') return;

    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const handleUpdateNodeConfig = (nodeId, config) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config } }
          : node
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert React Flow format back to automation format
      // Ensure positions are aligned to 15px grid
      const automationNodes = nodes.map(node => {
        const outgoingEdges = edges.filter(e => e.source === node.id);
        return {
          id: node.id,
          type: node.type,
          label: node.data.label,
          position: snapToGrid(node.position),
          config: node.data.config || {},
          subType: node.data.subType,
          // Save connections as objects with targetId (matches backend schema)
          connections: outgoingEdges.map(e => ({ targetId: e.target, condition: 'default' }))
        };
      });

      await updateAutomation(automation._id, { nodes: automationNodes });
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await handleSave();
      await runAutomation(automation._id, { test: true });
    } catch (error) {
      console.error('Run error:', error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-dark-bg z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-dark-card border-b border-slate-200 dark:border-dark-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                {automation.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {automation.description || 'Pas de description'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={Play}
              onClick={handleRun}
              loading={running}
              disabled={saving}
            >
              Tester
            </Button>
            <Button
              icon={Save}
              onClick={handleSave}
              loading={saving}
              disabled={running}
            >
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium
              border-b-2 transition-colors
              ${activeTab === 'canvas'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <Settings className="w-4 h-4" />
            Canvas
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium
              border-b-2 transition-colors
              ${activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <History className="w-4 h-4" />
            Historique
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'canvas' ? (
          <>
            <div ref={reactFlowWrapper} className="flex-1">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={setReactFlowInstance}
                nodeTypes={nodeTypes}
                nodeOrigin={[0.5, 0.5]}
                fitView
                snapToGrid
                snapGrid={[15, 15]}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                  markerEnd: { type: MarkerType.ArrowClosed }
                }}
              >
                <Background color="#94a3b8" gap={15} />

                {/* Add Node Panel */}
                <Panel position="top-left" className="!m-4">
                  <div className="relative">
                    <Button
                      icon={Plus}
                      onClick={() => setShowNodePalette(!showNodePalette)}
                      variant={showNodePalette ? 'primary' : 'secondary'}
                    >
                      Ajouter
                    </Button>

                    {showNodePalette && (
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-slate-200 dark:border-dark-border p-3 z-10">
                        {NODE_TEMPLATES.map((category) => (
                          <div key={category.category} className="mb-3 last:mb-0">
                            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">
                              {category.category}
                            </h4>
                            <div className="space-y-1">
                              {category.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <button
                                    key={item.type + (item.subType || '')}
                                    onClick={() => handleAddNode(item)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
                                  >
                                    <Icon className="w-4 h-4 text-slate-400" />
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>
              </ReactFlow>
            </div>

            {/* Config Panel */}
            {selectedNode && (
              <NodeConfigPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdateConfig={(config) => handleUpdateNodeConfig(selectedNode.id, config)}
                onDelete={() => handleDeleteNode(selectedNode.id)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
            <AutomationRunsPanel automationId={automation._id} />
          </div>
        )}
      </div>
    </div>
  );
}
