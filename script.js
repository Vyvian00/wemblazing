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

function getAnchorData(){
  return anchors.map(el=>{
    const r=el.getBoundingClientRect();
    return {
      y:scrollY+r.top+r.height/2,
      c1:rgb(el.dataset.c1),
      c2:rgb(el.dataset.c2),
      c3:rgb(el.dataset.c3)
    };
  }).sort((a,b)=>a.y-b.y);
}

let target={c1:rgb('#ff00c8'),c2:rgb('#6e20ff'),c3:rgb('#6cccf4')};
let current={c1:[255,0,200],c2:[110,32,255],c3:[108,204,244]};

function updateColorTarget(){
  const data=getAnchorData();
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
  projects.forEach(project=>{
    const r=project.getBoundingClientRect();
    const center=r.top+r.height/2;
    const d=Math.abs(center-innerHeight*.5);
    const radius=Math.max(innerHeight*.95,r.height*.78);
    const local=1-Math.min(1,d/radius);
    influence=Math.max(influence,smoothstep(local));
  });
  return influence;
}

const pathLen=()=>trajectory.getTotalLength();
let targetP=0;
let currentP=0;
let targetScale=.34;
let currentScale=.34;
let targetOpacity=1;
let currentOpacity=1;

function updateCometTarget(){
  const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  targetP=Math.max(0,Math.min(1,scrollY/max));

  const projectNear=nearestProjectInfluence();
  targetScale=lerp(.30,1.05,projectNear);
  targetOpacity=1;

  // small elegant return in the final contact
  if(targetP>.84){
    const end=smoothstep((targetP-.84)/.16);
    targetScale=Math.max(targetScale,lerp(.30,.55,end));
    targetOpacity=1;
  }
}

function pointAtProgress(p){
  const L=pathLen();
  const clamped=Math.max(0,Math.min(1,p));
  return trajectory.getPointAtLength(L*clamped);
}

function tangentAtProgress(p){
  const e=.0016;
  const a=pointAtProgress(Math.max(0,p-e));
  const b=pointAtProgress(Math.min(1,p+e));
  const dx=b.x-a.x,dy=b.y-a.y;
  const m=Math.hypot(dx,dy)||1;
  return {x:dx/m,y:dy/m,angle:Math.atan2(dy,dx)*180/Math.PI};
}

function buildTailPath(p,scale){
  const tailSpan=lerp(.12,.23,scale);   // longer when near the projects
  const samples=48;
  const pts=[];

  for(let i=0;i<samples;i++){
    const u=i/(samples-1);
    const q=Math.max(0,p-tailSpan*(1-u));
    const pt=pointAtProgress(q);
    const tan=tangentAtProgress(q);

    // Follow the trajectory itself. No artificial wave:
    // the elegance now comes from the large-radius Bézier curve.
    const nx=-tan.y,ny=tan.x;
    pts.push({x:pt.x,y:pt.y,nx,ny,u});
  }

  // Tapered filled ribbon: almost hairline at the far end, fuller near the star.
  const left=[],right=[];
  pts.forEach((pt,i)=>{
    const u=pt.u;
    const width=lerp(.055,6.0*scale,Math.pow(u,2.35));
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
      const u=pt.u;
      const env=Math.sin(Math.PI*u);
      const o=offset*env;
      const x=pt.x+pt.nx*o,y=pt.y+pt.ny*o;
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
  currentP += (targetP-currentP)*.028;
  currentScale += (targetScale-currentScale)*.035;
  currentOpacity = 1;

  const pt=pointAtProgress(currentP);
  const tan=tangentAtProgress(currentP);

  const starSize=lerp(.72,1.18,currentScale);

  // Draw the star directly at the tail endpoint.
  // Because preserveAspectRatio="none" stretches X and Y differently,
  // compensate X so all four tips remain equally distant from the centre on screen.
  const stage=document.querySelector('.comet-stage');
  const rect=stage.getBoundingClientRect();
  const sx=Math.max(.001,rect.width/1000);
  const sy=Math.max(.001,rect.height/1000);
  const rx=20*starSize*(sy/sx);
  const ry=20*starSize;
  const cxStar=pt.x, cyStar=pt.y;
  const k=.36;

  const innerX=rx*.22;
  const innerY=ry*.22;
  const starD=[
    `M ${cxStar} ${cyStar-ry}`,
    `L ${cxStar+innerX} ${cyStar-innerY}`,
    `L ${cxStar+rx} ${cyStar}`,
    `L ${cxStar+innerX} ${cyStar+innerY}`,
    `L ${cxStar} ${cyStar+ry}`,
    `L ${cxStar-innerX} ${cyStar+innerY}`,
    `L ${cxStar-rx} ${cyStar}`,
    `L ${cxStar-innerX} ${cyStar-innerY}`,
    `Z`
  ].join(' ');
  document.querySelector('.vector-star').setAttribute('d',starD);
  head.removeAttribute('transform');

  const tail=buildTailPath(currentP,currentScale);
  ribbon.setAttribute('d',tail.ribbon);
  lineA.setAttribute('d',tail.lineA);
  lineB.setAttribute('d',tail.lineB);

  // No transparency: depth comes from scale + slight optical softness.
  const near=Math.max(0,Math.min(1,(currentScale-.30)/(.75)));
  const far=1-near;
  const blur=far*1.25;

  [head,ribbon,lineA,lineB].forEach(el=>{
    el.style.opacity='1';
    el.style.filter=far>.18 ? 'url(#cometDistanceFX)' : 'none';
  });

  // SVG filter supplies a tiny irregular/grain edge. CSS blur adds distance softness.
  document.querySelector('.comet-stage').style.filter=`blur(${blur.toFixed(2)}px)`;
}


const orbitLayer=document.querySelector('.wem-orbit-layer');






const shootingLines=[...document.querySelectorAll('.shoot-line')];

function updateShootingLines(){
  if(!shootingLines.length) return;

  const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  const p=Math.max(0,Math.min(1,scrollY/max));

  shootingLines.forEach((line,i)=>{
    const phase=i*.055;

    let opacity=0;
    let blur=1.8;
    let x=0;
    let y=0;

    if(p < .26){
      // Opening pass: upper-right -> lower-left.
      const local=Math.max(0,Math.min(1,(p-phase)/.24));
      const t=smoothstep(local);

      opacity=(1-smoothstep((t-.64)/.36))*.58;
      blur=lerp(2.25,1.15,t);

      // Start outside / near upper-right, end lower-left.
      x=lerp(170 + i*42, -155 - i*34, t);
      y=lerp(-95 - i*28, 145 + i*30, t);

    }else if(p < .76){
      // Portfolio: fully gone.
      opacity=0;
      blur=2.4;
      x=-155 - i*34;
      y=145 + i*30;

    }else{
      // Form: reappear and repeat the same directional language.
      const local=Math.max(0,Math.min(1,(p-.76-phase*.25)/.22));
      const t=smoothstep(local);

      // Fade in, cross, then fade slightly as they pass.
      const fadeIn=smoothstep(t/.24);
      const fadeOut=1-smoothstep((t-.86)/.14);
      opacity=fadeIn*fadeOut*.82;

      // They return crisp and thin at the form.
      blur=lerp(1.15,.12,t);

      x=lerp(140 + i*34, -120 - i*28, t);
      y=lerp(-72 - i*18, 118 + i*22, t);
    }

    line.style.opacity=opacity.toFixed(3);
    line.style.filter=`blur(${blur.toFixed(2)}px)`;
    line.style.transform=`translate(${x}px,${y}px)`;
  });
}

function updateOrbitDepth(){
  if(!orbitLayer) return;
  const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  const p=Math.max(0,Math.min(1,scrollY/max));

  // 0 at beginning/end, 1 through the portfolio middle.
  const leaveStart=smoothstep((p-.07)/.16);
  const approachEnd=1-smoothstep((p-.73)/.18);
  const middle=Math.max(0,Math.min(1,leaveStart*approachEnd));

  const blur=middle*4.6;
  const opacity=lerp(.96,.34,middle);
  orbitLayer.style.setProperty('--orbit-blur',`${blur.toFixed(2)}px`);
  orbitLayer.style.setProperty('--orbit-opacity',opacity.toFixed(3));
}

function frame(){
  updateOrbitDepth();
  updateShootingLines();
  const colorEase=.038;
  ['c1','c2','c3'].forEach(k=>{
    for(let i=0;i<3;i++) current[k][i]+=(target[k][i]-current[k][i])*colorEase;
  });

  n1.style.background=`radial-gradient(circle at 50% 50%,${rgba(current.c1,.88)},${rgba(current.c2,.44)} 38%,transparent 70%)`;
  n2.style.background=`radial-gradient(circle at 50% 50%,${rgba(current.c3,.74)},${rgba(current.c2,.24)} 44%,transparent 73%)`;
  n3.style.background=`radial-gradient(circle at 50% 50%,${rgba(current.c2,.52)},${rgba(current.c1,.16)} 42%,transparent 74%)`;

  renderComet();
  requestAnimationFrame(frame);
}

function updateAll(){
  updateColorTarget();
  updateCometTarget();
}

if (trajectory && head && ribbon && lineA && lineB && n1 && n2 && n3) {
  addEventListener('scroll', updateAll, {passive:true});
  addEventListener('resize', updateAll);
  updateAll();
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
