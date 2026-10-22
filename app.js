/* ============ 中毅学习打卡 · 应用逻辑 ============ */
(function(){
  "use strict";
  const D = window.STUDY_DATA;
  const REVIEW_GAPS = [1, 3, 7, 15, 30]; // 间隔复习：学会后第1/3/7/15/30天复习
  const STORE_KEY = "zhongyi_study_v1";
  const PER_PAGE = 24;

  /* ---------- 状态 ---------- */
  function loadState(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch(e){ return {}; }
  }
  let state = loadState();
  state.checkins = state.checkins || {};
  state.items = state.items || {};
  state.videos = state.videos || {};
  state.settings = state.settings || { dailyGoal: 15 };

  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  /* ---------- 日期工具 ---------- */
  function fmt(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
    return y+"-"+m+"-"+da;
  }
  function today(){ return fmt(new Date()); }
  function addDays(s,n){ const d=new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return fmt(d); }
  const WK = ["日","一","二","三","四","五","六"];

  /* ---------- 条目状态 ---------- */
  function statusOf(key){
    const it = state.items[key];
    if(!it || !it.learned) return "new";
    if(it.stage >= REVIEW_GAPS.length) return "mastered";
    return "review";
  }
  function catOfKey(key){ return key.indexOf("poem")===0 ? "poems" : key.indexOf("word")===0 ? "words" : "idioms"; }

  /* ---------- 打卡 ---------- */
  function doCheckin(){
    const t = today();
    if(state.checkins[t]){ toast("今天已经打卡啦 🎉"); return; }
    state.checkins[t] = 1; save(); renderHome();
    toast("打卡成功，继续保持！🔥");
  }
  function streak(){
    let s=0; const d=new Date();
    if(!state.checkins[fmt(d)]) d.setDate(d.getDate()-1);
    while(state.checkins[fmt(d)]){ s++; d.setDate(d.getDate()-1); }
    return s;
  }
  function totalDays(){ return Object.keys(state.checkins).length; }

  /* ---------- 学习 / 复习 ---------- */
  function learnItem(key){
    const it = state.items[key] || { learned:null, stage:0, next:null };
    const t = today();
    if(!it.learned){ it.learned = t; it.stage = 0; it.next = addDays(t, REVIEW_GAPS[0]); }
    state.items[key] = it; save();
    toast("已标记为学会，加入复习计划 📅");
    if(modalKey===key) refreshModal();
    renderHome();
  }
  function reviewItem(key){
    const it = state.items[key]; if(!it || !it.learned) return;
    const t = today();
    if(it.stage < REVIEW_GAPS.length){
      it.stage++;
      it.next = it.stage < REVIEW_GAPS.length ? addDays(t, REVIEW_GAPS[it.stage]) : null;
    }
    state.items[key] = it; save();
    toast(it.next ? ("复习完成，下次：" + it.next) : "已掌握，太棒了！🌟");
    if(modalKey===key) refreshModal();
    renderHome();
  }
  function resetItem(key){
    delete state.items[key]; save();
    toast("已重置为未学");
    if(modalKey===key) refreshModal();
    renderHome();
  }

  /* ---------- 今日计划 ---------- */
  function dueReviews(){
    const t = today(); const out=[];
    for(const k in state.items){
      const it = state.items[k];
      if(it.learned && it.next && it.next <= t && it.stage < REVIEW_GAPS.length) out.push(k);
    }
    return out;
  }
  function unlearned(){
    const all = D.poems.concat(D.words, D.idioms);
    return all.filter(x => { const it=state.items[x.key]; return !it || !it.learned; })
              .sort((a,b)=> a.key < b.key ? -1 : 1);
  }
  function todayPlan(){
    const goal = state.settings.dailyGoal;
    const due = dueReviews();
    const pool = unlearned();
    const extra = pool.slice(0, Math.max(0, goal - due.length)).map(x=>x.key);
    return { due, extra };
  }

  /* ---------- 分类统计 ---------- */
  function catStats(){
    const defs = [
      {name:"poems", arr:D.poems, color:"#e0795b", label:"诗词"},
      {name:"words", arr:D.words, color:"#2faa8a", label:"单词"},
      {name:"idioms", arr:D.idioms, color:"#9b6bd6", label:"成语"},
    ];
    return defs.map(c=>{
      const learned = c.arr.filter(x=>{ const s=statusOf(x.key); return s==="mastered"||s==="review"; }).length;
      return { name:c.name, arr:c.arr, color:c.color, label:c.label, learned, total:c.arr.length, pct: learned/c.arr.length };
    });
  }

  /* ---------- 工具 ---------- */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function uniq(arr,key){ return Array.from(new Set(arr.map(x=>x[key]).filter(Boolean))); }
  function toast(msg){
    const t=document.getElementById("toast"); t.textContent=msg; t.hidden=false;
    clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true, 1900);
  }

  function ring(pct,color,label,sub){
    const r=32, c=2*Math.PI*r, off=c*(1-pct);
    return `<div class="ring" style="position:relative;width:96px">
      <svg width="96" height="96"><circle cx="48" cy="48" r="${r}" stroke="#eef1f6" stroke-width="9" fill="none"/>
      <circle cx="48" cy="48" r="${r}" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">${Math.round(pct*100)}%</div>
      <div class="rl">${label}<br><span style="opacity:.7">${sub||""}</span></div>
    </div>`;
  }

  /* ============ 首页 ============ */
  function renderHome(){
    const t = today();
    const cs = catStats();
    const overall = cs.reduce((a,b)=>a+b.learned,0) / cs.reduce((a,b)=>a+b.total,0);
    const s = streak();
    const td = totalDays();
    const learnedCount = cs.reduce((a,b)=>a+b.learned,0);
    const plan = todayPlan();

    const planHtml = function(){
      if(plan.due.length===0 && plan.extra.length===0)
        return `<div class="empty">🎉 今日计划已完成，或资料已全部学完！</div>`;
      const item = (key,kind)=>{
        const cat=catOfKey(key); const arr=D[cat==="poems"?"poems":cat==="words"?"words":"idioms"];
        const it = arr.find(x=>x.key===key);
        let title, sub;
        if(cat==="poems"){ title=it.title; sub=(it.author||"")+(it.dynasty?" · "+it.dynasty:""); }
        else if(cat==="words"){ title=it.text+" "+it.phonetic; sub=it.cn+" · "+it.grade; }
        else { title=it.word; sub=it.explanation.slice(0,28)+" · "+it.grade; }
        return `<div class="plan-item">
          <span class="badge ${kind==='due'?'do':'new'}">${kind==='due'?'待复习':'新学'}</span>
          <div class="pi-main"><div class="pi-t">${esc(title)}</div><div class="pi-s">${esc(sub)}</div></div>
          <button class="mini-btn" data-go="${key}">去学习</button>
        </div>`;
      };
      return plan.due.map(k=>item(k,"due")).concat(plan.extra.map(k=>item(k,"new"))).join("");
    };

    const v = document.getElementById("view-home");
    v.innerHTML = `
      <div class="dash">
        <div>
          <div class="panel" style="margin-bottom:18px">
            <h3>📅 今日打卡</h3>
            <button id="checkin-btn" class="checkin-btn ${state.checkins[t]?'done':''}">
              ${state.checkins[t]?"✅ 今日已打卡":"点击打卡 · 今日 "+t}
            </button>
            <div class="stat-row" style="margin-top:16px">
              <div class="stat"><div class="v" style="color:var(--brand)">🔥 ${s}</div><div class="k">连续打卡(天)</div></div>
              <div class="stat"><div class="v">⭐ ${learnedCount}</div><div class="k">已点亮星星</div></div>
              <div class="stat"><div class="v" style="color:var(--ok)">${Math.round(overall*100)}%</div><div class="k">总完成度</div></div>
              <div class="stat"><div class="v">${td}</div><div class="k">累计打卡(天)</div></div>
            </div>
          </div>
          <div class="panel">
            <h3>🎯 今日学习计划 <span style="font-size:12px;color:var(--muted);font-weight:400">（每日目标 ${state.settings.dailyGoal} 条）</span></h3>
            ${planHtml()}
          </div>
        </div>
        <div>
          <div class="panel" style="margin-bottom:18px">
            <h3>📊 各模块完成度</h3>
            <div class="rings">
              ${ring(overall,"#3b6ef5","总进度",cs.reduce((a,b)=>a+b.learned,0)+"/"+cs.reduce((a,b)=>a+b.total,0))}
              ${cs.map(c=>ring(c.pct,c.color,c.label,c.learned+"/"+c.total)).join("")}
            </div>
          </div>
          <div class="panel">
            <h3>🔥 打卡日历</h3>
            ${heatmap()}
            <div class="legend">近 120 天打卡情况 · 蓝色为已打卡</div>
          </div>
        </div>
      </div>`;

    document.getElementById("checkin-btn").onclick = doCheckin;
    v.querySelectorAll("[data-go]").forEach(b=> b.onclick = ()=> openPlanItem(b.dataset.go));
  }

  function heatmap(){
    const n=120; const today=new Date(); let cells="";
    for(let i=n-1;i>=0;i--){
      const d=new Date(today); d.setDate(d.getDate()-i);
      const s=fmt(d); const on=state.checkins[s];
      cells += `<div class="d ${on?'on':''}" title="${s}${on?' 已打卡':''}"></div>`;
    }
    return `<div class="heat">${cells}</div>`;
  }

  function openPlanItem(key){
    const cat = catOfKey(key);
    switchView(cat);
    const list = currentList[cat];
    const idx = list.findIndex(x=>x.key===key);
    if(idx>=0){ filters[cat].page = Math.floor(idx / PER_PAGE); paintGrid(cat); }
    openModal(cat, key);
  }

  /* ============ 模块（诗词/单词/成语） ============ */
  const filters = { poems:{q:"",f1:"",page:0}, words:{q:"",f1:"",page:0}, idioms:{q:"",f1:"",page:0} };
  const currentList = { poems:[], words:[], idioms:[] };

  function filterOptions(cat){
    if(cat==="poems") return [ {k:"dynasty",label:"朝代",vals:uniq(D.poems,"dynasty")}, {k:"form",label:"体裁",vals:uniq(D.poems,"form")} ];
    if(cat==="words") return [ {k:"grade",label:"年级",vals:uniq(D.words,"grade")}, {k:"unit",label:"单元",vals:uniq(D.words,"unit")} ];
    return [ {k:"grade",label:"年级",vals:uniq(D.idioms,"grade")} ];
  }

  function filtered(cat){
    const f = filters[cat];
    let arr = D[cat];
    if(f.f1) arr = arr.filter(x=> x[f.f1key] === f.f1);
    if(f.q){
      const q = f.q.toLowerCase();
      arr = arr.filter(x=> JSON.stringify(x).toLowerCase().indexOf(q) >= 0);
    }
    return arr;
  }

  function renderModule(cat){
    const v = document.getElementById("view-"+cat);
    const opts = filterOptions(cat);
    const f = filters[cat];
    if(!f.f1key && opts[0]) f.f1key = opts[0].k;

    const toolbar = `
      <div class="toolbar">
        <input type="search" id="${cat}-q" placeholder="搜索…" value="${esc(f.q)}">
        ${opts.map(o=>`<select id="${cat}-sel-${o.k}" data-key="${o.k}">
            <option value="">${o.label}：全部</option>
            ${o.vals.map(val=>`<option value="${esc(val)}" ${f.f1key===o.k&&f.f1===val?'selected':''}>${esc(val)}</option>`).join("")}
          </select>`).join("")}
        <span class="spacer"></span>
        <span id="${cat}-count" style="color:var(--muted);font-size:13px"></span>
      </div>`;

    v.innerHTML = toolbar + `<div class="grid" id="${cat}-grid"></div>
      <div class="pager"><button id="${cat}-prev">上一页</button><span class="pginfo" id="${cat}-pinfo"></span><button id="${cat}-next">下一页</button></div>`;

    // events
    v.querySelector("#"+cat+"-q").oninput = e=>{ f.q=e.target.value; f.page=0; paintGrid(cat); };
    opts.forEach(o=>{
      v.querySelector("#"+cat+"-sel-"+o.k).onchange = e=>{ f.f1key=o.k; f.f1=e.target.value; f.page=0; paintGrid(cat); };
    });
    v.querySelector("#"+cat+"-prev").onclick = ()=>{ f.page=Math.max(0,f.page-1); paintGrid(cat); };
    v.querySelector("#"+cat+"-next").onclick = ()=>{ f.page++; paintGrid(cat); };

    paintGrid(cat);
  }

  function paintGrid(cat){
    const f = filters[cat];
    const list = filtered(cat);
    currentList[cat] = list;
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    f.page = Math.min(f.page, pages-1);
    const slice = list.slice(f.page*PER_PAGE, (f.page+1)*PER_PAGE);
    const grid = document.getElementById(cat+"-grid");
    grid.innerHTML = slice.map(item=> cardHtml(cat, item)).join("");
    grid.querySelectorAll("[data-key]").forEach(c=> c.onclick = ()=> openModal(cat, c.dataset.key));
    document.getElementById(cat+"-count").textContent = "共 "+list.length+" 条";
    document.getElementById(cat+"-pinfo").textContent = (f.page+1)+" / "+pages;
    document.getElementById(cat+"-prev").disabled = f.page===0;
    document.getElementById(cat+"-next").disabled = f.page>=pages-1;
  }

  function cardHtml(cat, item){
    const st = statusOf(item.key);
    const badge = st==="new" ? `<span class="badge new">未学</span>`
               : st==="mastered" ? `<span class="badge done">已掌握</span>`
               : `<span class="badge do">复习中</span>`;
    let title, sub, tags="";
    if(cat==="poems"){
      title = item.title; sub = (item.author||"")+(item.dynasty?" · "+item.dynasty:"");
      tags = (item.tags||[]).slice(0,3).map(t=>`<span class="c-tag">${esc(t)}</span>`).join("");
    } else if(cat==="words"){
      title = item.text; sub = (item.phonetic?item.phonetic+" · ":"")+item.cn;
    } else {
      title = item.word; sub = item.grade + " · " + item.explanation.slice(0,30);
    }
    return `<div class="card" data-key="${item.key}">${badge}
      <div class="c-title">${esc(title)}</div>
      <div class="c-sub">${esc(sub)}</div>${tags}</div>`;
  }

  /* ============ 详情弹窗 + 视频 ============ */
  let modalCat=null, modalKey=null;

  function videoQuery(cat, item){
    if(cat==="poems") return (item.title||"")+" "+(item.author||"")+" 朗诵赏析";
    if(cat==="words") return (item.text||"")+" 单词发音 跟读";
    return (item.word||"")+" 成语故事 解释";
  }

  // 把任意视频链接转成可内嵌 / 需跳转 的形式（支持 B站 / YouTube / 抖音 等）
  function videoEmbed(url){
    try{
      const bvm = url.match(/BV[0-9A-Za-z]+/);
      if(bvm) return { type:"iframe", src:"https://player.bilibili.com/player.html?bvid="+bvm[0]+"&page=1&high_quality=1&autoplay=0" };
      const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
      if(yt) return { type:"iframe", src:"https://www.youtube.com/embed/"+yt[1] };
      return { type:"link", src:url };
    }catch(e){ return { type:"link", src:url }; }
  }

  function saveVideo(key, url){
    url = (url||"").trim();
    if(!url){ toast("请先粘贴视频链接"); return; }
    state.videos[key] = url; save(); toast("已保存你的视频链接 ⭐");
    refreshModal();
  }
  function delVideo(key){
    delete state.videos[key]; save(); toast("已删除自定义视频"); refreshModal();
  }

  function openModal(cat, key){
    modalCat=cat; modalKey=key; testMode=false;
    document.getElementById("modal").hidden=false;
    document.body.style.overflow="hidden";
    refreshModal();
  }
  function closeModal(){
    document.getElementById("modal").hidden=true;
    document.body.style.overflow="";
    modalCat=null; modalKey=null;
  }
  let testMode=false;
  function speak(text, lang){
    try{
      if(!('speechSynthesis' in window)){ toast('当前浏览器不支持朗读'); return; }
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang=lang; u.rate=0.9; u.pitch=1;
      window.speechSynthesis.speak(u);
    }catch(e){ toast('朗读不可用'); }
  }
  function speakFor(cat,item){
    if(cat==='words') speak(item.text,'en-US');
    else if(cat==='poems') speak(item.content,'zh-CN');
    else speak(item.word+'。'+item.explanation,'zh-CN');
  }
  function refreshModal(){
    if(!modalKey) return;
    const cat=modalCat, key=modalKey;
    const arr=D[cat]; const item=arr.find(x=>x.key===key);
    const st=statusOf(key);
    const it=state.items[key];

    const metaMap = cat==='poems'
      ? `${esc(item.author||"")}${item.dynasty?" · "+esc(item.dynasty):""}${item.form?" · "+esc(item.form):""}`
      : cat==='words' ? `${esc(item.grade)} · ${esc(item.unit)}` : `${esc(item.grade)}`;
    const header = `<div class="m-title">${esc(item.title||item.text||item.word)}</div>
        <div class="m-meta">${metaMap}</div>`;

    let contentText="", tags="";
    if(cat==="poems"){ contentText=item.content; tags=`<div class="m-tags">${(item.tags||[]).map(t=>`<span class="c-tag">${esc(t)}</span>`).join("")}</div>`; }
    else if(cat==="words"){ contentText=(item.phonetic||"")+"\n\n"+item.cn; }
    else { contentText=item.explanation; }

    // 主动回忆：盖住答案，先自己想，再显示
    const contentWrap = `<div class="m-content-wrap">
        <div class="m-content">${esc(contentText)}</div>
        <div class="test-overlay" id="m-overlay" ${testMode?'':'hidden'}>
          <div class="ot">先自己想一想 / 背一背 👀</div>
          <button class="btn btn-primary" id="m-showans">显示答案</button>
        </div>
      </div>${tags}`;

    // 视频区：优先用你保存的链接（支持 B站/YouTube 内嵌，抖音等跳转），并保留 B站搜索 / YouTube 选项
    const q = videoQuery(cat, item);
    const yt = "https://www.youtube.com/embed?listType=search&list="+encodeURIComponent(q);
    const bili = "https://search.bilibili.com/all?keyword="+encodeURIComponent(q);
    const saved = state.videos[key];
    let savedHtml = "";
    if(saved){
      const emb = videoEmbed(saved);
      savedHtml = `<div class="saved-video">
          <div class="sv-head"><span>📺 我的视频 ${emb.type==='iframe'?'（已内嵌播放）':'（点击打开）'}</span>
            <button class="mini-btn sv-del" id="m-vdel">删除</button></div>
          ${emb.type==='iframe'
            ? `<div class="video-frame"><iframe src="${emb.src}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
            : `<a class="bili-btn" href="${esc(saved)}" target="_blank" rel="noopener">▶ 打开视频（抖音 / 其他平台）</a>`}
        </div>`;
    }
    const addForm = `<details class="add-video">
        <summary>➕ 添加视频链接（抖音 / B站 / YouTube 等）</summary>
        <div class="av-row">
          <input id="m-vurl" type="url" placeholder="粘贴视频链接，如 https://v.douyin.com/... 或 B站/YouTube"
                 value="${saved?esc(saved):''}">
          <button class="mini-btn" id="m-vsave">保存</button>
        </div>
        <div class="legend">保存后该条目优先播放你选的视频；抖音等不支持内嵌的会自动用「打开」按钮。进度已随账号本地保存。</div>
      </details>`;
    const video = `<div class="video-box">
        <h4>🎬 视频讲解（辅助学习）</h4>
        ${savedHtml}
        ${addForm}
        <a class="bili-btn" href="${bili}" target="_blank" rel="noopener">🔍 在 B 站搜索讲解（国内推荐 · 内容更适龄）</a>
        <details class="yt-details">
          <summary>▸ 看 YouTube？（需代理 · 建议家长陪同）</summary>
          <div class="video-frame"><iframe src="${yt}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
          <div class="legend">YouTube 为关键词搜索结果，内容未经筛选，儿童请在家长陪同下观看。</div>
        </details>
      </div>`;

    let actions="";
    if(st==="new"){
      actions = `<button class="btn btn-primary" id="m-learn">✓ 我学会了（打卡）</button>`;
    } else if(st==="review"){
      const due = it.next && it.next <= today();
      actions = `<button class="btn btn-primary" id="m-review">${due?"✓ 完成本次复习":"提前复习"}</button>
        <span class="m-meta" style="align-self:center">${due?"已到复习时间":"下次复习："+esc(it.next)}</span>`;
    } else {
      actions = `<span class="badge done" style="position:static">🌟 已掌握</span>
        <button class="btn btn-ghost" id="m-reset">重新学习</button>`;
    }
    const speakBtn = `<button class="btn btn-ghost" id="m-speak">🔊 朗读</button>`;
    const testBtn = `<button class="btn btn-ghost" id="m-test">🎯 自测模式</button>`;

    const list=currentList[cat]; const idx=list.findIndex(x=>x.key===key);
    const prev = idx>0 ? list[idx-1] : null;
    const next = idx>=0 && idx<list.length-1 ? list[idx+1] : null;
    const nav = `<div class="nav-prevnext">
        <button class="btn btn-ghost" ${prev?'data-nav="'+prev.key+'"':'disabled'}>← 上一条</button>
        <span class="m-meta">${idx>=0?(idx+1):"-"} / ${list.length}</span>
        <button class="btn btn-ghost" ${next?'data-nav="'+next.key+'"':'disabled'}>下一条 →</button>
      </div>`;

    document.getElementById("modal-body").innerHTML = header + contentWrap + video + `<div class="m-actions">${actions}${speakBtn}${testBtn}</div>` + nav;

    const l=document.getElementById("m-learn"); if(l) l.onclick=()=>learnItem(key);
    const r=document.getElementById("m-review"); if(r) r.onclick=()=>reviewItem(key);
    const rs=document.getElementById("m-reset"); if(rs) rs.onclick=()=>resetItem(key);
    const sp=document.getElementById("m-speak"); if(sp) sp.onclick=()=>speakFor(cat,item);
    const tb=document.getElementById("m-test"); if(tb) tb.onclick=()=>{ const ov=document.getElementById("m-overlay"); if(ov) ov.hidden=false; };
    const sa=document.getElementById("m-showans"); if(sa) sa.onclick=()=>{ testMode=false; const ov=document.getElementById("m-overlay"); if(ov) ov.hidden=true; };
    const vs=document.getElementById("m-vsave"); if(vs) vs.onclick=()=>{ const inp=document.getElementById("m-vurl"); saveVideo(key, inp?inp.value:""); };
    const vd=document.getElementById("m-vdel"); if(vd) vd.onclick=()=>delVideo(key);
    document.getElementById("modal-body").querySelectorAll("[data-nav]").forEach(b=> b.onclick=()=> openModal(cat, b.dataset.nav));
  }

  document.querySelectorAll("[data-close]").forEach(el=> el.onclick = closeModal);
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

  /* ============ 统计 ============ */
  function renderStats(){
    const cs = catStats();
    const overall = cs.reduce((a,b)=>a+b.learned,0);
    const total = cs.reduce((a,b)=>a+b.total,0);
    const mastered = cs.reduce((a,b)=> a + b.arr.filter(x=>statusOf(x.key)==="mastered").length, 0);
    const reviewing = cs.reduce((a,b)=> a + b.arr.filter(x=>statusOf(x.key)==="review").length, 0);

    const v=document.getElementById("view-stats");
    v.innerHTML = `
      <div class="panel">
        <h3>📈 学习概览</h3>
        <div class="stat-row">
          <div class="stat"><div class="v" style="color:var(--brand)">${overall}</div><div class="k">已学习 / 共 ${total}</div></div>
          <div class="stat"><div class="v" style="color:var(--ok)">${mastered}</div><div class="k">已掌握</div></div>
          <div class="stat"><div class="v" style="color:var(--warn)">${reviewing}</div><div class="k">复习中</div></div>
          <div class="stat"><div class="v" style="color:var(--brand)">${streak()}</div><div class="k">连续打卡(天)</div></div>
        </div>
      </div>
      <div class="panel" style="margin-top:18px">
        <h3>🧩 各模块完成度</h3>
        ${cs.map(c=>`
          <div class="row-between"><span>${c.label}（${c.learned}/${c.total}）</span><span>${Math.round(c.pct*100)}%</span></div>
          <div class="bar ${c.name[0]}"><i style="width:${(c.pct*100).toFixed(1)}%"></i></div>`).join("")}
      </div>
      <div class="panel" style="margin-top:18px">
        <h3>🔥 打卡日历</h3>
        ${heatmap()}
        <div class="legend">近 120 天 · 蓝色为已打卡日</div>
      </div>
      <div class="panel" style="margin-top:18px">
        <h3>💾 数据备份 / 重置</h3>
        <p class="section-desc">进度保存在本浏览器。换设备前请导出，到新设备后导入即可延续。</p>
        <div class="m-actions">
          <button class="btn btn-ghost" id="export-btn">导出进度 JSON</button>
          <button class="btn btn-ghost" id="import-btn">导入进度</button>
          <button class="btn btn-warn" id="reset-btn">清空全部进度</button>
        </div>
        <input type="file" id="import-file" accept="application/json" hidden>
      </div>`;

    document.getElementById("export-btn").onclick = exportData;
    document.getElementById("import-btn").onclick = ()=> document.getElementById("import-file").click();
    document.getElementById("import-file").onchange = e=>{ if(e.target.files[0]) importData(e.target.files[0]); };
    document.getElementById("reset-btn").onclick = ()=>{
      if(confirm("确定清空所有打卡与学习进度？此操作不可恢复。")){
        state = { checkins:{}, items:{}, settings: state.settings };
        save(); toast("已清空"); renderAll(); switchView("stats");
      }
    };
  }

  function exportData(){
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="zhongyi-progress-"+today()+".json"; a.click();
    toast("已导出进度文件");
  }
  function importData(file){
    const reader=new FileReader();
    reader.onload = ()=>{
      try{
        const data=JSON.parse(reader.result);
        if(data && data.items){ state=data; save(); toast("导入成功，进度已恢复"); renderAll(); }
        else toast("文件格式不正确");
      }catch(e){ toast("解析失败"); }
    };
    reader.readAsText(file);
  }

  /* ============ 导航 ============ */
  function switchView(v){
    document.querySelectorAll(".nav-btn").forEach(x=> x.classList.toggle("active", x.dataset.view===v));
    ["home","poems","words","idioms","stats"].forEach(x=>{ document.getElementById("view-"+x).hidden = (x!==v); });
    if(v==="home") renderHome();
    else if(v==="poems") renderModule("poems");
    else if(v==="words") renderModule("words");
    else if(v==="idioms") renderModule("idioms");
    else if(v==="stats") renderStats();
  }
  document.querySelectorAll(".nav-btn").forEach(b=> b.onclick = ()=> switchView(b.dataset.view));

  function renderAll(){ renderHome(); }

  /* ============ 初始化 ============ */
  document.getElementById("cnt-poems").textContent = D.poems.length;
  document.getElementById("cnt-words").textContent = D.words.length;
  document.getElementById("cnt-idioms").textContent = D.idioms.length;
  const now=new Date();
  document.getElementById("today-label").textContent = now.getFullYear()+"年"+(now.getMonth()+1)+"月"+now.getDate()+"日 周"+WK[now.getDay()];
  renderHome();
})();
