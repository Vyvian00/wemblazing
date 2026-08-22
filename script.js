const anchors=[...document.querySelectorAll('.color-anchor')];
const projects=[...document.querySelectorAll('.project')];
const n1=document.querySelector('.n1');
const n2=document.querySelector('.n2');
const n3=document.querySelector('.n3');

const trajectory=document.getElementById('cometTrajectory');
const head=document.getElementById('cometHead');
const ribbon=document.getElementById('tailRibbon');
const lineA=document.getElementById('tailLineA');
const lineB=document.getElementById('tailLineB');
const cometStage=document.querySelector('.comet-stage');
const vectorStar=document.querySelector('.vector-star');

const mobileMotion=matchMedia('(max-width:760px)').matches;
const lowPowerMotion=matchMedia('(max-width:900px)').matches;

function rgb(hex){
  hex=hex.replace('#','');
  return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
}
function mix(a,b,t){
  return [
    Math.round(a[0]+(b[0]-a[0])*t),
    Math.round(a[1]+(b[1]-a[1])*t),
    Math.round(a[2]+(b[2]-a[2])*t)
  ];
}
function rgba(c,a){return `rgba(${c[0]},${c[1]},${c[2]},${a})`}
function smoothstep(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)}
function lerp(a,b,t){return a+(b-a)*t}

let anchorData=[];
let projectData=[];
let stageRatio=1;
let scrollMax=1;

function cacheLayout(){
  const sy=scrollY;
  anchorData=anchors.map(el=>{
    const r=el.getBoundingClientRect();
    return {
      y:sy+r.top+r.height/2,
      c1:rgb(el.dataset.c1),
      c2:rgb(el.dataset.c2),
      c3:rgb(el.dataset.c3)
    };
  }).sort((a,b)=>a.y-b.y);

  projectData=projects.map(project=>{
    const r=project.getBoundingClientRect();
    return {
      center:sy+r.top+r.height/2,
      height:r.height
    };
  });

  scrollMax=Math.max(1,document.documentElement.scrollHeight-innerHeight);

  if(cometStage){
    const rect=cometStage.getBoundingClientRect();
    const sx=Math.max(.001,rect.width/1000);
    const syScale=Math.max(.001,rect.height/1000);
    stageRatio=syScale/sx;
  }
}

let target={c1:rgb('#ff00c8'),c2:rgb('#6e20ff'),c3:rgb('#6cccf4')};
let current={c1:[255,0,200],c2:[110,32,255],c3:[108,204,244]};

function updateColorTarget(){
  const data=anchorData;
  if(!data.length) return;

  const y=scrollY+innerHeight*.5;
  let a=data[0],b=data[data.length-1];

  for(let i=0;i<data.length-1;i++){
    if(y>=data[i].y && y<=data[i+1].y){a=data[i];b=data[i+1];break}
    if(y<data[0].y){a=b=data[0];break}
    if(y>data[data.length-1].y){a=b=data[data.length-1];break}
  }

  const raw=b.y===a.y?0:(y-a.y)/(b.y-a.y);
  const t=smoothstep(raw);
  target.c1=mix(a.c1,b.c1,t);
  target.c2=mix(a.c2,b.c2,t);
  target.c3=mix(a.c3,b.c3,t);
}

function nearestProjectInfluence(){
  let influence=0;
  const viewportCenter=scrollY+innerHeight*.5;

  projectData.forEach(project=>{
    const d=Math.abs(project.center-viewportCenter);
    const radius=Math.max(innerHeight*.95,project.height*.78);
    const local=1-Math.min(1,d/radius);
    influence=Math.max(influence,smoothstep(local));
  });

  return influence;
}

/* Cache the SVG trajectory once.
   The old version called getTotalLength/getPointAtLength hundreds of times
   per frame. This lookup table keeps the same curve while making mobile
   rendering dramatically cheaper. */
let trajectoryLUT=[];
const LUT_SAMPLES=lowPowerMotion?220:420;

function cacheTrajectory(){
  if(!trajectory) return;
  const length=trajectory.getTotalLength();
  trajectoryLUT=[];

  for(let i=0;i<=LUT_SAMPLES;i++){
    const p=i/LUT_SAMPLES;
    const pt=trajectory.getPointAtLength(length*p);
    trajectoryLUT.push({x:pt.x,y:pt.y});
  }
}

function pointAtProgress(p){
  if(!trajectoryLUT.length) return {x:0,y:0};
  const clamped=Math.max(0,Math.min(1,p));
  const pos=clamped*LUT_SAMPLES;
  const i=Math.min(LUT_SAMPLES-1,Math.floor(pos));
  const f=pos-i;
  const a=trajectoryLUT[i];
  const b=trajectoryLUT[i+1]||a;
  return {x:lerp(a.x,b.x,f),y:lerp(a.y,b.y,f)};
}

function tangentAtProgress(p){
  const e=lowPowerMotion?.004:.0022;
  const a=pointAtProgress(Math.max(0,p-e));
  const b=pointAtProgress(Math.min(1,p+e));
  const dx=b.x-a.x,dy=b.y-a.y;
  const m=Math.hypot(dx,dy)||1;
  return {x:dx/m,y:dy/m};
}

let targetP=0;
let currentP=0;
let targetScale=.34;
let currentScale=.34;

function updateCometTarget(){
  targetP=Math.max(0,Math.min(1,scrollY/scrollMax));

  const projectNear=nearestProjectInfluence();
  targetScale=lerp(.30,1.05,projectNear);

  if(targetP>.84){
    const end=smoothstep((targetP-.84)/.16);
    targetScale=Math.max(targetScale,lerp(.30,.55,end));
  }
}

function buildTailPath(p,scale){
  const tailSpan=lerp(.12,.23,scale);
  const samples=mobileMotion?16:(lowPowerMotion?24:36);
  const pts=[];

  for(let i=0;i<samples;i++){
    const u=i/(samples-1);
    const q=Math.max(0,p-tailSpan*(1-u));
    const pt=pointAtProgress(q);
    const tan=tangentAtProgress(q);
    const nx=-tan.y,ny=tan.x;
    pts.push({x:pt.x,y:pt.y,nx,ny,u});
  }

  const left=[],right=[];
  pts.forEach(pt=>{
    const width=lerp(.055,6.0*scale,Math.pow(pt.u,2.35));
    left.push([pt.x+pt.nx*width,pt.y+pt.ny*width]);
    right.push([pt.x-pt.nx*width,pt.y-pt.ny*width]);
  });

  let d=`M ${left[0][0].toFixed(2)} ${left[0][1].toFixed(2)}`;
  for(let i=1;i<left.length;i++) d+=` L ${left[i][0].toFixed(2)} ${left[i][1].toFixed(2)}`;
  for(let i=right.length-1;i>=0;i--) d+=` L ${right[i][0].toFixed(2)} ${right[i][1].toFixed(2)}`;
  d+=' Z';

  const linePath=(offset=0)=>{
    let s='';
    pts.forEach((pt,i)=>{
      const env=Math.sin(Math.PI*pt.u);
      const o=offset*env;
      const x=pt.x+pt.nx*o;
      const y=pt.y+pt.ny*o;
      s+=(i===0?'M':' L')+` ${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    return s;
  };

  return {
    ribbon:d,
    lineA:linePath(1.1*scale),
    lineB:linePath(-1.6*scale)
  };
}

function renderComet(){
  const follow=mobileMotion?.085:.040;
  const scaleFollow=mobileMotion?.075:.050;

  currentP+=(targetP-currentP)*follow;
  currentScale+=(targetScale-currentScale)*scaleFollow;

  const pt=pointAtProgress(currentP);
  const starSize=lerp(.72,1.18,currentScale);

  const rx=20*starSize*stageRatio;
  const ry=20*starSize;
  const cx=pt.x,cy=pt.y;
  const innerX=rx*.22;
  const innerY=ry*.22;

  const starD=[
    `M ${cx} ${cy-ry}`,
    `L ${cx+innerX} ${cy-innerY}`,
    `L ${cx+rx} ${cy}`,
    `L ${cx+innerX} ${cy+innerY}`,
    `L ${cx} ${cy+ry}`,
    `L ${cx-innerX} ${cy+innerY}`,
    `L ${cx-rx} ${cy}`,
    `L ${cx-innerX} ${cy-innerY}`,
    'Z'
  ].join(' ');

  vectorStar.setAttribute('d',starD);

  const tail=buildTailPath(currentP,currentScale);
  ribbon.setAttribute('d',tail.ribbon);
  lineA.setAttribute('d',tail.lineA);
  lineB.setAttribute('d',tail.lineB);

  if(mobileMotion){
    /* SVG turbulence/displacement + live full-stage blur are expensive on
       mobile GPUs. Keep the exact geometry and colour, remove only the
       costly optical treatment. */
    head.style.filter='none';
    ribbon.style.filter='none';
    lineA.style.filter='none';
    lineB.style.filter='none';
    cometStage.style.filter='none';
  }else{
    const near=Math.max(0,Math.min(1,(currentScale-.30)/.75));
    const far=1-near;
    const blur=far*1.25;

    [head,ribbon,lineA,lineB].forEach(el=>{
      el.style.opacity='1';
      el.style.filter=far>.18?'url(#cometDistanceFX)':'none';
    });

    cometStage.style.filter=`blur(${blur.toFixed(2)}px)`;
  }
}

const orbitLayer=document.querySelector('.wem-orbit-layer');
const shootingLines=[...document.querySelectorAll('.shoot-line')];

function updateShootingLines(){
  if(!shootingLines.length) return;

  const p=Math.max(0,Math.min(1,scrollY/scrollMax));

  shootingLines.forEach((line,i)=>{
    const phase=i*.055;
    let opacity=0;
    let blur=1.8;
    let x=0;
    let y=0;

    if(p<.26){
      const local=Math.max(0,Math.min(1,(p-phase)/.24));
      const t=smoothstep(local);
      opacity=(1-smoothstep((t-.64)/.36))*.58;
      blur=lerp(2.25,1.15,t);
      x=lerp(170+i*42,-155-i*34,t);
      y=lerp(-95-i*28,145+i*30,t);
    }else if(p<.76){
      opacity=0;
      x=-155-i*34;
      y=145+i*30;
    }else{
      const local=Math.max(0,Math.min(1,(p-.76-phase*.25)/.22));
      const t=smoothstep(local);
      const fadeIn=smoothstep(t/.24);
      const fadeOut=1-smoothstep((t-.86)/.14);
      opacity=fadeIn*fadeOut*.82;
      blur=lerp(1.15,.12,t);
      x=lerp(140+i*34,-120-i*28,t);
      y=lerp(-72-i*18,118+i*22,t);
    }

    line.style.opacity=opacity.toFixed(3);
    line.style.filter=mobileMotion?'none':`blur(${blur.toFixed(2)}px)`;
    line.style.transform=`translate3d(${x}px,${y}px,0)`;
  });
}

function updateOrbitDepth(){
  if(!orbitLayer) return;

  const p=Math.max(0,Math.min(1,scrollY/scrollMax));
  const leaveStart=smoothstep((p-.07)/.16);
  const approachEnd=1-smoothstep((p-.73)/.18);
  const middle=Math.max(0,Math.min(1,leaveStart*approachEnd));

  const opacity=lerp(.96,.34,middle);
  orbitLayer.style.setProperty('--orbit-opacity',opacity.toFixed(3));

  if(!mobileMotion){
    orbitLayer.style.setProperty('--orbit-blur',`${(middle*4.6).toFixed(2)}px`);
  }
}

let scrollDirty=true;
let resizeTimer=0;
let frameCount=0;

function updateTargets(){
  updateColorTarget();
  updateCometTarget();
}

function frame(){
  if(scrollDirty){
    updateTargets();
    scrollDirty=false;
  }

  updateOrbitDepth();
  updateShootingLines();

  const colorEase=mobileMotion?.075:.038;
  ['c1','c2','c3'].forEach(k=>{
    for(let i=0;i<3;i++) current[k][i]+=(target[k][i]-current[k][i])*colorEase;
  });

  /* Slow ambient colour changes do not need a full-screen repaint on every
     mobile frame. The comet still renders every frame. */
  const paintNebula=!mobileMotion || frameCount%3===0;
  if(paintNebula){
    n1.style.background=`radial-gradient(circle at 50% 50%,${rgba(current.c1,.88)},${rgba(current.c2,.44)} 38%,transparent 70%)`;
    n2.style.background=`radial-gradient(circle at 50% 50%,${rgba(current.c3,.74)},${rgba(current.c2,.24)} 44%,transparent 73%)`;
    n3.style.background=`radial-gradient(circle at 50% 50%,${rgba(current.c2,.52)},${rgba(current.c1,.16)} 42%,transparent 74%)`;
  }

  renderComet();
  frameCount++;
  requestAnimationFrame(frame);
}

function onScroll(){
  scrollDirty=true;
}

function onResize(){
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    cacheLayout();
    scrollDirty=true;
  },120);
}

if(trajectory && head && ribbon && lineA && lineB && vectorStar && cometStage && n1 && n2 && n3){
  cacheTrajectory();
  cacheLayout();

  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onResize,{passive:true});

  scrollDirty=true;
  frame();
}


// v20 — Formspree AJAX submission with inline status.
const projectForm=document.getElementById('project-form');
const formStatus=document.getElementById('form-status');

if(projectForm && formStatus){
  projectForm.addEventListener('submit',async (e)=>{
    e.preventDefault();

    formStatus.textContent='';
    projectForm.classList.remove('is-success');

    const required=[...projectForm.querySelectorAll('[required]')];
    let valid=true;

    required.forEach(field=>{
      field.classList.remove('field-error');
      if(!field.value || !field.checkValidity()){
        field.classList.add('field-error');
        valid=false;
      }
    });

    if(!valid){
      formStatus.textContent='Please complete the required fields.';
      return;
    }

    const button=projectForm.querySelector('button[type="submit"]');
    const original=button.innerHTML;
    projectForm.classList.add('is-sending');
    button.innerHTML='SENDING…';

    try{
      const response=await fetch(projectForm.action,{
        method:'POST',
        body:new FormData(projectForm),
        headers:{'Accept':'application/json'}
      });

      if(response.ok){
        projectForm.reset();
        projectForm.classList.add('is-success');
        formStatus.textContent='Brief received. Let’s make something remarkable. ✦';
        button.innerHTML='BRIEF SENT ✓';

        setTimeout(()=>{
          button.innerHTML=original;
          projectForm.classList.remove('is-success');
        },4500);
      }else{
        const data=await response.json().catch(()=>({}));
        const message=data?.errors?.map(err=>err.message).join(' ') || 'Something went wrong. Please try again.';
        formStatus.textContent=message;
        button.innerHTML=original;
      }
    }catch(err){
      formStatus.textContent='Unable to send right now. Please try again in a moment.';
      button.innerHTML=original;
    }finally{
      projectForm.classList.remove('is-sending');
    }
  });

  projectForm.addEventListener('input',(e)=>{
    if(e.target.matches('[required]')) e.target.classList.remove('field-error');
  });
}
