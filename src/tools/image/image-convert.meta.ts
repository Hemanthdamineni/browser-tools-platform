import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id:'image-convert',name:'Convert Image Format',category:'image',summary:'Convert images between PNG, JPEG, WebP and AVIF in your browser.',
  description:'Convert an image to another common format using local browser canvas encoding. The file stays on your device.',keywords:['image converter','convert image','png to jpg','webp converter'],privacy:{processing:'on-device',network:'none',offline:true},input:'file',accept:'image/*',multiple:true,
  options:[{key:'to',label:'Target format',type:'select',default:'webp',choices:['png','jpeg','webp','avif'].map(value=>({value,label:value.toUpperCase()}))},{key:'quality',label:'Quality (%)',type:'range',default:90,min:10,max:100,showWhen:{key:'to',value:'webp'}},{key:'background',label:'Background for JPEG',type:'text',default:'#ffffff'}],examples:[{title:'Convert to WebP'}],related:['image-compress','svg-to-png'],status:'beta'
};
