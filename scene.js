/* Offline, orthographic 3D renderer for the DivePlan movement preview. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const BASE_CAMERA = { azimuth: 0.83, elevation: 0.47 };
  const ZERO = { x: 0, y: 0, z: 0, t: 0 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const plus = (a, b) => a.map((v, i) => v + b[i]);
  const minus = (a, b) => a.map((v, i) => v - b[i]);
  const times = (v, amount) => v.map(n => n * amount);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = v => times(v, 1 / (Math.hypot(...v) || 1));
  const vector = p => [p.x, p.y, p.z];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const average = vertices => times(vertices.reduce(plus, [0, 0, 0]), 1 / vertices.length);

  const colors = {
    carbon: [39, 54, 63], frame: [68, 83, 88], edge: [120, 138, 134], black: [19, 31, 36],
    alloy: [160, 177, 169], steel: [95, 115, 113], ceramic: [227, 226, 203],
    float: [251, 135, 47], amber: [221, 96, 27], yellow: [255, 185, 83],
    glass: [37, 80, 91], lens: [44, 126, 133], reflection: [155, 226, 218]
  };

  // Faces stay in the vehicle coordinate frame, so an animation only moves a cached rendering.
  function makeVehicle() {
    const faces = [];
    const face = (vertices, normal, color, twoSided = false) => {
      faces.push({ vertices, normal: unit(normal), center: average(vertices), color, twoSided });
    };
    const colorScale = (color, scale) => color.map(c => c * scale);

    function box(center, size, color) {
      const p = (i, j, k) => [center[0]+size[0]*i/2, center[1]+size[1]*j/2, center[2]+size[2]*k/2];
      for (const k of [-1, 1]) {
        face([p(k,-1,-1),p(k,1,-1),p(k,1,1),p(k,-1,1)], [k,0,0], color);
        face([p(-1,k,-1),p(1,k,-1),p(1,k,1),p(-1,k,1)], [0,k,0], color);
        face([p(-1,-1,k),p(1,-1,k),p(1,1,k),p(-1,1,k)], [0,0,k], color);
      }
    }

    function circular(center, axis) {
      axis = unit(axis);
      const u = unit(cross(Math.abs(axis[2]) > 0.9 ? [0,1,0] : [0,0,1], axis));
      const v = cross(axis,u);
      const radial = a => plus(times(u, Math.cos(a)), times(v, Math.sin(a)));
      const point = (z, r, a) => plus(plus(center, times(axis, z)), times(radial(a), r));
      return { axis, radial, point };
    }
    function ringSection(basis, z0, r0, z1, r1, color, count = 16, inward = false) {
      const { axis, radial, point } = basis;
      for (let i=0; i<count; i++) {
        const a=i*TAU/count, b=(i+1)*TAU/count;
        let normal = unit(plus(times(radial((a+b)/2), Math.abs(z1-z0)), times(axis, (r0-r1)*Math.sign(z1-z0))));
        if (inward) normal = times(normal,-1);
        face([point(z0,r0,a), point(z0,r0,b), point(z1,r1,b), point(z1,r1,a)], normal, color);
      }
    }
    function annulus(basis, z, rOuter, rInner, side, color, count = 16) {
      for (let i=0; i<count; i++) {
        const a=i*TAU/count, b=(i+1)*TAU/count;
        face([basis.point(z,rOuter,a), basis.point(z,rOuter,b), basis.point(z,rInner,b), basis.point(z,rInner,a)], times(basis.axis, side), color);
      }
    }
    function cap(basis, z, r, side, color, count = 16) {
      face(Array.from({length:count},(_,i) => basis.point(z,r,i*TAU/count)), times(basis.axis,side), color);
    }
    function rod(a, b, radius, color, count = 10) {
      const length = Math.hypot(...minus(b,a));
      const basis = circular(a, minus(b,a));
      ringSection(basis,0,radius,length,radius,color,count);
      cap(basis,0,radius,-1,color,count);
      cap(basis,length,radius,1,color,count);
    }

    // Closed-cell floats with clipped corners and bevelled end caps.
    function float(y) {
      const ring = [[-.77,-1],[.77,-1],[1,-.45],[1,.35],[.71,1],[-.69,1],[-1,.35],[-1,-.45]];
      const sections=[[-1.12,.61,-.037],[-.96,.97,0],[-.58,1,0],[0,1,0],[.58,1,0],[.96,.96,-.014],[1.11,.61,-.059]];
      const section=([x,scale,offset]) => ring.map(([dy,dz])=>[x,y+.227*dy*scale,.46+.142*dz*scale+offset]);
      const loops=sections.map(section);
      for(let j=0;j<loops.length-1;j++) {
        for(let i=0;i<ring.length;i++) {
          const n=(i+1)%ring.length;
          const vertices=[loops[j][i],loops[j][n],loops[j+1][n],loops[j+1][i]];
          const normal=cross(minus(vertices[1],vertices[0]),minus(vertices[3],vertices[0]));
          const color = i===0 ? colors.amber : colors.float;
          face(vertices, normal, color);
        }
      }
      face(loops[0],[-1,0,0],colors.amber);
      face(loops.at(-1),[1,0,0],colors.amber);
      // Twin narrow retainer belts inset into the float.
      for (const x of [-.62,.62]) {
        const topLoop=ring.map(([dy,dz])=>[x,y+.231*dy,.46+.144*dz]);
        for(let i=0;i<ring.length;i++) {
          const n=(i+1)%ring.length;
          const vertices=[topLoop[i],topLoop[n],plus(topLoop[n],[.048,0,0]),plus(topLoop[i],[.048,0,0])];
          const normal=cross(minus(vertices[1],vertices[0]),[1,0,0]);
          face(vertices,normal,colors.frame);
        }
      }
      // Small ceramic wayfinding stripes and side access fasteners.
      for(const x of [.09,.205,.32]) {
        face([[x,y-.10,.603],[x+.048,y-.10,.603],[x+.095,y+.09,.603],[x+.048,y+.09,.603]], [0,0,1], colors.ceramic);
      }
    }

    function thruster(center, axis, radius, length, phase) {
      const basis=circular(center,axis);
      const half=length/2;
      const n=16;
      const waist=radius*.89, inner=radius*.78;
      ringSection(basis,-half,radius,-half*.70,waist,colors.steel,n);
      ringSection(basis,-half*.70,waist,half*.70,waist,colors.carbon,n);
      ringSection(basis,half*.70,waist,half,radius,colors.frame,n);
      ringSection(basis,-half,inner,half,inner,colors.black,n,true);
      annulus(basis, half,radius,inner,1,colors.steel,n);
      annulus(basis,-half,radius,inner,-1,colors.frame,n);
      for(let i=0;i<5;i++) {
        const a=phase+i*TAU/5;
        const blade=[[.13,0],[.5,-.03],[.76,.16],[.73,.41],[.50,.42],[.23,.27],[.13,.22]];
        face(blade.map(([r,d])=>basis.point(.012,r*radius,a+d)),basis.axis,
          i%2 ? colors.steel : colorScale(colors.steel,1.15),true);
      }
      ringSection(basis,-.035,.21*radius,.045,.23*radius,colors.carbon,10);
      cap(basis,.045,.23*radius,1,colors.alloy,10);
      cap(basis,-.035,.21*radius,-1,colors.steel,10);
    }

    // Structural rails, diagonal uprights, skid shoes, and four cross-members.
    for(const side of [-1,1]) {
      for(const [x0,x1] of [[-1.11,-.4],[-.4,.4],[.4,1.11]]) {
        rod([x0,side*.78,-.58],[x1,side*.78,-.58],.067,colors.frame,8);
        rod([x0,side*.55,.24],[x1,side*.55,.24],.055,colors.alloy,8);
      }
      for(const direction of [-1,1]) {
        const x=direction*.83;
        rod([direction*1.11,side*.78,-.58],[direction*1.27,side*.75,-.48],.066,colors.frame,8);
        rod([x,side*.69,-.53],[direction*1.07,side*.50,.24],.065,colors.frame,8);
        rod([direction*.57,side*.68,-.51],[direction*.78,side*.60,.20],.045,colors.steel,8);
        rod([x,0,-.48],[x,side*.73,-.48],.053,colors.frame,8);
        rod([direction*.83,side*.52,.19],[direction*.91,side*.88,.16],.057,colors.frame,8);
      }
    }

    const vessel=circular([0,0,-.03],[1,0,0]);
    for(const [xa,xb] of [[-.91,-.57],[-.57,0],[0,.57],[.57,.91]]) {
      ringSection(vessel,xa,.337,xb,.337,colors.carbon,20);
    }
    for(const x of [-.89,-.56,.52,.88]) {
      ringSection(vessel,x-.035,.353,x+.035,.353,colors.alloy,20);
      annulus(vessel,x+.035,.353,.334,1,colors.steel,20);
      annulus(vessel,x-.035,.353,.334,-1,colors.steel,20);
    }
    cap(vessel,-.91,.334,-1,colors.black,20);
    ringSection(vessel,.90,.336,1.02,.293,colors.steel,24);
    annulus(vessel,1.02,.294,.229,1,colors.black,24);
    ringSection(vessel,1.02,.235,1.1,.218,colors.glass,24);
    ringSection(vessel,1.1,.218,1.17,.162,colors.lens,24);
    ringSection(vessel,1.17,.162,1.20,.085,colors.glass,24);
    cap(vessel,1.20,.085,1,colors.black,20);
    face([[1.162,-.114,.104],[1.174,-.073,.134],[1.181,-.063,.132],[1.174,-.091,.097]], [1,-.6,.8], colors.reflection);
    for(const side of [-1,1]) {
      const lamp=circular([.87,side*.46,-.075],[1,0,0]);
      ringSection(lamp,-.03,.117,.125,.117,colors.black,16);
      annulus(lamp,.125,.117,.084,1,colors.alloy,16);
      cap(lamp,.126,.084,1,[216,247,221],16);
      cap(lamp,.129,.049,1,[255,255,225],14);
    }
    for(const xSign of [-1,1]) for(const ySign of [-1,1]) {
      thruster([xSign*.84,ySign*.86,.132], [0,0,1], .278,.25, xSign+ySign*.4);
      thruster([xSign*.51,ySign*.91,-.197], [xSign*.70,ySign*.714,0], .251,.33, xSign-ySign*.37);
    }

    // Orange deck pontoons, centre service cover, vents, and lifting handle.
    float(-.34); float(.34);
    for(const x of [-.64,0,.64]) box([x,0,.34],[.55, .24, .075],colors.steel);
    box([0,0,.447],[.79,.24,.102],colors.frame);
    for(let i=-3;i<=3;i++) box([i*.083,0,.503],[.042,.17,.014],colors.black);
    for(const x of [-.46,.46]) {
      rod([x,0,.46],[x*.87,0,.68],.033,colors.frame,10);
    }
    rod([-.4,0,.68],[.4,0,.68],.034,colors.steel,10);
    return faces;
  }

  let model;
  function basisFor(azimuth,elevation) {
    const s=Math.sin(azimuth), c=Math.cos(azimuth), h=Math.cos(elevation), v=Math.sin(elevation);
    return { eye:[c*h,s*h,v], right:[-s,c,0], up:[-c*v,-s*v,h] };
  }

  function vehicleSprite(basis, scale, dpr) {
    model ||= makeVehicle();
    const surface=document.createElement('canvas');
    const size=Math.ceil(3.6*scale)+8;
    surface.width=Math.ceil(size*dpr); surface.height=Math.ceil(size*dpr);
    const ctx=surface.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.translate(size/2,size/2);
    ctx.lineJoin='round';
    const light=unit(plus(plus(times(basis.right,-.54),times(basis.eye,.32)),[0,0,1]));
    const visible=[];
    for (const f of model) {
      const facing=dot(f.normal,basis.eye);
      if (!f.twoSided && facing<.002) continue;
      visible.push({ f, facing, depth:dot(f.center,basis.eye) });
    }
    visible.sort((a,b)=>a.depth-b.depth);
    for(const {f,facing} of visible) {
      const normal=facing<0 ? times(f.normal,-1) : f.normal;
      const diffuse=Math.max(0,dot(normal,light));
      const shade=.57+.41*diffuse+.13*Math.max(0,normal[2]);
      const rgb=f.color.map(component=>Math.round(clamp(component*shade,0,255)));
      const tint='rgb('+rgb.join(',')+')';
      ctx.beginPath();
      f.vertices.forEach((p,i)=>{
        const x=dot(p,basis.right)*scale, y=-dot(p,basis.up)*scale;
        if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
      });
      ctx.closePath(); ctx.fillStyle=tint; ctx.fill();
      ctx.lineWidth=.48; ctx.strokeStyle=tint; ctx.stroke();
    }
    return { surface, size };
  }

  function trackPosition(points,time) {
    if (time<=points[0].t) return vector(points[0]);
    for(let i=1;i<points.length;i++) {
      const end=points[i];
      if(time<=end.t) {
        const start=points[i-1], span=end.t-start.t;
        return mix(vector(start),vector(end),span>0 ? clamp((time-start.t)/span,0,1) : 1);
      }
    }
    return vector(points[points.length-1]);
  }

  function create(canvas) {
    const ctx=canvas.getContext('2d');
    let azimuth=BASE_CAMERA.azimuth, elevation=BASE_CAMERA.elevation, zoom=1;
    let trajectory={ points:[ZERO], duration:0 }, time=0, sprite=null, spriteKey='';
    let drag=null, observer=null, pending=0;
    canvas.style.touchAction='none';
    canvas.style.cursor='grab';
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex=0;
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label','3D vehicle preview. Drag to orbit or use arrow keys. Scroll to zoom.');

    function draw() {
      const w=Math.round(canvas.clientWidth), h=Math.round(canvas.clientHeight);
      if(w<2 || h<2 || !ctx) return;
      const dpr=clamp(window.devicePixelRatio || 1,1,2);
      const bw=Math.round(w*dpr), bh=Math.round(h*dpr);
      if(canvas.width!==bw || canvas.height!==bh){ canvas.width=bw; canvas.height=bh; }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      const points=trajectory && trajectory.points && trajectory.points.length ? trajectory.points : [ZERO];
      const basis=basisFor(azimuth,elevation);
      const positions=points.map(vector);
      const bounds=[0,1,2].map(axis=>positions.reduce((b,p)=>[Math.min(b[0],p[axis]),Math.max(b[1],p[axis])],[Infinity,-Infinity]));
      const range=Math.max(...bounds.map(([lo,hi])=>hi-lo));
      const glyph=range>1e-8 ? range*.39 : .7;
      const xy=p=>[dot(p,basis.right),-dot(p,basis.up)];
      const projected=positions.map(xy);
      const extents=[0,1].map(axis=>projected.reduce((b,p)=>[Math.min(b[0],p[axis]),Math.max(b[1],p[axis])],[Infinity,-Infinity]));
      const [bx,by]=extents;
      const scale=Math.min(w*.86/Math.max(bx[1]-bx[0]+glyph*3.25,glyph*3.85),h*.88/Math.max(by[1]-by[0]+glyph*2.22,glyph*3.2))*zoom;
      const cx=w*.5-(bx[0]+bx[1])*.5*scale, cy=h*.487-(by[0]+by[1])*.5*scale;
      const screen=p=>{const q=xy(p);return [cx+q[0]*scale,cy+q[1]*scale];};

      const background=ctx.createLinearGradient(w*.24,0,w*.73,h);
      background.addColorStop(0,'#112c38'); background.addColorStop(.51,'#102833'); background.addColorStop(1,'#0a1c27');
      ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
      const glow=ctx.createRadialGradient(w*.42,h*.17,0,w*.42,h*.17,Math.max(w,h)*.77);
      glow.addColorStop(0,'rgba(55,109,117,.19)');glow.addColorStop(1,'rgba(12,35,45,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);

      const floor=bounds[2][0]-glyph*.84;
      const gridStep=glyph*.57, gridSize=Math.ceil(Math.hypot(w,h)/(scale*gridStep))+4;
      const centerX=(bounds[0][0]+bounds[0][1])/2, centerY=(bounds[1][0]+bounds[1][1])/2;
      const ix=Math.round(centerX/gridStep), iy=Math.round(centerY/gridStep);
      const gridRadius=Math.min(gridSize,70);
      function strokeLine(a,b,color,width=1,dash=[]) {
        ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.lineWidth=width;
        ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);
      }
      const gridFade=ctx.createLinearGradient(0,0,0,h);
      gridFade.addColorStop(0,'rgba(112,169,165,.022)');gridFade.addColorStop(.43,'rgba(112,169,165,.083)');gridFade.addColorStop(1,'rgba(112,169,165,.16)');
      ctx.beginPath();
      for(let i=-gridRadius;i<=gridRadius;i++) {
        const x=(ix+i)*gridStep, y=(iy+i)*gridStep;
        const pairs=[
          [screen([x,(iy-gridRadius)*gridStep,floor]),screen([x,(iy+gridRadius)*gridStep,floor])],
          [screen([(ix-gridRadius)*gridStep,y,floor]),screen([(ix+gridRadius)*gridStep,y,floor])]
        ];
        for(const [a,b] of pairs){ctx.moveTo(...a);ctx.lineTo(...b);}
      }
      ctx.strokeStyle=gridFade;ctx.lineWidth=.8;ctx.stroke();
      // A handful of fixed suspended particles gives the water depth without flashing during playback.
      let seed=27271;
      const random=()=>((seed=(seed*16807)%2147483647)-1)/2147483646;
      for(let i=0;i<Math.floor(w*h/5200);i++){
        const x=random()*w,y=random()*h,r=.35+random()*.55;
        ctx.fillStyle='rgba(148,203,198,'+(.09+random()*.20)+')';
        ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
      }
      const vehicle=trackPosition(points,time), vehiclePoint=screen(vehicle);
      const shadow=screen([vehicle[0],vehicle[1],floor]);
      const altitude=(vehicle[2]-floor)/glyph;
      ctx.save();
      ctx.translate(...shadow);
      const radius=scale*glyph*1.34;
      ctx.scale(1,Math.max(.17,Math.sin(elevation))*.85);
      const shadowGrad=ctx.createRadialGradient(0,0,0,0,0,radius);
      shadowGrad.addColorStop(0,'rgba(1,12,18,'+(.42/(1+altitude*.24))+')');shadowGrad.addColorStop(1,'rgba(1,12,18,0)');
      ctx.fillStyle=shadowGrad;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill();ctx.restore();

      // Dashed planned path and its direction chevrons; travelled segments are drawn solid.
      ctx.lineCap='round'; ctx.lineJoin='round';
      const lineWidth=Math.max(1.65,Math.min(w,h)*.0044);
      for(let i=1;i<points.length;i++) {
        const a=screen(positions[i-1]), b=screen(positions[i]);
        const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if(length<.4) continue;
        strokeLine(a,b,'rgba(8,39,43,.45)',lineWidth+2.3);
        strokeLine(a,b,'rgba(123,229,207,.83)',lineWidth,[4,5]);
        if(length>56) {
          const tip=mix(a,b,.53), ux=dx/length, uy=dy/length;
          ctx.beginPath();ctx.moveTo(tip[0]-ux*5-uy*3,tip[1]-uy*5+ux*3);ctx.lineTo(...tip);
          ctx.lineTo(tip[0]-ux*5+uy*3,tip[1]-uy*5-ux*3);
          ctx.strokeStyle='#a8f3dd';ctx.lineWidth=1.65;ctx.stroke();
        }
      }
      // Paint visited path last so that retracing a route preserves its progress.
      for(let i=1;i<points.length && time>points[i-1].t;i++) {
        const a=screen(positions[i-1]), b=screen(positions[i]);
        const span=points[i].t-points[i-1].t;
        const fraction=clamp((time-points[i-1].t)/(span||1),0,1);
        strokeLine(a,mix(a,b,fraction),'#80f3d3',lineWidth+1);
      }
      for(let i=0;i<points.length;i++) {
        const p=screen(positions[i]);
        if(i===0) {
          ctx.beginPath();ctx.arc(...p,5,0,TAU);ctx.fillStyle='#193f45';ctx.fill();
          ctx.strokeStyle='#a5eed9';ctx.lineWidth=1.5;ctx.stroke();
          ctx.beginPath();ctx.arc(...p,1.6,0,TAU);ctx.fillStyle='#b4f6df';ctx.fill();
        } else if(i===points.length-1) {
          ctx.beginPath();ctx.moveTo(p[0],p[1]-4.5);ctx.lineTo(p[0]+4.5,p[1]);ctx.lineTo(p[0],p[1]+4.5);
          ctx.lineTo(p[0]-4.5,p[1]);ctx.closePath();ctx.fillStyle='#264c50';ctx.fill();
          ctx.strokeStyle='#a4ecd8';ctx.lineWidth=1.5;ctx.stroke();
        } else {
          ctx.beginPath();ctx.arc(...p,2.7,0,TAU);ctx.fillStyle='#9ce9d3';ctx.fill();
        }
      }
      const modelScale=scale*glyph;
      const cache=[azimuth,elevation,modelScale,dpr].join(',');
      if(!sprite || cache!==spriteKey) {
        sprite=vehicleSprite(basis,modelScale,dpr);spriteKey=cache;
      }
      ctx.drawImage(sprite.surface,vehiclePoint[0]-sprite.size/2,vehiclePoint[1]-sprite.size/2,sprite.size,sprite.size);

      if(w>300 && h>200) {
        const center=[w-38,37];
        const axes=[
          { vector:[1,0,0], label:'X', color:'#df9b70' },
          { vector:[0,1,0], label:'Y', color:'#82c8b0' },
          { vector:[0,0,1], label:'Z', color:'#8bb5ce' }
        ];
        ctx.font='9px ui-monospace, Consolas, monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        for(const axis of axes) {
          const v=xy(axis.vector);
          if(Math.hypot(...v)<.23) continue;
          strokeLine(center,plus(center,times(v,15)),axis.color,1.25);
          ctx.fillStyle=axis.color;ctx.fillText(axis.label,...plus(center,times(v,22)));
        }
      }
    }

    function schedule() {
      if(!pending) pending=window.requestAnimationFrame(()=>{ pending=0;draw(); });
    }
    function render(newTrajectory, elapsedSeconds=0) {
      trajectory=newTrajectory;time=Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
      draw();
    }
    function setView(name) {
      if(name==='top'){azimuth=Math.PI/2;elevation=Math.PI/2;}
      else if(name==='side'){azimuth=Math.PI/2;elevation=.035;}
      else {azimuth=BASE_CAMERA.azimuth;elevation=BASE_CAMERA.elevation;}
      zoom=1;draw();
    }
    const reset=()=>setView('iso');
    function down(event) {
      if(event.button!==0 || drag) return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
    }
    function move(event) {
      if(!drag || event.pointerId!==drag.id) return;
      azimuth-=(event.clientX-drag.x)*.009;
      elevation=clamp(elevation+(event.clientY-drag.y)*.009,.025,Math.PI/2);
      drag.x=event.clientX;drag.y=event.clientY;schedule();
    }
    function up(event) {
      if(drag && event.pointerId===drag.id) {
        drag=null;canvas.style.cursor='grab';
        if(canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      }
    }
    function wheel(event) {
      event.preventDefault();
      const delta=clamp(event.deltaY*(event.deltaMode===1?16:1),-220,220);
      zoom=clamp(zoom*Math.exp(-delta*.0018),.45,2.75);schedule();
    }
    function key(event) {
      switch(event.key) {
        case 'ArrowLeft': azimuth-=.15;break;
        case 'ArrowRight': azimuth+=.15;break;
        case 'ArrowUp': elevation=clamp(elevation+.12,.025,Math.PI/2);break;
        case 'ArrowDown': elevation=clamp(elevation-.12,.025,Math.PI/2);break;
        case '+': case '=': zoom=clamp(zoom*1.1,.45,2.75);break;
        case '-': zoom=clamp(zoom/1.1,.45,2.75);break;
        case 'Home': reset();break;
        default: return;
      }
      event.preventDefault(); schedule();
    }
    const events=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['wheel',wheel,{passive:false}],['keydown',key]];
    events.forEach(args=>canvas.addEventListener(...args));
    if(window.ResizeObserver){observer=new ResizeObserver(schedule);observer.observe(canvas);}
    window.addEventListener('resize',schedule);
    function destroy(){
      events.forEach(args=>canvas.removeEventListener(...args));
      window.removeEventListener('resize',schedule);observer?.disconnect();window.cancelAnimationFrame(pending);
      sprite=null;drag=null;
    }
    schedule();
    return {render,setView,reset,destroy};
  }

  window.DiveScene={create};
})();
