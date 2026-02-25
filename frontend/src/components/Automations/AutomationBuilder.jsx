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
  GitBranch, MoreVertical, Trash2, Settings, History,
  Globe, ClipboardList, Database, X
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAutomationStore } from '../../stores/automationStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';

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
      { type: 'action', subType: 'create_task', label: 'Créer une tâche', icon: ClipboardList },
      { type: 'action', subType: 'webhook', label: 'Webhook', icon: Globe },
      { type: 'action', subType: 'update_record', label: 'Modifier un enregistrement', icon: Database },
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
  const { addToast } = useToastStore();
  const user = useAuthStore(s => s.user);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [activeTab, setActiveTab] = useState('canvas');

  // Test mode state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [testEmail, setTestEmail] = useState(user?.email || '');

  // Convert automation nodes to React Flow format
  // Read from typed sub-schemas (backend format) with fallback to flat config (legacy)
  const initialNodes = (automation.nodes || []).map((node, index) => {
    let config = node.config || {};
    let subType = node.subType;

    if (node.type === 'action') {
      config = node.actionConfig || config;
      subType = node.actionType || subType;
    } else if (node.type === 'condition') {
      config = node.conditionConfig || config;
    } else if (node.type === 'wait') {
      config = node.waitConfig || config;
    } else if (node.type === 'trigger') {
      config = node.triggerConfig || config;
    }

    return {
      id: node.id || `node-${index}`,
      type: node.type,
      position: snapToGrid(node.position || { x: 300, y: 90 + index * 150 }),
      data: { label: node.label, config, subType }
    };
  });

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

    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: template.type,
      position: snapToGrid({ x: baseX, y: newY }),
      data: {
        label: template.label,
        subType: template.subType,
        config: {}
      }
    };

    setNodes((nds) => [...nds, newNode]);

    // Auto-connect: connect from selected node or last node in chain
    const sourceNode = selectedNode || nodes[nodes.length - 1];
    if (sourceNode) {
      setEdges((eds) => addEdge({
        id: `e-${sourceNode.id}-${newNodeId}`,
        source: sourceNode.id,
        target: newNodeId,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 }
      }, eds));
    }

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
      // Map to typed sub-schemas expected by backend Mongoose model
      const automationNodes = nodes.map(node => {
        const outgoingEdges = edges.filter(e => e.source === node.id);
        const baseNode = {
          id: node.id,
          type: node.type,
          label: node.data.label,
          position: snapToGrid(node.position),
          connections: outgoingEdges.map(e => ({ targetId: e.target, condition: 'default' }))
        };

        if (node.type === 'action') {
          baseNode.actionType = node.data.subType;
          baseNode.actionConfig = node.data.config || {};
        } else if (node.type === 'condition') {
          baseNode.conditionConfig = node.data.config || {};
        } else if (node.type === 'wait') {
          baseNode.waitConfig = node.data.config || {};
        } else if (node.type === 'trigger') {
          baseNode.triggerConfig = node.data.config || {};
        }

        return baseNode;
      });

      await updateAutomation(automation._id, { nodes: automationNodes });
      addToast({ type: 'success', message: 'Automation sauvegardée' });
    } catch (error) {
      console.error('Save error:', error);
      addToast({ type: 'error', message: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunClick = () => {
    setShowTestModal(true);
  };

  const handleRunConfirm = async () => {
    setShowTestModal(false);
    setRunning(true);
    try {
      await handleSave();
      await runAutomation(automation._id, {
        testMode,
        testEmail: testMode ? testEmail : undefined
      });
      addToast({
        type: 'success',
        message: testMode
          ? `Test lancé — email envoyé à ${testEmail}`
          : 'Exécution lancée'
      });
    } catch (error) {
      console.error('Run error:', error);
      addToast({ type: 'error', message: 'Erreur lors du test' });
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
              onClick={handleRunClick}
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
                automationTriggerType={automation.triggerType}
              />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
            <AutomationRunsPanel automationId={automation._id} />
          </div>
        )}
      </div>

      {/* Test Mode Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-dark-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-dark-border">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Lancer un test
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Test mode toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Mode test
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Redirige les emails vers une adresse de test
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={testMode}
                  onClick={() => setTestMode(!testMode)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${testMode ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}
                  `}
                >
                  <span className={`
                    inline-block h-4 w-4 rounded-full bg-white transition-transform
                    ${testMode ? 'translate-x-6' : 'translate-x-1'}
                  `} />
                </button>
              </label>

              {/* Test email field */}
              {testMode && (
                <Input
                  label="Email de test"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="votre@email.com"
                />
              )}

              {testMode && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Les emails seront envoyés à <strong>{testEmail || '...'}</strong> au lieu du vrai destinataire.
                    Le run sera marqué comme "TEST" dans l'historique.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-dark-border">
              <Button
                variant="secondary"
                onClick={() => setShowTestModal(false)}
              >
                Annuler
              </Button>
              <Button
                icon={Play}
                onClick={handleRunConfirm}
                disabled={testMode && !testEmail}
              >
                {testMode ? 'Lancer le test' : 'Exécuter'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
