import {InstitutePublicPortal} from '@/components/institutes/workspace';
export default async function Page({params}:{params:Promise<{slug:string}>}){return <InstitutePublicPortal slug={(await params).slug}/>;}
