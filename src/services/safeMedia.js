export function rasterData(value,max=180000){return typeof value==='string'&&value.length<=max&&/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';}
export function httpsLink(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
