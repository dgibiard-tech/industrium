import{useSession}from'./store';
const root=(import.meta.env.VITE_API_URL??'http://localhost:3000/api').replace(/\/$/,'');
export async function api<T>(path:string,init:RequestInit={}){const token=useSession.getState().session?.token;const res=await fetch(root+path,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...init.headers}});if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(body.message??'Erreur serveur')}return res.json() as Promise<T>}
export const money=(c:string|number|bigint)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(c)/100);
