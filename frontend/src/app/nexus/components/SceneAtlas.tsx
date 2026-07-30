import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSimulationStore } from '../simulationStore';
import { HardDrive, Play, HelpCircle } from 'lucide-react';

interface SchemaNode {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  columns: { name: string; type: string }[];
}

export default function SceneAtlas() {
  const addLog = useSimulationStore((state) => state.addLog);
  const [selectedNode, setSelectedNode] = useState<string>('transactions');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM transactions WHERE tenant_id = \'abccorp\'');
  const [queryResult, setQueryResult] = useState<Array<Record<string, any>> | null>(null);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);

  // Schema configuration
  const nodes: SchemaNode[] = [
    {
      id: 'platform_entitlements',
      name: 'Engine E',
      color: '#eab308',
      x: 240,
      y: -20,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'plan_name', type: 'text' },
        { name: 'price_mrr', type: 'numeric' }
      ]
    },
    {
      id: 'tenants',
      name: 'tenants',
      color: '#3b82f6',
      x: 240,
      y: 80,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'subdomain', type: 'text' },
        { name: 'billing_status', type: 'text' }
      ]
    },
    {
      id: 'properties',
      name: 'properties',
      color: '#10b981',
      x: 140,
      y: 150,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'tenant_id', type: 'uuid FK' },
        { name: 'name', type: 'text' }
      ]
    },
    {
      id: 'modules',
      name: 'modules',
      color: '#8b5cf6',
      x: 80,
      y: 200,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'property_id', type: 'uuid FK' },
        { name: 'engine_type', type: 'text' }
      ]
    },
    {
      id: 'users',
      name: 'users',
      color: '#3b82f6',
      x: 340,
      y: 150,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'tenant_id', type: 'uuid FK' },
        { name: 'scope', type: 'text' }
      ]
    },
    {
      id: 'transactions',
      name: 'transactions',
      color: '#f59e0b',
      x: 240,
      y: 210,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'tenant_id', type: 'uuid FK' },
        { name: 'property_id', type: 'uuid FK' },
        { name: 'amount', type: 'numeric' },
        { name: 'status', type: 'text' }
      ]
    },
    {
      id: 'loyalty_members',
      name: 'loyalty_members',
      color: '#ec4899',
      x: 410,
      y: 200,
      columns: [
        { name: 'id', type: 'uuid PK' },
        { name: 'tenant_id', type: 'uuid FK' },
        { name: 'points_balance', type: 'integer' }
      ]
    }
  ];

  // Pre-coded query templates
  const queryTemplates = [
    { label: 'Select ABC Corp Transactions', sql: "SELECT * FROM transactions WHERE tenant_id = 'abccorp'" },
    { label: 'Select Suspended Tenants', sql: "SELECT * FROM tenants WHERE billing_status = 'suspended'" },
    { label: 'Trace User Scopes', sql: "SELECT id, scope FROM users" }
  ];

  const handleRunQuery = () => {
    addLog('db', `Running SQL Query: ${sqlQuery}`);
    setActiveFlow('query');

    setTimeout(() => {
      setActiveFlow(null);
      
      // Seed mockup results based on keywords
      if (sqlQuery.includes('transactions')) {
        setQueryResult([
          { id: 'tx_890a', tenant_id: 'abccorp', amount: 45.00, status: 'completed' },
          { id: 'tx_901b', tenant_id: 'abccorp', amount: 120.00, status: 'completed' },
          { id: 'tx_912c', tenant_id: 'abccorp', amount: 12.50, status: 'pending' },
        ]);
        setSelectedNode('transactions');
      } else if (sqlQuery.includes('tenants')) {
        setQueryResult([
          { id: 'tn_4', subdomain: 'grandresort.v2platform.com', billing_status: 'past_due' }
        ]);
        setSelectedNode('tenants');
      } else if (sqlQuery.includes('modules')) {
         setQueryResult([
             { id: 'mod_loyalty', property_id: 'prop_01', engine_type: 'LoyaltyPoints' },
             { id: 'mod_finance', property_id: 'prop_02', engine_type: 'FinanceEngineE' }
          ]);
         setSelectedNode('modules'); 
      } else if (sqlQuery.includes('loyalty')) {
        setQueryResult([
           { id: 'lm_901', tenant_id: 'abccorp', points_balance: 250 },
           { id: 'lm_902', tenant_id: 'abccorp', points_balance: 84 }
       ]);
       setSelectedNode('loyalty_members');
      }  else {
        setQueryResult([
          { id: 'usr_091', scope: 'property_manager' },
          { id: 'usr_092', scope: 'customer' }
        ]);
        setSelectedNode('users');
      } 
    }, 1200);
  };

  const activeNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="absolute inset-0 flex flex-col p-4 z-10 select-none overflow-y-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4.5 h-4.5 text-yellow-500" />
          <h2 className="font-display font-extrabold text-white text-xs uppercase">DATABASE ATLAS SCHEMATICS</h2>
        </div>

        {/* Pre-coded templates selector */}
        <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-2 py-0.5 rounded">
          <span className="font-mono text-[8px] text-slate-500 uppercase font-bold">SQL Queries:</span>
          <select 
            onChange={(e) => setSqlQuery(e.target.value)}
            className="bg-transparent border-none outline-none font-mono text-[9px] text-white cursor-pointer"
          >
            {queryTemplates.map((t, idx) => (
              <option value={t.sql} className="bg-[#020212]" key={idx}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
        
        {/* SVG Nodes Schema Graph (7 cols) */}
        <div className="md:col-span-7 rounded-xl border border-white/5 bg-black/40 relative flex items-center justify-center p-3">
          <svg className="w-full h-full min-h-[250px]" viewBox="0 0 520 220">
            {/* Draw schema linkages */}
            <line x1="240" y1="80" x2="140" y2="150" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="240" y1="80" x2="340" y2="150" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="140" y1="150" x2="80" y2="200" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="140" y1="150" x2="240" y2="210" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="340" y1="150" x2="410" y2="200" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="340" y1="150" x2="240" y2="210" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <line x1="240" y1="-10" x2="240" y2="90" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

            {/* Glowing path traversal check */}
            {activeFlow === 'query' && (
              <motion.path
                d="M 240 80 L 140 150 L 240 210"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="2.5"
                strokeDasharray="300"
                initial={{ strokeDashoffset: 300 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.0 }}
                style={{ filter: 'drop-shadow(0 0 5px #00e5ff)' }}
              />
            )}

            {/* Schema Nodes mapping */}
            {nodes.map((node) => {
              const isSelected = selectedNode === node.id;
              return (
                <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(node.id)}>
                  {isSelected && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="22"
                      fill="none"
                      stroke={node.color}
                      strokeWidth="1.5"
                      className="animate-pulse"
                      style={{ filter: `drop-shadow(0 0 6px ${node.color})` }}
                    />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="16"
                    fill="#02020e"
                    stroke={isSelected ? node.color : 'rgba(255,255,255,0.15)'}
                    strokeWidth="2"
                  />
                  <circle cx={node.x} cy={node.y} r="5" fill={`${node.color}30`} />
                  <text
                    x={node.x}
                    y={node.y + 26}
                    textAnchor="middle"
                    fill={isSelected ? '#fff' : 'rgba(255,255,255,0.5)'}
                    fontSize="7.5"
                    fontFamily="monospace"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Live SQL Console Console (5 cols) */}
        <div className="md:col-span-5 flex flex-col gap-3 min-h-0">
          
          {/* Query input editor */}
          <div className="p-3 rounded-lg border border-white/5 bg-black/60 flex flex-col gap-2 shrink-0">
            <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest block">SQL Live Terminal</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="flex-1 p-1 bg-black border border-white/10 rounded font-mono text-[10px] text-white focus:border-cyan-500 outline-none"
              />
              <button
                onClick={handleRunQuery}
                disabled={activeFlow !== null}
                className="px-3 bg-cyan-600 hover:bg-cyan-500 text-black font-mono font-bold text-[9px] uppercase rounded transition flex items-center gap-1 disabled:opacity-30 shrink-0"
              >
                <Play className="w-3 h-3 fill-current" /> Run
              </button>
            </div>
          </div>

          {/* Results Table Panel */}
          <div className="flex-1 border border-white/5 rounded-lg bg-black/60 p-2.5 flex flex-col gap-2 min-h-0 overflow-y-auto">
            <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-1">Query Result Set</span>
            
            {queryResult ? (
              <div className="font-mono text-[9px] flex flex-col gap-1">
                {/* Headers */}
                <div className="flex justify-between font-bold text-slate-500 border-b border-white/5 pb-0.5">
                  {Object.keys(queryResult[0]).map((h) => (
                    <span className="flex-1" key={h}>{h}</span>
                  ))}
                </div>
                {/* Rows */}
                {queryResult.map((row, idx) => (
                  <div className="flex justify-between text-slate-300 py-0.5" key={idx}>
                    {Object.values(row).map((v: any, vIdx) => (
                      <span className="flex-1 truncate" key={vIdx}>{String(v)}</span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <span className="font-mono text-[8.5px] text-slate-600 block text-center py-6">No results returned. Execute a query.</span>
            )}
          </div>

          {/* Columns specs of selected table */}
          {activeNodeData && (
            <div className="p-3 rounded-lg border border-white/5 bg-white/[0.01] shrink-0">
              <span className="font-mono text-[8.5px] text-white font-bold block border-b border-white/5 pb-1 mb-2">Columns Schema: {activeNodeData.name}</span>
              <div className="flex flex-wrap gap-2">
                {activeNodeData.columns.map((c, idx) => (
                  <span className="font-mono text-[8.5px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5" key={idx}>
                    {c.name} <span className="text-[7.5px] text-slate-600">({c.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
