export const playgroundCards=[
  {id:'cards',number:'13',title:'乐队卡牌挑战',short:'卡牌挑战',en:'ONE MORE CHORUS',icon:'▣',color:'#d5b5cf',description:'练习、即兴与合奏，把一张张卡接成完整的演出。',action:'抽出第一手牌'},
  {id:'jigsaw',number:'14',title:'收藏图片拼图台',short:'收藏拼图',en:'PIECE BY PIECE',icon:'▦',color:'#acc9c1',description:'从收藏里挑一张心动，把散开的画面慢慢拼回去。',action:'选一张图开始'},
  {id:'shop',number:'15',title:'乐器店打工记',short:'乐器店',en:'AFTER SCHOOL SHIFT',icon:'⌂',color:'#e4c691',description:'配好琴弦与踏板，调准一根弦，照顾今天的三位客人。',action:'挂上营业的小牌'},
  {id:'platform',number:'16',title:'波奇横版跳跃',short:'横版跳跃',en:'JUMP A LITTLE HIGHER',icon:'↟',color:'#e3b0c4',description:'蓄力、补跳与吉他冲刺，收集音符，抵达屋顶小舞台。',action:'从这块平台起跳'},
  {id:'lights',number:'17',title:'舞台灯光编舞台',short:'灯光编舞',en:'DRAW WITH THE LIGHT',icon:'✦',color:'#c4b4db',description:'把追光、颜色与转场排进时间轴，和自己的编曲同步。',action:'点亮第一束光'},
  {id:'comic',number:'18',title:'四格漫画工坊',short:'四格漫画',en:'FOUR LITTLE PANELS',icon:'▤',color:'#d1c39f',description:'摆好角色，写下对白，让四个画面接成一个小故事。',action:'翻开第一格'},
  {id:'mix',number:'19',title:'合奏混音修复挑战',short:'混音修复',en:'FIND THE BALANCE',icon:'≋',color:'#a9c6d5',description:'找回低音、摆开声像，再听听修改前后的不同。',action:'推起第一条推子'},
  {id:'graffiti',number:'20',title:'演出涂鸦墙',short:'涂鸦墙',en:'LEAVE A LITTLE COLOR',icon:'〰',color:'#d7b4b1',description:'画笔、图层与角色印章，把今天做成海报或舞台背景。',action:'留下一笔颜色'},
  {id:'relay',number:'21',title:'访客接龙小剧场',short:'故事接龙',en:'PASS THE NEXT LINE',icon:'✉',color:'#b8c4a5',description:'读上一句，接下一句。六句相遇之后，故事一起揭晓。',action:'接过这一张纸条'},
  {id:'pinball',number:'22',title:'音乐弹珠台',short:'音乐弹珠',en:'BOUNCE INTO THE BEAT',icon:'●',color:'#c1b6d8',description:'接住音符球，撞响鼓与琴弦，留住这一局的连击。',action:'拉下第一根发射杆'}
];
export const bandCards=[
  {id:'practice',name:'再练一遍',member:'hitori',cost:1,power:8,block:3,text:'推进 8，防护 3。'},
  {id:'solo',name:'吉他先开口',member:'hitori',cost:2,power:18,text:'推进 18。'},
  {id:'count',name:'一二三四',member:'nijika',cost:1,power:5,draw:1,block:5,text:'推进 5，防护 5，抽 1 张。'},
  {id:'bass',name:'低音的底气',member:'ryo',cost:1,power:11,text:'推进 11。'},
  {id:'vocal',name:'明亮的第一句',member:'kita',cost:2,power:16,heal:3,text:'推进 16，恢复 3。'},
  {id:'encourage',name:'大家都在',member:'nijika',cost:1,heal:12,block:6,text:'恢复 12，防护 6。'},
  {id:'tune',name:'试音一下',member:'ryo',cost:1,block:12,draw:1,text:'防护 12，抽 1 张。'},
  {id:'box',name:'纸箱充电',member:'hitori',cost:1,block:16,text:'防护 16。'},
  {id:'rest',name:'喝一口热茶',member:'nijika',cost:0,heal:8,block:4,exhaust:true,text:'恢复 8，防护 4；本幕只用一次。'},
  {id:'flyer',name:'传来一张票',member:'kita',cost:0,draw:2,exhaust:true,text:'抽 2 张；本幕只用一次。'},
  {id:'unison',name:'四种颜色一起',member:'band',cost:3,power:29,text:'推进 29；每位已登场成员减耗 1，三位登场再推进 10。'},
  {id:'improv',name:'留一点即兴',member:'ryo',cost:1,power:9,draw:1,text:'推进 9，抽 1 张。'}
];
export const cardStages=[{name:'第一幕 · 设备的杂音',target:42,intents:[10,12,9,14]},{name:'第二幕 · 忽然忘掉的歌词',target:62,intents:[13,17,10,18]},{name:'第三幕 · 紧张的安可',target:82,intents:[16,20,12,22]}];
export const shopProducts=[{id:'guitar',label:'电吉他弦',icon:'♬'},{id:'bass',label:'贝斯弦',icon:'≋'},{id:'sticks',label:'鼓棒',icon:'╱'},{id:'pick',label:'拨片套装',icon:'▽'}];
export const shopEffects=[{id:'clean',label:'清音踏板',request:'干净的拨弦'},{id:'drive',label:'失真踏板',request:'有力量的失真'},{id:'delay',label:'延迟踏板',request:'带回声的音色'}];
export const shopDecorations=[{id:'plant',label:'窗边的小盆栽',cost:150},{id:'poster',label:'手写营业海报',cost:230},{id:'lamp',label:'温暖的柜台灯',cost:320}];
export const mixTracks=[{id:'guitar',label:'节奏吉他',color:'#dfa8c0'},{id:'bass',label:'低音贝斯',color:'#a3c0d0'},{id:'drums',label:'鼓与节拍',color:'#e0c783'},{id:'lead',label:'旋律线',color:'#c3afd1'}];
const target=[{volume:.55,pan:-.35,tone:-2},{volume:.65,pan:.15,tone:1},{volume:.6,pan:0,tone:0},{volume:.4,pan:.35,tone:-1}];
export const mixChallenges=[
  {id:'balance',name:'找回被盖住的贝斯',focus:'volume',text:'贝斯太小，吉他和旋律抢在前面。调整四条音量，试着接近参考。',target,initial:target.map((t,i)=>({...t,volume:[.95,.08,.25,.9][i]}))},
  {id:'space',name:'给每种声音留位置',focus:'pan',text:'声音都挤在两边了。把鼓放回中间，再把吉他与旋律轻轻摆开。',target,initial:target.map((t,i)=>({...t,pan:[-1,-.8,1,.95][i]}))},
  {id:'tone',name:'让高频柔和一点',focus:'tone',text:'这段合奏有些刺耳。调整每轨的高频均衡，和参考反复对照。',target,initial:target.map((t,i)=>({...t,tone:[10,-10,8,11][i]}))}
];
export const relaySeeds=[
  {id:'before-show',title:'开演前的一张纸条',opening:'一里在音箱后面，发现了一张写着「先别开灯」的纸条。'},
  {id:'rainy-road',title:'雨夜，多出来的一把伞',opening:'散场时，门口多了一把谁也没见过的黄色雨伞。'},
  {id:'lost-pick',title:'那枚会旅行的拨片',opening:'凉的口袋里，掉出了一枚刻着明天日期的粉色拨片。'}
];
