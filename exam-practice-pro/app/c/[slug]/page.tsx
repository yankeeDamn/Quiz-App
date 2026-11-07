import {InstitutePortal} from '@/components/monetization/institute-portal';
export default async function InstitutePage({params}:{params:Promise<{slug:string}>}){return <InstitutePortal slug={(await params).slug}/>;}
