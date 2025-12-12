import React, { useState } from 'react';
import ShaderCanvas from './components/ShaderCanvas';
import ControlPanel from './components/ControlPanel';
import DocsPanel from './components/DocsPanel';
import { Uniforms, Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.RENDER);
  
  // Initial State for our Simulation
  const [uniforms, setUniforms] = useState<Uniforms>({
    density: 2.5,
    scatteringG: 0.6,
    lightAngle: 1.5,
    steps: 64,
    dithering: true,
    shadowSoftness: 16.0,
  });

  return (
    <div className="w-full h-screen flex flex-col md:flex-row overflow-hidden bg-slate-900 text-slate-200">
      
      {/* Left / Top Area: Visualization */}
      <div className={`relative flex-grow ${activeTab === Tab.RENDER ? 'h-full' : 'h-1/3 md:h-full md:w-2/3'} border-r border-slate-800 transition-all duration-300`}>
        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs text-cyan-400 font-mono border border-cyan-900">
          Volumetric Light Lab /// v1.0
        </div>
        <ShaderCanvas uniforms={uniforms} />
        
        {/* Overlay Controls for Mobile or Quick Access */}
        <div className="absolute bottom-4 left-4 right-4 md:w-80 z-20">
          <ControlPanel uniforms={uniforms} setUniforms={setUniforms} />
        </div>
      </div>

      {/* Right / Bottom Area: Documentation & Info */}
      <div className={`flex flex-col bg-slate-900 ${activeTab === Tab.RENDER ? 'hidden md:flex md:w-1/3' : 'h-2/3 md:h-full md:w-1/3'} transition-all duration-300`}>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab(Tab.DOCS)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === Tab.DOCS ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Design Docs
          </button>
          <button 
            onClick={() => setActiveTab(Tab.CODE)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === Tab.CODE ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
          >
            GLSL Code
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-hidden relative">
          <div className="absolute inset-0 p-4">
            <DocsPanel activeTab={activeTab === Tab.CODE ? 'CODE' : 'DOCS'} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
