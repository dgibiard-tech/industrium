import{create}from'zustand';
type Session={token:string;user:{displayName:string}}|null;
export const useSession=create<{session:Session;setSession:(s:Session)=>void;logout:()=>void}>(set=>({session:JSON.parse(localStorage.getItem('session')??'null') as Session,setSession:session=>{localStorage.setItem('session',JSON.stringify(session));set({session})},logout:()=>{localStorage.removeItem('session');set({session:null})}}));
