import points from './pilgrimage-points.json';
const details={
'4yd2vzb5s':{title:'下北泽站前',address:'东京都世田谷区北泽2-24-2',source:'https://www.odakyu.jp/station/shimo_kitazawa/',x:170,y:120,note:'从车站开始，先辨认出口与站前街区，再慢慢走向乐队的活动空间。'},
'uqesctl9j':{title:'Village Vanguard 下北泽店',address:'东京都世田谷区北泽2-10-15',source:'https://www.village-v.co.jp/shop-list/000083/',x:440,y:125,note:'把一段街角的日常，和取景资料里的画面放在一起看。营业与店内拍摄要求以店铺现场为准。'},
'uqdj3kh28':{title:'下北泽 SHELTER',address:'东京都世田谷区北泽2-6-10 仙田大厦B1',source:'https://www.loft-prj.co.jp/schedule/shelter/access',x:700,y:245,note:'在地标资料中找到熟悉的Live House入口。门前是正常营业与通行空间，外观停留请让出入口。'}
};
export const pilgrimagePoints=points.map(p=>({...p,...details[p.id]}));
export const pilgrimageLicense='https://creativecommons.org/licenses/by-nc-sa/4.0/';
