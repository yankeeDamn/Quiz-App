'use client';
import { useEffect, useState } from 'react';
import { buildCertTest } from '@/lib/it-certs';
import { fetchPracticeLibrary } from '@/lib/practice-overrides';

export function CertificationPracticeCount({id}: {id:string}) {
  const [count,setCount] = useState(buildCertTest(id)?.questionCount || 0);
  useEffect(() => {
    let active = true;
    fetchPracticeLibrary().then(data => {
      if (active) setCount(buildCertTest(id, data.overrides, data.additions)?.questionCount || 0);
    }).catch(() => {});
    return () => { active = false; };
  }, [id]);
  return <>{count}</>;
}
