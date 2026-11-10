export const adventureCards = [
  { id:'maze', number:'07', title:'纸箱潜行迷宫', short:'纸箱迷宫', en:'CARDBOARD ADVENTURE', icon:'▧', color:'#d7bf92', description:'推开纸箱，躲过聚光灯，带着勇气走完三段后台小路。', action:'从第一步开始' },
  { id:'effects', number:'08', title:'吉他效果器台', short:'效果器台', en:'FIND YOUR OWN TONE', icon:'≋', color:'#a8c8bd', description:'旋转旋钮，交换踏板，把试音变成自己的声音。', action:'接上第一根线' },
  { id:'companion', number:'09', title:'常驻 Q 版伙伴', short:'伙伴手帐', en:'SOMEONE TO REMEMBER', icon:'✿', color:'#e8b6cb', description:'打个招呼，送一件小礼物，她会记得你刚刚完成的事。', action:'和伙伴见个面' },
  { id:'echo', number:'10', title:'旋律回声挑战', short:'旋律回声', en:'LISTEN & REMEMBER', icon:'♫', color:'#b4c9e4', description:'先听一小段，再把旋律弹回来。听慢一点也没关系。', action:'听听第一个音' },
  { id:'escape', number:'11', title:'STARRY 解谜夜', short:'解谜夜', en:'BRING BACK THE LIGHT', icon:'⌘', color:'#c5b2d5', description:'开演前灯灭了。收集线索、修好电路，把舞台重新点亮。', action:'推开后台的门' },
  { id:'duet', number:'12', title:'双人默契挑战', short:'双人挑战', en:'TWO DIFFERENT HEARTBEATS', icon:'↔', color:'#e1c6a3', description:'同屏传递手机，回答同一个问题，或一起完成提示接力。', action:'邀请旁边的朋友' }
];
export const mazeLevels = [
  { name:'第一幕 · 绕过后台的灯', note:'先找到钥匙。纸箱可以挡光，也能让你躲一会儿。', rows:[
    '###########','#S....#..E#','#.##..#...#','#..B..#...#','#.....D.K.#','#.###.#...#','#.........#','###########'
  ], lights:[{x:8,y:2,phase:1}], crowds:[[{x:7,y:5},{x:8,y:5},{x:9,y:5},{x:9,y:6},{x:8,y:6},{x:7,y:6}]] },
  { name:'第二幕 · 走廊里有脚步', note:'每走一步，灯光和人群也会向前一步。等一等，也是一种走法。', rows:[
    '###########','#S...#...E#','#.B..D....#','#.##.#.##.#','#....#....#','#.B..#..K.#','#.........#','###########'
  ], lights:[{x:8,y:3,phase:0},{x:3,y:5,phase:2}], crowds:[[{x:6,y:6},{x:7,y:6},{x:8,y:6},{x:9,y:6},{x:8,y:6},{x:7,y:6}]] },
  { name:'第三幕 · 舞台，就在那边', note:'给社交电量留一点余地。纸箱背后，也可以有通往舞台的路。', rows:[
    '###########','#S..B#...E#','#....D....#','#.##.#.##.#','#..B......#','#.##.#..K.#','#....#....#','###########'
  ], lights:[{x:7,y:2,phase:0},{x:7,y:5,phase:2}], crowds:[[{x:3,y:4},{x:4,y:4},{x:5,y:4},{x:6,y:4},{x:5,y:4},{x:4,y:4}]] }
];
export const echoNotes = [
  { label:'Do', key:'1', frequency:261.63, color:'#dfa5bc' },{ label:'Re', key:'2', frequency:293.66, color:'#dec18a' },
  { label:'Mi', key:'3', frequency:329.63, color:'#abc4aa' },{ label:'Sol', key:'4', frequency:392, color:'#99bfcc' },
  { label:'La', key:'5', frequency:440, color:'#b4add4' },{ label:'Do↑', key:'6', frequency:523.25, color:'#d0a8c7' }
];
export const duetQuestions = [
  {id:'after',question:'排练结束，想先做哪件事？',options:['买一罐汽水','再弹一遍副歌','去街角散步','坐下来发呆']},
  {id:'light',question:'第一束灯光，你会选哪种颜色？',options:['粉色','金黄色','蓝色','红色']},
  {id:'rain',question:'突然下雨，你觉得大家会去哪里？',options:['STARRY 门口','乐器店橱窗前','车站屋檐下','便利店里']},
  {id:'sound',question:'一段合奏，最想先听见什么？',options:['吉他拨弦','鼓的四拍','低音贝斯','第一句歌声']},
  {id:'gift',question:'给今天的自己挑一件小礼物？',options:['一枚新拨片','一本空白手帐','一张演出票','一杯热饮']},
  {id:'poster',question:'演出海报上，最想写哪句话？',options:['今晚，也向前一步','四种颜色，一起响起','下一站，舞台见','慢一点也没关系']},
  {id:'room',question:'给小屋添一样东西，你会选？',options:['一盏暖灯','一面海报墙','一个舒服的纸箱','一把旧吉他']},
  {id:'break',question:'给休息的十分钟配一种声音？',options:['窗外的雨','安静的房间','街道的风','远处的试音']},
  {id:'song',question:'为今晚选一个开场？',options:['轻轻的不插电','熟悉的四拍','明亮的合唱','出其不意的独奏']},
  {id:'souvenir',question:'散场之后，想留下什么？',options:['四个人的合照','一张皱皱的票根','耳边的最后一拍','回家路上的聊天']}
];
export const relaySymbols = [{id:0,label:'粉色星星',symbol:'✦',color:'#dca0b9'},{id:1,label:'黄色圆圈',symbol:'○',color:'#dec17d'},{id:2,label:'蓝色方块',symbol:'□',color:'#90b8cc'},{id:3,label:'紫色三角',symbol:'△',color:'#b4a1c8'}];
