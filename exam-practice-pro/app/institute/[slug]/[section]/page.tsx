import {InstituteWorkspace} from '@/components/institutes/workspace';
export const metadata={title:'Institute workspace | ExamPro',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string;section:string}>}){return <InstituteWorkspace {...await params}/>;}
