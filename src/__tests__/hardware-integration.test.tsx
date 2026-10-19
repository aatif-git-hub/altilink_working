// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const transport = vi.hoisted(() => ({ data:null as null | ((value:DataView)=>void), lost:null as null | (()=>void), command:{} as any, group:'ALT-TEST', node:'M01', fix:true }));
function emit(event:any) {
  const bytes = new TextEncoder().encode(JSON.stringify(event)+'\n');
  for(let i=0;i<bytes.length;i+=20) transport.data!(new DataView(bytes.slice(i,i+20).buffer));
}
vi.mock('../hardware/bleTransport', () => ({ BleTransport: class {
  async connect(data:any,lost:any) { transport.data=data; transport.lost=lost; return 'AltiLink-M01'; }
  async disconnect() {}
  async write(value:Uint8Array) {
    const c=JSON.parse(new TextDecoder().decode(value)); transport.command=c;
    if(c.command==='configure') { transport.group=c.group; transport.node=c.node; }
    if(c.command==='configure'||c.command==='status') {
      emit({v:1,event:'hello',group:transport.group,node:transport.node,boot:'local',radio:true});
      emit({v:1,event:'local',fix:transport.fix,...(transport.fix?{lat:13,lon:80}:{})});
    }
    emit({v:1,event:'result',id:c.id,ok:true,message:'Board accepted',...(c.command==='sos'?{packetId:`${transport.node}:local:10`,fix:transport.fix,...(transport.fix?{lat:13,lon:80}:{})}:{})});
  }
} }));
import { SimulationProvider, useSimulation } from '../context/SimulationContext';
import { communicationService } from '../services/communicationService';
import { DevicePanel } from '../components/hardware/DevicePanel';
import { EmergencyPage } from '../pages/EmergencyPage';
import { LinkStatusPage } from '../pages/LinkStatusPage';
let state:ReturnType<typeof useSimulation>;
function Probe() { state=useSimulation(); return <><DevicePanel/><EmergencyPage/><LinkStatusPage setActiveTab={()=>{}}/></>; }
let root:Root, host:HTMLDivElement;
const incoming=(override:Record<string,any>={})=>({v:1,event:'rx',rssi:-77,snr:6,packet:{v:1,type:'position',group:transport.group,from:'M02',boot:'remote',seq:1,ps:1,fix:true,lat:13.001,lon:80,...override}});
const click=async(label:string)=>{
 const b=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===label);expect(b,label).toBeTruthy();
 await act(async()=>{b!.click();});
};
const hardware=async()=>{
 await act(async()=>state.createGroup('Test trek','Mani','M01'));
 await act(async()=>state.setDataMode('hardware'));
 await click('Connect band');
 expect(state.hardware.matches).toBe(false);
 await click('Use this group and member ID');
 expect(state.hardware.ready).toBe(true);
};
beforeEach(async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('Backend offline for tests')));
 localStorage.clear();sessionStorage.clear();transport.group='ALT-TEST';transport.node='M01';transport.fix=true;
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<SimulationProvider><Probe/></SimulationProvider>));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe('Existing application connected through SimulationContext and communicationService',()=>{
 it('keeps demo members separate, requires identity setup, routes GPS, filters and deduplicates real SOS, and sends ACKs',async()=>{
  await hardware();
  expect(state.members.map(m=>m.id)).toEqual(['M01']);expect(state.checkpoints).toEqual([]);expect(state.separationThreshold).toBeNaN();
  await act(async()=>{emit(incoming({group:'FOREIGN',from:'X01'}));emit(incoming());});
  expect(state.members.map(m=>m.id)).toEqual(['M01','M02']);expect(state.members[1].latitude).toBe(13.001);
  await act(async()=>{emit(incoming({type:'sos',seq:2,fix:false}));emit(incoming({type:'sos',seq:2,fix:false}));});
  expect(state.band.alerts).toHaveLength(1);expect(state.activeEmergency?.gpsValid).toBe(false);
  expect(host.textContent).toContain('GPS unavailable');expect(host.textContent).not.toContain('NaN');
  await click('Acknowledge received SOS');expect(transport.command).toMatchObject({command:'ack',to:'M02',ref:'M02:remote:2'});
  expect(host.textContent).toContain('Acknowledgement transmitted');
  await act(async()=>transport.lost!());expect(state.activeEmergency?.packetID).toBe('M02:remote:2');
  expect(state.members.every(m=>m.gpsValid===false)).toBe(true);expect(state.hardware.ready).toBe(false);
  await click('Clear on this device');expect(state.activeEmergency).toBeNull();
 });
 it('requires a matching peer ACK, preserves SOS coordinates, and expires live GPS without generating fake range',async()=>{
  await hardware();await act(async()=>state.triggerManualSOS());
  expect(host.textContent).toContain('Delivery is unconfirmed');expect(state.broadcastProgress).toBe(0);
  await act(async()=>{emit({v:1,event:'local',fix:true,lat:14,lon:81});emit(incoming({type:'ack',seq:4,fix:false,to:'M01',ref:'M01:local:9'}));});
  expect(state.activeEmergency?.latitude).toBe(13);expect(state.activeEmergency?.status).toBe('PENDING');
  await act(async()=>emit(incoming({type:'ack',seq:5,fix:false,to:'M01',ref:'M01:local:10'})));
  expect(state.linkAssessment.avgPacketSuccess).toBeNaN();
  expect(state.activeEmergency?.status).toBe('RECEIVED');expect(host.textContent).toContain('Acknowledged by M02');
  await act(async()=>vi.advanceTimersByTimeAsync(46000));
  expect(state.members.every(m=>m.gpsValid===false)).toBe(true);expect(state.separationThreshold).toBeNaN();
  expect(state.activeEmergency?.latitude).toBe(13);
 });
 it('does not poll simulated backend state in hardware mode, blocks simulated sensors, and retains mode after reload',async()=>{
  await hardware();const poll=vi.spyOn(communicationService,'fetchGroupStateFromBackend');
  await act(async()=>{state.startHike();state.startFallSimulation();state.advanceSimulatedTime(5);});
  expect(state.lifecycleState).toBe('ACTIVE_HIKE');expect(state.fallDetectionState.stage).toBe('IDLE');expect(state.checkpoints).toEqual([]);
  await act(async()=>vi.advanceTimersByTimeAsync(3000));expect(poll).not.toHaveBeenCalled();
  await act(async()=>state.setDataMode('simulation'));expect(state.dataMode).toBe('hardware');
  await act(async()=>root.unmount());root=createRoot(host);
  await act(async()=>root.render(<SimulationProvider><Probe/></SimulationProvider>));
  expect(state.dataMode).toBe('hardware');expect(state.lifecycleState).toBe('GROUP_LOBBY');expect(state.hardware.ready).toBe(false);
  expect(state.members[0].gpsValid).toBe(false);
 });
 it('preserves demo checkpoints and backtracking and reports missing ML inference instead of fabricating a fall',async()=>{
  await act(async()=>state.createGroup('Test trek','Mani','M01'));
  await act(async()=>state.startHike());await act(async()=>state.advanceSimulatedTime(5));
  expect(state.checkpoints.length).toBeGreaterThan(1);
  await act(async()=>state.toggleBacktracking());expect(state.isBacktracking).toBe(true);
  const deleted=state.checkpoints[1].id;await act(async()=>state.deleteCheckpoint(deleted));expect(state.checkpoints.some(c=>c.id===deleted)).toBe(false);
  vi.spyOn(communicationService,'predictFallFromIMU').mockResolvedValue(null);
  await act(async()=>state.startFallSimulation());await act(async()=>vi.advanceTimersByTimeAsync(1900));
  expect(state.fallDetectionState.lastPrediction).toBeNull();expect(state.fallDetectionState.stage).toBe('IDLE');expect(state.activeEmergency).toBeNull();
  expect(host.textContent).toContain('ML server unavailable');
 });
});
