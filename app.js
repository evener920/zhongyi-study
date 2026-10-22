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
  state.gallery = state.gallery || []; // 成语动画廊：用户自添加的成语卡
  state.settings = state.settings || { dailyGoal: 15 };
  // 首次访问（本地尚未自定义过）：用预设的《成语动画廊》180 集填充动画廊
  if(state.gallery.length===0 && !state._gallerySeeded){
    state.gallery = (window.DEFAULT_GALLERY||[]).map((c,i)=>({ id:"def"+i, word:c.word, explanation:c.explanation||"", url:c.url }));
    state._gallerySeeded = true;
    save();
  }

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
    if(cat === "words") wordsMode = "cards"; // 从首页“去学习”进入时，先回到卡片墙视图
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

  let wordsMode = "cards"; // 单词模块当前玩法：卡片墙 / 翻翻卡 / 配对 / 闯关 / 拼写 / 分拣台 / 归类
  const WORDS_MODES = [
    {k:"cards",label:"📇 卡片墙"},
    {k:"flip",label:"🎴 翻翻卡"},
    {k:"match",label:"🧩 配对"},
    {k:"quiz",label:"🎯 闯关"},
    {k:"spell",label:"✍️ 拼写"},
    {k:"sort",label:"🪣 分拣台"},
    {k:"classify",label:"🗂️ 归类"}
  ];

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

    // 单词模块：在筛选工具栏下方加一排“玩法”子导航，玩法更像一个好玩的游戏
    if(cat === "words"){
      const subnav = `<div class="subnav">${WORDS_MODES.map(m=>`<button class="subnav-btn ${m.k===wordsMode?'active':''}" data-mode="${m.k}">${m.label}</button>`).join("")}</div>`;
      v.innerHTML = toolbar + subnav + `<div id="words-game"></div>`;
      v.querySelector("#words-q").oninput = e=>{ f.q=e.target.value; f.page=0; rerenderWords(); };
      opts.forEach(o=>{ v.querySelector("#words-sel-"+o.k).onchange = e=>{ f.f1key=o.k; f.f1=e.target.value; f.page=0; rerenderWords(); }; });
      v.querySelectorAll(".subnav-btn").forEach(b=> b.onclick = ()=>{
        wordsMode=b.dataset.mode;
        v.querySelectorAll(".subnav-btn").forEach(x=> x.classList.toggle("active", x.dataset.mode===wordsMode));
        rerenderWords();
      });
      rerenderWords();
      return;
    }

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
    if(!grid) return; // 单词模块可能正处于某个玩法视图，不存在卡片网格
    grid.innerHTML = slice.map(item=> cardHtml(cat, item)).join("");
    grid.querySelectorAll("[data-key]").forEach(c=>{
      c.addEventListener('click', e=>{
        if(e.target.closest('.flash-btn')) return;   // 会与不会按钮单独处理
        openModal(cat, c.dataset.key);                // 点词条放大看详情
      });
      c.querySelectorAll('.flash-btn').forEach(b=>{
        b.addEventListener('click', e=>{
          e.stopPropagation();
          const key=c.dataset.key;
          if(b.dataset.act==='know'){ learnItem(key); paintGrid(cat); toast('👍 记牢了'); }
          else { openModal(cat, key); toast('再看看～'); }
        });
      });
    });
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
    if(cat==="poems"){
      const title = item.title, sub = (item.author||"")+(item.dynasty?" · "+item.dynasty:"");
      const tags = (item.tags||[]).slice(0,3).map(t=>`<span class="c-tag">${esc(t)}</span>`).join("");
      return `<div class="card" data-key="${item.key}">${badge}
        <div class="c-title">${esc(title)}</div>
        <div class="c-sub">${esc(sub)}</div>${tags}</div>`;
    }
    // 单词 / 成语：闪卡——正面只显示词条 + 会与不会
    const term = cat==="words" ? item.text : item.word;
    return `<div class="card flash" data-key="${item.key}">
      ${badge}
      <div class="flash-term">${esc(term)}</div>
      <div class="flash-actions">
        <button class="flash-btn know" data-act="know">会 ✔</button>
        <button class="flash-btn dont" data-act="dont">不会 ✕</button>
      </div>
    </div>`;
  }

  /* ============ 单词游戏（像“豆子的归类游戏”一样好玩） ============ */
  // 单词模块当前筛选下的候选池（尊重年级/单元筛选与搜索）
  function wordsFiltered(){
    const f = filters.words;
    let arr = D.words.slice();
    if(f.f1key && f.f1) arr = arr.filter(x=> x[f.f1key] === f.f1);
    if(f.q){ const q=f.q.toLowerCase(); arr = arr.filter(x=> JSON.stringify(x).toLowerCase().indexOf(q) >= 0); }
    return arr;
  }
  // 从候选池随机抽取 n 个，打乱顺序
  function sampleWords(n){
    const pool = wordsFiltered();
    if(pool.length === 0) return [];
    const shuffled = pool.slice().sort(()=> Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }
  function rerenderWords(){ renderWordsMode(wordsMode); }
  function renderWordsMode(mode){
    const c = document.getElementById("words-game");
    if(!c) return;
    if(mode==="cards")   return renderWordsCards(c);
    if(mode==="flip")    return renderFlip(c);
    if(mode==="match")   return renderMatch(c);
    if(mode==="quiz")    return renderQuiz(c);
    if(mode==="spell")   return renderSpell(c);
    if(mode==="sort")    return renderSort(c);
    if(mode==="classify")return renderClassify(c);
  }
  // 卡片墙（复用既有会/不会闪卡，作为单词默认视图）
  function renderWordsCards(c){
    c.innerHTML = `<div class="grid" id="words-grid"></div>
      <div class="pager"><button id="words-prev">上一页</button><span class="pginfo" id="words-pinfo"></span><button id="words-next">下一页</button></div>`;
    document.getElementById("words-prev").onclick = ()=>{ filters.words.page=Math.max(0,filters.words.page-1); paintGrid("words"); };
    document.getElementById("words-next").onclick = ()=>{ filters.words.page++; paintGrid("words"); };
    paintGrid("words");
  }

  // 撒花庆祝动画
  function balloons(n, host){
    host = host || document.getElementById("words-game") || document.body;
    for(let i=0;i<(n||8);i++){
      const b = document.createElement("div");
      b.className = "balloon";
      b.textContent = ["🎈","🎉","⭐","✨","💛","🌟"][i%6];
      b.style.left = (8 + Math.random()*84) + "%";
      b.style.animationDelay = (Math.random()*0.25) + "s";
      host.appendChild(b);
      setTimeout(()=> b.remove(), 1700);
    }
  }

  // 🎴 翻翻卡：点卡片翻面看释义，会了点「会」
  function renderFlip(c){
    const set = sampleWords(12);
    if(set.length===0){ c.innerHTML = `<div class="empty">当前筛选下没有单词，换个年级/单元试试～</div>`; return; }
    c.innerHTML = `<div class="game-head">🎴 <b>翻翻卡</b>：点卡片翻面看释义，记住了就点「会」，记不住点「不会」</div>
      <div class="flip-wall">${set.map(w=>`
        <div class="flip-card" data-key="${w.key}">
          <div class="flip-inner">
            <div class="flip-front"><div class="fc-word">${esc(w.text)}</div><div class="fc-hint">点击翻面</div></div>
            <div class="flip-back"><div class="fc-phon">${esc(w.phonetic)}</div><div class="fc-cn">${esc(w.cn)}</div></div>
          </div>
          <div class="flip-foot">
            <button class="mini-btn" data-act="speak">🔊 听</button>
            <button class="mini-btn ok" data-act="know">会 ✔</button>
            <button class="mini-btn no" data-act="dont">不会 ✕</button>
          </div>
        </div>`).join("")}</div>
      <div class="game-foot"><button class="btn btn-ghost" id="flip-more">🔄 换一批</button></div>`;
    c.querySelectorAll(".flip-card").forEach(card=>{
      const inner = card.querySelector(".flip-inner");
      inner.addEventListener("click", ()=> card.classList.toggle("flipped"));
      card.querySelectorAll(".flip-foot button").forEach(b=> b.addEventListener("click", e=>{
        e.stopPropagation();
        const key = card.dataset.key;
        if(b.dataset.act==="speak"){ const w=D.words.find(x=>x.key===key); speak(w.text,"en-US"); }
        else if(b.dataset.act==="know"){ learnItem(key); card.classList.add("done"); card.classList.remove("not"); toast("👍 记牢啦"); }
        else { card.classList.add("not"); toast("再看看～"); }
      }));
    });
    document.getElementById("flip-more").onclick = ()=> renderFlip(c);
  }

  // 🧩 配对：记忆翻牌，把单词和释义配成一对
  function renderMatch(c){
    const set = sampleWords(6);
    if(set.length<2){ c.innerHTML = `<div class="empty">单词太少，无法配对，换个筛选试试～</div>`; return; }
    const cards = [];
    set.forEach((w,i)=>{ cards.push({pair:i,side:"w",text:w.text,key:w.key}); cards.push({pair:i,side:"m",text:w.cn,key:w.key}); });
    cards.sort(()=> Math.random() - 0.5);
    c.innerHTML = `<div class="game-head">🧩 <b>配对</b>：翻开两张卡，把单词和中文意思配成一对</div>
      <div class="match-grid">${cards.map((cd,i)=>`<div class="match-card" data-i="${i}"><span class="mc-text">${esc(cd.text)}</span></div>`).join("")}</div>
      <div class="game-foot"><span id="match-info"></span><button class="btn btn-ghost" id="match-restart">🔄 重玩</button></div>`;
    const grid = c.querySelector(".match-grid");
    const info = c.querySelector("#match-info");
    let flipped=[], matched=new Set(), moves=0, locked=false;
    function update(){ info.textContent = `已配对 ${matched.size}/${set.length} · 步数 ${moves}`; }
    grid.querySelectorAll(".match-card").forEach(el=>{
      el.addEventListener("click", ()=>{
        if(locked) return;
        const i = +el.dataset.i;
        if(el.classList.contains("open") || el.classList.contains("matched") || flipped.includes(i)) return;
        el.classList.add("open"); flipped.push(i);
        if(flipped.length===2){
          moves++;
          const a = cards[flipped[0]], b = cards[flipped[1]];
          if(a.pair===b.pair && a.side!==b.side){
            matched.add(a.pair);
            flipped.forEach(k=> grid.querySelector(`[data-i="${k}"]`).classList.add("matched"));
            flipped = []; update();
            if(matched.size===set.length){ balloons(14,c); info.textContent = `🎉 全部配对成功！用了 ${moves} 步`; }
          } else {
            locked = true;
            const f = flipped.slice();
            setTimeout(()=>{ f.forEach(k=>{ const e=grid.querySelector(`[data-i="${k}"]`); if(e && !e.classList.contains("matched")) e.classList.remove("open"); }); flipped=[]; locked=false; }, 750);
          }
        }
        update();
      });
    });
    update();
    document.getElementById("match-restart").onclick = ()=> renderMatch(c);
  }

  // 🎯 闯关：四选一，选出单词的中文意思
  function renderQuiz(c){
    const set = sampleWords(10);
    if(set.length===0){ c.innerHTML = `<div class="empty">当前筛选下没有单词～</div>`; return; }
    let qi=0, score=0;
    function q(){
      if(qi>=set.length){
        c.innerHTML = `<div class="game-head">🎯 闯关结束！</div>
          <div class="quiz-result">得分 <b>${score}</b> / ${set.length} 🎉</div>
          <div class="game-foot"><button class="btn btn-primary" id="quiz-again">🔄 再来一局</button></div>`;
        balloons(12,c);
        document.getElementById("quiz-again").onclick = ()=> renderQuiz(c);
        return;
      }
      const w = set[qi];
      const opts = [w.cn];
      while(opts.length<4){ const d = set[Math.floor(Math.random()*set.length)].cn; if(!opts.includes(d)) opts.push(d); }
      opts.sort(()=> Math.random() - 0.5);
      c.innerHTML = `<div class="game-head">🎯 <b>闯关</b>：选出「${esc(w.text)}」的意思（第 ${qi+1}/${set.length} 题）</div>
        <div class="quiz-word">${esc(w.text)} <button class="mini-btn" id="q-speak">🔊 听</button></div>
        <div class="quiz-opts">${opts.map(o=>`<button class="quiz-opt" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>
        <div class="game-foot"><span>得分：${score}</span></div>`;
      c.querySelector("#q-speak").onclick = ()=> speak(w.text,"en-US");
      const optEls = c.querySelectorAll(".quiz-opt");
      optEls.forEach(el=> el.onclick = ()=>{
        if(el.disabled) return;
        optEls.forEach(x=> x.disabled = true);
        if(el.dataset.o===w.cn){ el.classList.add("right"); score++; balloons(3,c); }
        else { el.classList.add("wrong"); optEls.forEach(x=>{ if(x.dataset.o===w.cn) x.classList.add("right"); }); }
        setTimeout(()=>{ qi++; q(); }, 750);
      });
    }
    q();
  }

  // ✍️ 拼写：根据中文意思写出英文单词
  function renderSpell(c){
    const set = sampleWords(10);
    if(set.length===0){ c.innerHTML = `<div class="empty">当前筛选下没有单词～</div>`; return; }
    let i=0, score=0;
    function step(){
      if(i>=set.length){
        c.innerHTML = `<div class="game-head">✍️ 拼写结束！</div>
          <div class="quiz-result">答对 <b>${score}</b> / ${set.length} ✏️</div>
          <div class="game-foot"><button class="btn btn-primary" id="spell-again">🔄 再来一局</button></div>`;
        balloons(12,c);
        document.getElementById("spell-again").onclick = ()=> renderSpell(c);
        return;
      }
      const w = set[i];
      c.innerHTML = `<div class="game-head">✍️ <b>拼写</b>：根据中文写出英文（第 ${i+1}/${set.length} 题）</div>
        <div class="spell-cn">${esc(w.cn)}</div>
        <div class="spell-phon">${esc(w.phonetic)} <button class="mini-btn" id="s-speak">🔊 听</button></div>
        <input class="spell-input" id="s-input" placeholder="输入英文单词" autocomplete="off" spellcheck="false">
        <div class="game-foot"><button class="btn btn-primary" id="s-submit">提交</button><span id="s-info"></span></div>`;
      const inp = c.querySelector("#s-input");
      inp.focus();
      c.querySelector("#s-speak").onclick = ()=> speak(w.text,"en-US");
      function submit(){
        const val = (inp.value||"").trim().toLowerCase();
        if(!val) return;
        const ok = val === w.text.trim().toLowerCase();
        const info = c.querySelector("#s-info");
        if(ok){ score++; info.textContent = "✅ 正确！"; info.style.color = "var(--ok)"; balloons(3,c); }
        else { info.textContent = "❌ 正确答案：" + w.text; info.style.color = "#d8483b"; }
        inp.disabled = true; c.querySelector("#s-submit").disabled = true;
        setTimeout(()=>{ i++; step(); }, 900);
      }
      c.querySelector("#s-submit").onclick = submit;
      inp.addEventListener("keydown", e=>{ if(e.key==="Enter") submit(); });
    }
    step();
  }

  // 🪣 分拣台：把单词拖到「我会了 / 还不会」（手机可点卡片按钮）
  function renderSort(c){
    const set = sampleWords(12);
    if(set.length===0){ c.innerHTML = `<div class="empty">当前筛选下没有单词～</div>`; return; }
    let remaining = set.slice();
    let kn=0, dn=0;
    c.innerHTML = `<div class="game-head">🪣 <b>分拣台</b>：把单词拖到「我会了」或「还不会」——手机可直接点卡片上的按钮</div>
      <div class="sort-board">
        <div class="sort-col pile"><h4 class="pile-h">📥 待分拣（<span id="cnt-left">${remaining.length}</span>）</h4><div class="bean-pile" id="bean-pile"></div></div>
        <div class="sort-col know"><h4>🌟 我会了（<span id="cnt-know">0</span>）</h4><div class="bean-zone" id="zone-know" data-zone="know"></div></div>
        <div class="sort-col dont"><h4>💪 还不会（<span id="cnt-dont">0</span>）</h4><div class="bean-zone" id="zone-dont" data-zone="dont"></div></div>
      </div>`;
    const pileEl = c.querySelector("#bean-pile");
    const zk = c.querySelector("#zone-know"), zd = c.querySelector("#zone-dont");
    function pileHtml(){ return remaining.map(w=>`
      <div class="bean" draggable="true" data-key="${w.key}">
        <div class="bean-word">${esc(w.text)}</div>
        <div class="bean-cn">${esc(w.cn)}</div>
        <div class="bean-acts"><button class="mini-btn ok" data-act="know">会✔</button><button class="mini-btn no" data-act="dont">不会✕</button></div>
      </div>`).join(""); }
    function wireBeans(){
      pileEl.querySelectorAll(".bean").forEach(b=>{
        b.addEventListener("dragstart", e=> e.dataTransfer.setData("text/plain", b.dataset.key));
        b.querySelectorAll(".bean-acts button").forEach(btn=> btn.addEventListener("click", e=>{ e.stopPropagation(); move(b.dataset.key, btn.dataset.act==="know"?"know":"dont"); }));
      });
    }
    function move(key, to){
      const idx = remaining.findIndex(x=>x.key===key); if(idx<0) return;
      const w = remaining[idx]; remaining.splice(idx,1);
      const chip = document.createElement("div"); chip.className="bean-chip"; chip.textContent=w.text;
      if(to==="know"){ learnItem(key); kn++; c.querySelector("#cnt-know").textContent=kn; (zk).appendChild(chip); balloons(2,c); }
      else { dn++; c.querySelector("#cnt-dont").textContent=dn; (zd).appendChild(chip); }
      c.querySelector("#cnt-left").textContent = remaining.length;
      pileEl.innerHTML = pileHtml(); wireBeans();
      if(remaining.length===0){ balloons(14,c); toast("分拣完成！"); }
    }
    [zk,zd].forEach(z=>{
      z.addEventListener("dragover", e=>{ e.preventDefault(); z.classList.add("over"); });
      z.addEventListener("dragleave", ()=> z.classList.remove("over"));
      z.addEventListener("drop", e=>{ e.preventDefault(); z.classList.remove("over"); move(e.dataTransfer.getData("text/plain"), z.dataset.zone); });
    });
    pileEl.innerHTML = pileHtml(); wireBeans();
  }

  // 🗂️ 归类：把单词拖进它所属的「年级 / 单元」罐子
  function renderClassify(c){
    const pool = wordsFiltered();
    if(pool.length===0){ c.innerHTML = `<div class="empty">当前筛选下没有单词～</div>`; return; }
    // 自适应维度：年级多于 1 个就按“年级”归类，否则按“单元”归类
    const grades = uniq(pool,"grade");
    const dim = grades.length>1 ? "grade" : "unit";
    const freq = {}; pool.forEach(w=> freq[w[dim]]=(freq[w[dim]]||0)+1);
    const jars = Object.keys(freq).sort((a,b)=> freq[b]-freq[a]).slice(0,6);
    let set = sampleWords(12).filter(w=> jars.includes(w[dim]));
    if(set.length<6) set = pool.filter(w=> jars.includes(w[dim])).slice(0,12);
    if(set.length===0){ c.innerHTML = `<div class="empty">没有可归类的单词，换个筛选试试～</div>`; return; }
    c.innerHTML = `<div class="game-head">🗂️ <b>归类</b>：把单词拖进它所属的「${dim==="grade"?"年级":"单元"}」罐子（手机可点卡片上的按钮）</div>
      <div class="classify-pool" id="cf-pool">${set.map(w=>`
        <div class="bean" draggable="true" data-key="${w.key}" data-dim="${esc(w[dim])}">
          <div class="bean-word">${esc(w.text)}</div><div class="bean-cn">${esc(w.cn)}</div>
          <div class="bean-acts">${jars.map(j=>`<button class="mini-btn" data-g="${esc(j)}">${esc(j)}</button>`).join("")}</div>
        </div>`).join("")}</div>
      <div class="classify-jars">${jars.map(j=>`<div class="jar" data-jar="${esc(j)}"><h4>${esc(j)}</h4><div class="jar-body"></div></div>`).join("")}</div>`;
    const poolEl = c.querySelector("#cf-pool");
    let done = 0;
    function jarEl(j){ return c.querySelector('.jar[data-jar="'+j.replace(/"/g,'\\"')+'"]'); }
    function check(w, j, beanEl){
      if(w[dim]===j){
        const je = jarEl(j);
        const chip = document.createElement("div"); chip.className="bean-chip"; chip.textContent=w.text;
        je.querySelector(".jar-body").appendChild(chip);
        beanEl.remove(); done++;
        balloons(2,c);
        if(done===set.length){ balloons(14,c); toast("🎉 全部归好类啦！"); }
      } else {
        toast("再想想，「"+w.text+"」其实属于 "+w[dim]);
        beanEl.classList.add("shake"); setTimeout(()=> beanEl.classList.remove("shake"), 500);
      }
    }
    poolEl.querySelectorAll(".bean").forEach(b=>{
      const w = set.find(x=>x.key===b.dataset.key);
      b.addEventListener("dragstart", e=> e.dataTransfer.setData("text/plain", b.dataset.key));
      b.querySelectorAll(".bean-acts button").forEach(btn=> btn.addEventListener("click", e=>{ e.stopPropagation(); check(w, btn.dataset.g, b); }));
    });
    c.querySelectorAll(".jar").forEach(jar=>{
      jar.addEventListener("dragover", e=>{ e.preventDefault(); jar.classList.add("over"); });
      jar.addEventListener("dragleave", ()=> jar.classList.remove("over"));
      jar.addEventListener("drop", e=>{ e.preventDefault(); jar.classList.remove("over"); const key=e.dataTransfer.getData("text/plain"); const b=poolEl.querySelector('.bean[data-key="'+key+'"]'); const w=set.find(x=>x.key===key); if(w) check(w, jar.dataset.jar, b); });
    });
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
      if(bvm){
        const pg = (url.match(/[?&]page=(\d+)/)||[])[1] || "1"; // 支持分P视频（如成语动画廊 180 集）
        return { type:"iframe", src:"https://player.bilibili.com/player.html?bvid="+bvm[0]+"&page="+pg+"&high_quality=1&autoplay=0" };
      }
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
    let video = `<div class="video-box">
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

    if(cat==='words') video='';   // 单词靠拼写/释义练习，不需要视频
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

  /* ============ 成语动画廊（添加成语卡 + 单独播放视频） ============ */
  let galleryOpen = null; // 当前正在播放的卡片 id（保证一次只播一个）

  function withAutoplay(src){
    // 若已有 autoplay 参数（如 B站内嵌默认 autoplay=0），先统一成 1，再补一个
    src = src.replace(/([?&]autoplay=)[01]/, "$1"+"1");
    if(/[?&]autoplay=/.test(src)) return src;
    const sep = src.indexOf("?")>=0 ? "&" : "?";
    return src + sep + "autoplay=1";
  }

  function renderGallery(){
    const v = document.getElementById("view-gallery");
    // 卡片来源：① 已有的 270 个成语里“保存过视频”的；② 用户自己添加的
    const idiomCards = D.idioms.filter(x=> state.videos[x.key])
      .map(x=>({ id:x.key, kind:"idiom", word:x.word, explanation:x.explanation, url:state.videos[x.key] }));
    const customCards = (state.gallery||[]).map(c=>({ id:"g"+c.id, kind:"custom", word:c.word, explanation:c.explanation, url:c.url, cid:c.id }));
    const cards = idiomCards.concat(customCards);

    const cardHtml = (c)=>{
      const emb = videoEmbed(c.url);
      const playing = galleryOpen===c.id;
      let player = "";
      if(playing){
        player = emb.type==="iframe"
          ? `<div class="gplayer"><iframe src="${esc(withAutoplay(emb.src))}" allow="encrypted-media; picture-in-picture; autoplay" allowfullscreen></iframe></div>`
          : `<a class="bili-btn" href="${esc(c.url)}" target="_blank" rel="noopener">▶ 打开视频（抖音 / 其他平台，不支持内嵌）</a>`;
      }
      const playBtn = playing
        ? `<button class="mini-btn" data-act="close">收起</button>`
        : `<button class="mini-btn" data-act="play">▶ 播放</button>`;
      const delBtn = c.kind==="custom"
        ? `<button class="mini-btn sv-del" data-act="del">删除</button>`
        : `<button class="mini-btn sv-del" data-act="unlink">移除视频</button>`;
      return `<div class="gcard" data-id="${esc(c.id)}" data-cid="${c.cid||""}">
        <div class="gcard-head"><span class="gterm">${esc(c.word)}</span>${delBtn}</div>
        <div class="gexpl">${esc((c.explanation||"").slice(0,60))}</div>
        <div class="gcard-foot">
          <button class="mini-btn" data-act="speak">🔊</button>
          ${playBtn}
        </div>
        ${player}
      </div>`;
    };

    v.innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <h3>🎬 成语动画廊</h3>
        <p class="section-desc">把喜欢的成语动画收集成卡片，点「播放」单独看，互不打扰；也能自己添加成语卡。</p>
        <button class="btn btn-primary" id="g-add-toggle">➕ 添加成语卡</button>
        <button class="btn btn-ghost" id="g-batch-toggle" style="margin-left:8px">📥 批量导入</button>
        <div class="gallery-add" id="g-add-form" hidden>
          <div class="ga-row"><label>成语</label><input id="g-word" placeholder="如：画蛇添足"></div>
          <div class="ga-row"><label>解释(选填)</label><input id="g-exp" placeholder="一句话解释"></div>
          <div class="ga-row"><label>视频链接</label><input id="g-url" placeholder="B站 / 抖音 / YouTube 链接"></div>
          <div class="ga-actions">
            <button class="btn btn-primary" id="g-save">保存卡片</button>
            <button class="btn btn-ghost" id="g-cancel">取消</button>
          </div>
          <div class="legend">B站 BV 链接会内嵌播放；抖音等不支持内嵌的会给出“打开”按钮。进度保存在本浏览器。</div>
        </div>
        <div class="gallery-add" id="g-batch-form" hidden>
          <p class="legend">每行一条：<b>成语 + 空格 + 视频链接</b>。例如：<br>画蛇添足 https://www.bilibili.com/video/BVxxxx<br>守株待兔 https://www.bilibili.com/video/BVyyyy<br>支持 B站 / 抖音 / YouTube；空行忽略，重复成语自动跳过。</p>
          <textarea id="g-batch-text" rows="9" placeholder="画蛇添足 https://www.bilibili.com/video/BVxxxx&#10;守株待兔 https://www.bilibili.com/video/BVyyyy"></textarea>
          <div class="ga-actions">
            <button class="btn btn-primary" id="g-batch-save">导入全部</button>
            <button class="btn btn-ghost" id="g-batch-cancel">取消</button>
          </div>
        </div>
      </div>
      <div class="grid gallery-grid">${cards.length ? cards.map(cardHtml).join("") : `<div class="empty">还没有卡片，点上方“添加成语卡”开始收集吧～</div>`}</div>`;

    const cnt = document.getElementById("cnt-gallery"); if(cnt) cnt.textContent = cards.length;

    v.querySelector("#g-add-toggle").onclick = ()=>{ const f=v.querySelector("#g-add-form"); f.hidden=!f.hidden; };
    v.querySelector("#g-batch-toggle").onclick = ()=>{ const f=v.querySelector("#g-batch-form"); f.hidden=!f.hidden; };
    v.querySelector("#g-batch-cancel").onclick = ()=>{ v.querySelector("#g-batch-form").hidden=true; };
    v.querySelector("#g-batch-save").onclick = ()=>{
      const text = v.querySelector("#g-batch-text").value || "";
      const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      let added=0, skipped=0;
      state.gallery = state.gallery||[];
      const existing = new Set(state.gallery.map(c=>c.word));
      lines.forEach(line=>{
        const um = line.match(/(https?:\/\/[^\s]+)/);
        if(!um){ skipped++; return; }
        const url = um[0].replace(/[）)】\]]$/, "");
        const word = line.slice(0, um.index).replace(/[\s|，,;；、。、]+$/g, "").trim();
        if(!word || existing.has(word)){ skipped++; return; }
        state.gallery.push({ id: Date.now()*1000 + added, word, explanation:"", url });
        existing.add(word); added++;
      });
      save(); galleryOpen=null; toast(`批量导入 ${added} 张，跳过 ${skipped} 张 🎉`); renderGallery();
    };
    v.querySelector("#g-cancel").onclick = ()=>{ v.querySelector("#g-add-form").hidden=true; };
    v.querySelector("#g-save").onclick = ()=>{
      const word=v.querySelector("#g-word").value.trim();
      const exp=v.querySelector("#g-exp").value.trim();
      const url=v.querySelector("#g-url").value.trim();
      if(!word || !url){ toast("请填写成语和视频链接"); return; }
      state.gallery = state.gallery||[];
      state.gallery.push({ id:Date.now(), word, explanation:exp, url });
      save(); galleryOpen=null; toast("已添加成语卡 🎉"); renderGallery();
    };

    v.querySelectorAll(".gcard").forEach(cardEl=>{
      const id = cardEl.dataset.id;
      cardEl.querySelectorAll("[data-act]").forEach(b=> b.onclick = ()=>{
        const act=b.dataset.act;
        if(act==="play"){ galleryOpen=id; renderGallery(); }
        else if(act==="close"){ galleryOpen=null; renderGallery(); }
        else if(act==="speak"){ const c=cards.find(x=>x.id===id); speak((c.word||"")+"。"+(c.explanation||""),"zh-CN"); }
        else if(act==="del"){ const cid=cardEl.dataset.cid; state.gallery=state.gallery.filter(x=>String(x.id)!==String(cid)); save(); galleryOpen=null; toast("已删除卡片"); renderGallery(); }
        else if(act==="unlink"){ delete state.videos[id]; save(); galleryOpen=null; toast("已移除该成语的视频"); renderGallery(); }
      });
    });
  }

  /* ============ 导航 ============ */
  function switchView(v){
    document.querySelectorAll(".nav-btn").forEach(x=> x.classList.toggle("active", x.dataset.view===v));
    ["home","poems","words","idioms","gallery","stats"].forEach(x=>{ document.getElementById("view-"+x).hidden = (x!==v); });
    if(v==="home") renderHome();
    else if(v==="poems") renderModule("poems");
    else if(v==="words") renderModule("words");
    else if(v==="idioms") renderModule("idioms");
    else if(v==="gallery") renderGallery();
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
